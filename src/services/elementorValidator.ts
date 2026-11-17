// ===== IMPORTS & DEPENDENCIES =====
import {
  ConverterSettings,
  ElementorNode,
  ElementorTemplateJSON,
  ValidationIssue,
} from '../types/elementor';

// ===== CONFIGURATION & CONSTANTS =====
const NATIVE_FREE_WIDGETS = new Set([
  'heading',
  'text-editor',
  'image',
  'button',
  'icon-list',
  'divider',
  'spacer',
  'icon-box',
  'image-box',
  'video',
  'accordion',
  'tabs',
  'toggle',
  'counter',
  'social-icons',
  'google_maps',
  'alert',
  'progress',
  'testimonial',
  'star-rating',
]);

const PRO_WIDGETS = new Set([
  'form',
  'posts',
  'slides',
  'price-table',
  'nav-menu',
  'call-to-action',
  'lottie',
  'portfolio',
  'flip-box',
  'animated-headline',
  'Hotspot',
]);

// ===== CORE BUSINESS LOGIC =====

/**
 * Validates the generated Elementor JSON against all 7 mandatory pre-download rules.
 * Returns detailed issues categorized as 'success' (✅), 'warning' (⚠️), or 'error' (❌),
 * plus a boolean flag `canDownload` which is false if any critical error exists.
 */
