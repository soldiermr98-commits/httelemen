// ===== IMPORTS & DEPENDENCIES =====
import {
  ConversionResult,
  ConverterSettings,
  ValidationIssue,
} from '../types/elementor';
import {
  buildExactMatchElementorJson,
  buildNativeWidgetsExactDomElementorJson,
} from './elementorBuilder';
import { validateElementorJson } from './elementorValidator';
import { extractExtraCssAndJs } from './extraAssetsExtractor';
import { parseHtmlWithSandbox } from './htmlParser';

// ===== CORE BUSINESS LOGIC =====

/**
 * Executes the complete Hybrid Mode (Native JSON + Extra CSS/JS) conversion pipeline:
 * Parse -> Computed Styles -> Layout Analysis -> Mapping -> Extra CSS/JS Extraction -> Build JSON -> Validate -> Export
 */
export async function runElementorConversionPipeline(
  rawHtml: string,
  sourceFileName: string,
  settings: ConverterSettings,
  assetMap: Map<string, string> = new Map()
): Promise<ConversionResult> {
  const t0 = performance.now();

  // Stage 1: Parse & Computed Styles in Sandboxed Multi-Viewport Iframe
  const parsedStage = await parseHtmlWithSandbox(rawHtml, assetMap, settings);
  const t1 = performance.now();

  // Stage 2, 3, 4, 5: Build Elementor JSON (1:1 Native Widgets by default, or Section HTML Carrier)
  const useExactSectionCarrier = settings.exactHtmlMatch === true;
  const builtStage = useExactSectionCarrier
    ? buildExactMatchElementorJson(
        parsedStage.annotatedRawHtml || rawHtml,
        parsedStage.bodyBackgroundColor,
        settings,
        parsedStage.placeholders,
        assetMap,
        parsedStage.computedDimensionsMap
      )
    : buildNativeWidgetsExactDomElementorJson(
        parsedStage.annotatedRawHtml || rawHtml,
        parsedStage.bodyBackgroundColor,
        settings,
        parsedStage.placeholders,
        assetMap,
        parsedStage.computedDimensionsMap
      );

  // Stage 5.5: Extract Scoped Extra CSS (extra.css) & Behavioral JS (extra.js)
  const extraAssets = extractExtraCssAndJs(
    rawHtml,
    settings,
    builtStage.reconstructedWrappers,
    builtStage.extractedSvgs,
    builtStage.templateJson
  );
  const embedInline = settings.embedAssetsInPageJson !== false;

  if (embedInline) {
    const inlineParts: string[] = [];
    if (extraAssets.extraCss.trim()) {
      inlineParts.push(
        `<style id="elementor-hybrid-extra-css">\n${extraAssets.extraCss}\n</style>`
      );
    }
    if (extraAssets.extraJs.trim()) {
      inlineParts.push(
        `<script id="elementor-hybrid-extra-js">\n${extraAssets.extraJs}\n</script>\n<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" aria-hidden="true" style="display:none!important;width:0!important;height:0!important;" onload="if(!window.__elHybridInitRan){var s=document.getElementById('elementor-hybrid-extra-js');if(s&&s.textContent){try{(0,eval)(s.textContent);}catch(e){}}}" />`
      );
    }

    if (inlineParts.length > 0 && builtStage.templateJson.content.length > 0) {
      const inlineCarrierWidget = {
        id: 'f9e8d7c6',
        elType: 'widget' as const,
        widgetType: 'html',
        settings: {
          html: inlineParts.join('\n\n'),
          _element_id: 'hybrid-inline-assets',
          css_id: 'hybrid-inline-assets',
          _css_classes: 'gf-system elementor-hybrid-inline-carrier',
          css_classes: 'gf-system elementor-hybrid-inline-carrier',
        },
        elements: [],
      };

      const lastRoot =
        builtStage.templateJson.content[
          builtStage.templateJson.content.length - 1
        ];
      if (lastRoot.elType === 'section' && lastRoot.elements.length > 0) {
        const lastCol = lastRoot.elements[lastRoot.elements.length - 1];
        lastCol.elements.push(inlineCarrierWidget);
      } else if (lastRoot.elType === 'container') {
        lastRoot.elements.push(inlineCarrierWidget);
      }

      if (settings.hasElementorPro && extraAssets.extraCss.trim()) {
        builtStage.templateJson.page_settings.custom_css = extraAssets.extraCss;
      }
    }
  }

  const t2 = performance.now();

  // Format official JSON string
  const jsonString = JSON.stringify(builtStage.templateJson, null, 2);

  // Stage 6: Mandatory Pre-Download Validation
  const validation = validateElementorJson(jsonString, settings);

  // Add warning items for fonts, placeholders, excluded sections, and replaced Pro widgets
  const additionalWarnings: ValidationIssue[] = [];

  if (parsedStage.excludedSections.length > 0) {
    additionalWarnings.push({
      id: 'warn-excluded-sections',
      severity: 'warning',
      ruleNumber: 7,
      title: `جداسازی ساختار پوسته (${parsedStage.excludedSections.length} بخش خارج از JSON صفحه)`,
      message: `بخش‌های «${parsedStage.excludedSections
        .map((e) => e.identifier)
        .join('، ')}» طبق قانون جداسازی ساختار صفحه وارد page.json نشدند (در صورت نیاز گزینه «شامل هدر/فوتر» را فعال کنید).`,
    });
  }

  if (
    parsedStage.fontsDetected.length > 0 ||
    extraAssets.fontFaceFiles.length > 0
  ) {
    additionalWarnings.push({
      id: 'warn-fonts-detected',
      severity: 'warning',
      ruleNumber: 7,
      title: `فونت‌های سفارشی و @font-face شناسایی‌شده (${
        parsedStage.fontsDetected.length
      } خانواده فونت / ${extraAssets.fontFaceFiles.length} فایل فونت)`,
      message: `فونت‌های «${parsedStage.fontsDetected.join(
        '، '
      )}» در تنظیمات تایپوگرافی ثبت شدند و در فایل extra.css مسیر فونت‌ها به {{FONT_URL}} تبدیل شد تا پس از آپلود فونت‌ها در وردپرس جایگزین شود.`,
    });
  }

  if (builtStage.placeholders.length > 0) {
    additionalWarnings.push({
      id: 'warn-placeholders-inserted',
      severity: 'warning',
      ruleNumber: 7,
      title: `جایگزینی خودکار مقادیر ناموجود با Placeholder (${builtStage.placeholders.length} مورد)`,
      message:
        'تصاویر ۱ پیکسلی (data:image/gif)، مسیرهای نسبی ناموجود یا لینک‌های خالی پس از بررسی ترتیب (data-src → srcset → data-fallback → src) با Placeholder استاندارد جایگزین شدند.',
    });
  }

  if (builtStage.replacedWidgets.length > 0) {
    additionalWarnings.push({
      id: 'warn-pro-widgets-replaced',
      severity: 'warning',
      ruleNumber: 7,
      title: `تبدیل المان‌های نیازمند Pro به ویجت‌های بومی رایگان (${builtStage.replacedWidgets.length} مورد)`,
      message:
        'المان‌های نیازمند Elementor Pro (مانند فرم‌ها) به ترکیب ویجت‌های بومی رایگان تبدیل شدند تا بدون خطا ایمپورت شوند.',
    });
  }

  const t3 = performance.now();

  const manualAdjustments = [...builtStage.manualAdjustments];
  if (extraAssets.fontFaceFiles.length > 0) {
    manualAdjustments.push(
      `آپلود فایل‌های فونت (${extraAssets.fontFaceFiles.join(
        ', '
      )}) در هاست وردپرس و جایگزینی متغیر {{FONT_URL}} در ابتدای استایل‌ها`
    );
  } else if (parsedStage.fontsDetected.length > 0) {
    manualAdjustments.push(
      `بارگذاری فونت‌های سفارشی (${parsedStage.fontsDetected.join(
        ', '
      )}) در بخش Elementor > Custom Fonts یا پوسته وردپرس`
    );
  }

  if (!embedInline) {
    manualAdjustments.push(
      'افزودن محتوای فایل extra.css در بخش «نمایش > سفارشی‌سازی > CSS اضافی» یا Elementor > Custom CSS جهت اعمال ::before/::after، گرادیانت‌های چندلایه و @keyframes'
    );

    if (extraAssets.extractedJsBlocksCount > 0) {
      manualAdjustments.push(
        'افزودن فایل extra.js از طریق Elementor > Custom Code (انتهای <body>) یا افزونه WPCode جهت فعال‌سازی اسکریپت‌های رفتاری (IntersectionObserver، رسم مدار و پارالاکس)'
      );
    }
  }

  if (builtStage.placeholders.some((p) => p.type === 'image')) {
    manualAdjustments.push(
      'جایگزینی تصاویر Placeholder (placehold.co) با تصاویر اصلی از کتابخانه رسانه وردپرس'
    );
  }

  const nativeItems: string[] = [
    `${builtStage.counts.sections} سکشن اصلی و ${builtStage.counts.innerSections} سکشن داخلی (Inner Section) با عرض واقعی کانتینر (content_width) و فاصله‌گذاری (gap)`,
    `${builtStage.counts.columns} ستون با درصد عرض واقعی (_column_size) و فاصله ویجت‌ها (space_between_widgets)`,
    `${builtStage.counts.widgets} ویجت بومی رایگان Elementor (${Object.entries(
      builtStage.widgetBreakdown
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join('، ')})`,
    `حفظ کامل کلاس‌های اصلی HTML در css_classes / _css_classes و شناسه‌ها در css_id / _element_id`,
    `تزریق مستقیم مقادیر Computed Style (عرض، ارتفاع، پدینگ، مارجین، تایپوگرافی و ابعاد واکنش‌گرا _tablet و _mobile) در کنترلرهای المنتور`,
    `تفکیک ${builtStage.extractedSvgs.length} المان SVG به فایل‌های مستقل لوکال (assets/svg/*.svg) و تبدیل به ویجت بومی Image بدون کد خام SVG`,
    `بازسازی ${builtStage.counts.decorativeWidgets} لایه تزئینی و آیکون با ویجت بومی + _css_classes`,
    ...(embedInline
      ? [
          `جاسازی خودکار تمام قوانین extra.css (${extraAssets.extractedCssRulesCount} قانون) و اسکریپت‌های extra.js (${extraAssets.extractedJsBlocksCount} بلوک) مستقیماً در انتهای خود فایل page.json (#hybrid-inline-assets) بدون نیاز به خروج از برگه`,
        ]
      : []),
  ];

  return {
    json: builtStage.templateJson,
    jsonString,
    extraCss: extraAssets.extraCss,
    extraJs: extraAssets.extraJs,
    extractedSvgs: builtStage.extractedSvgs,
    sanitizedPreviewHtml: parsedStage.sanitizedPreviewHtml,
    sourceFileName,
    report: {
      counts: {
        ...builtStage.counts,
        extractedCssRules: extraAssets.extractedCssRulesCount,
        extractedJsBlocks: extraAssets.extractedJsBlocksCount,
        extractedSvgFiles: builtStage.extractedSvgs.length,
      },
      widgetBreakdown: builtStage.widgetBreakdown,
      fontsDetected: parsedStage.fontsDetected,
      excludedSections: parsedStage.excludedSections,
      replacedWidgets: builtStage.replacedWidgets,
      placeholders: builtStage.placeholders,
      manualAdjustments,
      hybridBreakdown: {
        nativeItems,
        extraCssItems: extraAssets.extraCssItems,
        extraJsItems: extraAssets.extraJsItems,
        manualActionItems: manualAdjustments,
        fontFaceFiles: extraAssets.fontFaceFiles,
      },
      validationIssues: [...validation.issues, ...additionalWarnings],
      canDownload: validation.canDownload,
      pipelineTimingsMs: {
        parseAndStyles: Math.max(1, Math.round(t1 - t0)),
        layoutAndMapping: Math.max(1, Math.round(t2 - t1)),
        buildAndValidate: Math.max(1, Math.round(t3 - t2)),
        total: Math.max(3, Math.round(t3 - t0)),
      },
    },
  };
}