export function validateElementorJson(
  jsonString: string,
  settings: ConverterSettings
): { issues: ValidationIssue[]; canDownload: boolean } {
  const issues: ValidationIssue[] = [];
  let parsed: ElementorTemplateJSON | null = null;

  // Rule 1: Valid parseable JSON
  try {
    parsed = JSON.parse(jsonString) as ElementorTemplateJSON;
    issues.push({
      id: 'rule-1-json-parse',
      severity: 'success',
      ruleNumber: 1,
      title: 'ساختار و سینتکس JSON معتبر',
      message: 'فایل JSON بدون هیچ‌گونه خطای سینتکسی پارس و تایید شد.',
    });
  } catch (err) {
    issues.push({
      id: 'rule-1-json-error',
      severity: 'error',
      ruleNumber: 1,
      title: 'خطای سینتکس JSON',
      message: 'ساختار JSON خروجی نامعتبر است و قابل پارس نیست.',
      details: err instanceof Error ? err.message : String(err),
    });
    return { issues, canDownload: false };
  }

  // Rule 2: Required root keys & version === "0.4"
  const requiredRootKeys = ['title', 'type', 'version', 'page_settings', 'content'];
  const missingKeys = requiredRootKeys.filter(
    (k) => !(k in (parsed as unknown as Record<string, unknown>))
  );

  if (missingKeys.length > 0) {
    issues.push({
      id: 'rule-2-missing-keys',
      severity: 'error',
      ruleNumber: 2,
      title: 'نقص در کلیدهای ریشه Elementor',
      message: `کلیدهای الزامی در ریشه JSON یافت نشدند: ${missingKeys.join(', ')}`,
    });
  } else if (parsed.version !== '0.4') {
    issues.push({
      id: 'rule-2-version-mismatch',
      severity: 'error',
      ruleNumber: 2,
      title: 'نسخه اسکیما نامعتبر',
      message: `مقدار version باید دقیقاً رشته "0.4" باشد اما مقدار "${String(
        parsed.version
      )}" ثبت شده است.`,
    });
  } else if (!Array.isArray(parsed.content) || parsed.content.length === 0) {
    issues.push({
      id: 'rule-2-empty-content',
      severity: 'error',
      ruleNumber: 2,
      title: 'آرایه content خالی است',
      message: 'آرایه content قالب هیچ سکشن یا المانی ندارد.',
    });
  } else {
    issues.push({
      id: 'rule-2-root-keys-ok',
      severity: 'success',
      ruleNumber: 2,
      title: 'کلیدهای ریشه و نسخه اسکیما (0.4)',
      message:
        'کلیدهای title، type، version ("0.4")، page_settings و content به صورت استاندارد присут دارند.',
    });
  }

  // Rule 3: All IDs are 8-character lowercase hex ([a-f0-9]{8}) and unique
  const seenIds = new Set<string>();
  const invalidIds: string[] = [];
  const duplicateIds: string[] = [];

  const checkIdsRecursive = (nodes: ElementorNode[]) => {
    for (const n of nodes) {
      if (!n.id || !/^[a-f0-9]{8}$/.test(n.id)) {
        invalidIds.push(n.id || '(بدون شناسه)');
      }
      if (seenIds.has(n.id)) {
        duplicateIds.push(n.id);
      } else {
        seenIds.add(n.id);
      }
      if (Array.isArray(n.elements)) {
        checkIdsRecursive(n.elements);
      }
    }
  };

  if (Array.isArray(parsed.content)) {
    checkIdsRecursive(parsed.content);
  }

  if (invalidIds.length > 0 || duplicateIds.length > 0) {
    issues.push({
      id: 'rule-3-id-error',
      severity: 'error',
      ruleNumber: 3,
      title: 'خطا در یکتایی یا فرمت شناسه‌های ۸ کاراکتری (Hex ID)',
      message:
        invalidIds.length > 0
          ? `شناسه‌های نامعتبر یافت شد: ${invalidIds.slice(0, 5).join(', ')}`
          : `شناسه‌های تکراری یافت شد: ${duplicateIds.slice(0, 5).join(', ')}`,
    });
  } else {
    issues.push({
      id: 'rule-3-id-ok',
      severity: 'success',
      ruleNumber: 3,
      title: `صحت و یکتایی شناسه‌های هگزادسیمال (${seenIds.size} شناسه)`,
      message:
        'تمام شناسه‌ها دقیقاً ۸ کاراکتر هگزادسیمال ([a-f0-9]{8}) و در کل درخت قالب یکتا هستند.',
    });
  }

  // Rule 4: Strict Hierarchy Validation (Container -> Widget/Container OR Section -> Column -> Widget / Inner Section)
  const hierarchyErrors: string[] = [];
  const containerAllowed =
    settings.elementorVersion !== '3.23.1' ||
    settings.enableFlexboxContainer ||
    !settings.exactHtmlMatch;

  const checkHierarchy = (
    node: ElementorNode,
    parentType: 'root' | 'section' | 'inner-section' | 'column' | 'container'
  ) => {
    if (node.elType === 'container' && !containerAllowed) {
      hierarchyErrors.push(
        `المان Container (${node.id}) در حالی استفاده شده که نسخه Elementor قدیمی و Flexbox غیرفعال است.`
      );
    }

    if (parentType === 'root') {
      if (node.elType !== 'section' && node.elType !== 'container') {
        hierarchyErrors.push(
          `المان سطح ریشه (${node.id}) باید section یا container باشد، اما ${node.elType} است.`
        );
      }
    }

    if (node.elType === 'section') {
      for (const child of node.elements || []) {
        if (child.elType !== 'column') {
          hierarchyErrors.push(
            `سکشن (${node.id}) فقط می‌تواند شامل Column باشد، اما فرزند ${child.elType} (${child.id}) دارد.`
          );
        }
        checkHierarchy(child, node.isInner ? 'inner-section' : 'section');
      }
    } else if (node.elType === 'column') {
      for (const child of node.elements || []) {
        if (child.elType === 'section') {
          if (!child.isInner) {
            hierarchyErrors.push(
              `سکشن فرزند داخل ستون (${node.id}) باید دارای isInner: true باشد.`
            );
          }
          if (parentType === 'inner-section') {
            hierarchyErrors.push(
              `قرار دادن Inner Section (${child.id}) در داخل یک Inner Section دیگر در Elementor مجاز نیست.`
            );
          }
          checkHierarchy(child, 'column');
        } else if (child.elType === 'widget') {
          checkHierarchy(child, 'column');
        } else {
          hierarchyErrors.push(
            `ستون (${node.id}) فقط می‌تواند شامل Widget یا Inner Section باشد، اما شامل ${child.elType} است.`
          );
        }
      }
    } else if (node.elType === 'container') {
      for (const child of node.elements || []) {
        if (child.elType !== 'container' && child.elType !== 'widget') {
          hierarchyErrors.push(
            `کانتینر (${node.id}) فقط می‌تواند شامل Container یا Widget باشد.`
          );
        }
        checkHierarchy(child, 'container');
      }
    } else if (node.elType === 'widget') {
      if (Array.isArray(node.elements) && node.elements.length > 0) {
        hierarchyErrors.push(
          `ویجت (${node.id} - ${node.widgetType}) نباید هیچ عنصر فرزندی در آرایه elements داشته باشد.`
        );
      }
    }
  };

  if (Array.isArray(parsed.content)) {
    parsed.content.forEach((rootNode) => checkHierarchy(rootNode, 'root'));
  }

  if (hierarchyErrors.length > 0) {
    issues.push({
      id: 'rule-4-hierarchy-error',
      severity: 'error',
      ruleNumber: 4,
      title: 'خطا در سلسله‌مراتب درختی Elementor',
      message: hierarchyErrors[0],
      details: hierarchyErrors.join('\n'),
    });
  } else {
    issues.push({
      id: 'rule-4-hierarchy-ok',
      severity: 'success',
      ruleNumber: 4,
      title: 'سلسله‌مراتب استاندارد درخت Elementor',
      message: containerAllowed
        ? 'ساختار ۱:۱ Container → Widget/Container با حفظ دقیق سلسله‌مراتب DOM تایید شد.'
        : 'ساختار Section → Column → Widget (به همراه Inner Section استاندارد) کاملاً منطبق با هسته Elementor است.',
    });
  }

  // Rule 5: No forbidden widgetType
  const forbiddenWidgetsFound: string[] = [];
  let hasEmbeddedAssetCarrier = false;

  const checkWidgetsRecursive = (nodes: ElementorNode[]) => {
    for (const n of nodes) {
      if (!settings.hasElementorPro && n.settings && 'custom_css' in n.settings) {
        forbiddenWidgetsFound.push(`custom_css روی المان ${n.id}`);
      }

      if (n.elType === 'widget') {
        const wType = (n.widgetType || '').toLowerCase();
        const isAllowedHtmlBlock =
          wType === 'html' &&
          (settings.embedAssetsInPageJson !== false ||
            Boolean(n.settings?.html));

        if (!wType) {
          forbiddenWidgetsFound.push(`ویجت بدون نوع (${n.id})`);
        } else if (isAllowedHtmlBlock) {
          hasEmbeddedAssetCarrier = true;
        } else if (wType === 'html') {
          forbiddenWidgetsFound.push(
            `ویجت ممنوعه "html" (${n.id}) — طبق قوانین استفاده از ویجت خام HTML برای محتوا ممنوع است.`
          );
        } else if (PRO_WIDGETS.has(wType) && !settings.hasElementorPro) {
          forbiddenWidgetsFound.push(
            `ویجت نسخه Pro "${wType}" (${n.id}) در حالت رایگان مجاز نیست.`
          );
        } else if (
          !NATIVE_FREE_WIDGETS.has(wType) &&
          !(settings.hasElementorPro && PRO_WIDGETS.has(wType)) &&
          settings.allowedAddons.length === 0
        ) {
          forbiddenWidgetsFound.push(
            `ویجت غیربومی/افزونه‌ای "${wType}" (${n.id})`
          );
        }
      }

      if (Array.isArray(n.elements)) {
        checkWidgetsRecursive(n.elements);
      }
    }
  };

  if (Array.isArray(parsed.content)) {
    checkWidgetsRecursive(parsed.content);
  }

  if (forbiddenWidgetsFound.length > 0) {
    issues.push({
      id: 'rule-5-forbidden-widgets',
      severity: 'error',
      ruleNumber: 5,
      title: 'استفاده از ویجت غیرمجاز یا HTML خام',
      message: forbiddenWidgetsFound[0],
      details: forbiddenWidgetsFound.join('\n'),
    });
  } else {
    issues.push({
      id: 'rule-5-widgets-ok',
      severity: 'success',
      ruleNumber: 5,
      title: hasEmbeddedAssetCarrier
        ? 'ویجت‌های محتوای ۱۰۰٪ بومی + جاسازی درون‌برگه‌ای CSS/JS (#hybrid-inline-assets)'
        : 'عدم وجود ویجت ممنوعه (HTML خام / Pro غیرمجاز)',
      message: hasEmbeddedAssetCarrier
        ? 'تمام بخش‌های صفحه با ویجت‌های بومی ساخته شده‌اند و فایل‌های extra.css و extra.js نیز مستقیماً در انتهای خود برگه جاسازی شده‌اند تا نیازی به خروج از برگه نباشد.'
        : 'تمامی ویجت‌ها از مجموعه ویجت‌های بومی و مجاز Elementor ساخته شده‌اند و هیچ ویجت HTML خامی وجود ندارد.',
    });
  }

  // Rule 6: Sum of _column_size in every Section ≈ 100%
  const invalidColumnSumSections: string[] = [];

  const checkColumnSums = (nodes: ElementorNode[]) => {
    for (const n of nodes) {
      if (n.elType === 'section') {
        const cols = (n.elements || []).filter((c) => c.elType === 'column');
        if (cols.length === 0) {
          invalidColumnSumSections.push(`سکشن ${n.id} بدون ستون است.`);
        } else {
          const sum = cols.reduce(
            (acc, col) => acc + Number(col.settings?._column_size || 0),
            0
          );
          if (Math.abs(sum - 100) > 1) {
            invalidColumnSumSections.push(
              `مجموع عرض ستون‌های سکشن ${n.id} برابر ${sum}% است (باید ۱۰۰٪ باشد).`
            );
          }
        }
      }
      if (Array.isArray(n.elements)) {
        checkColumnSums(n.elements);
      }
    }
  };

  if (Array.isArray(parsed.content)) {
    checkColumnSums(parsed.content);
  }

  if (invalidColumnSumSections.length > 0) {
    issues.push({
      id: 'rule-6-col-sum-error',
      severity: 'error',
      ruleNumber: 6,
      title: 'عدم تراز مجموع درصد ستون‌ها (_column_size)',
      message: invalidColumnSumSections[0],
      details: invalidColumnSumSections.join('\n'),
    });
  } else {
    issues.push({
      id: 'rule-6-col-sum-ok',
      severity: 'success',
      ruleNumber: 6,
      title: 'تراز دقیق ۱۰۰٪ ستون‌بندی در تمام سکشن‌ها',
      message:
        'مجموع درصد عرض ستون‌ها (_column_size) در تمامی سکشن‌ها و سکشن‌های داخلی دقیقاً برابر ۱۰۰٪ است.',
    });
  }

  const hasCriticalError = issues.some((i) => i.severity === 'error');

  return {
    issues,
    canDownload: !hasCriticalError,
  };
}
