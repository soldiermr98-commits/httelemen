// ===== IMPORTS & DEPENDENCIES =====
import JSZip from 'jszip';
import {
  BoxEdges,
  ComputedBoxStyle,
  ComputedElementDimensionsSnapshot,
  ConverterSettings,
  ExcludedSectionEntry,
  ParsedDOMNode,
  PlaceholderEntry,
  ResponsiveStyleOverrides,
} from '../types/elementor';
import {
  edgesDiffer,
  edgesZero,
  extractPrimaryFont,
  formatDimension,
  formatSize,
  normalizeColor,
  normalizeFontWeight,
  parseBoxShadow,
  parsePx,
} from './styleUtils';
import {
  MATERIAL_ICON_TO_FA_MAP,
  synthesizeTailwindStylesheet,
} from './tailwindSandboxHelper';

// ===== CONFIGURATION & CONSTANTS =====
const IGNORED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'META',
  'LINK',
  'TITLE',
  'HEAD',
  'BR',
  'WBR',
  'TEMPLATE',
]);

// Non-visual accessibility/chrome helpers that are never part of page content
const CHROME_IGNORE_CLASSES = [
  'visually-hidden',
  'sr-only',
  'skip-link',
  'ga-skip',
  'gf-system',
  'scroll-progress',
  'cursor-aura',
  'mobile-nav',
  'menu-toggle',
  'nav-panel',
  'sprite',
  'p-card__fallback',
];

// Internal Elementor boilerplate classes that must NOT be copied into css_classes / _css_classes
// because they conflict with Elementor's own frontend stylesheet in WordPress.
const ELEMENTOR_INTERNAL_CLASSES = new Set([
  'e-con',
  'e-con-full',
  'e-con-boxed',
  'e-con-inner',
  'e-child',
  'elementor',
  'elementor-element',
  'elementor-section',
  'elementor-top-section',
  'elementor-inner-section',
  'elementor-column',
  'elementor-top-column',
  'elementor-inner-column',
  'elementor-widget',
  'elementor-widget-container',
  'elementor-widget-wrap',
  'elementor-element-populated',
  'elementor-widget-heading',
  'elementor-widget-button',
  'elementor-widget-text-editor',
  'elementor-widget-html',
  'elementor-widget-image',
  'elementor-widget-icon-box',
  'elementor-widget-spacer',
  'elementor-widget-divider',
  'elementor-heading-title',
  'elementor-button',
  'elementor-button-link',
  'elementor-button-content-wrapper',
  'elementor-button-text',
  'elementor-button-icon',
  'elementor-size-default',
  'elementor-size-sm',
  'elementor-size-md',
  'elementor-size-lg',
  'elementor-size-xl',
]);

// Decorative classes that should be preserved as spacer/divider widgets with _css_classes (Requirement 5)
const DECORATIVE_LAYER_CLASSES = [
  'hero__bg',
  'hero__particles',
  'hv__glow',
  'services__decor',
  'capabilities__light',
  'capabilities__aurora',
  'roadmap__blueprint',
  'roadmap__signal',
  'benefits__bg',
  'benefits__beam',
  'process__rail',
  'cta-panel__bg',
  'cta-panel__aurora',
  'cta-panel__spot',
  'cta-panel__particles',
  'site-footer__decor',
];

// Minor sub-card decorative overlays that shouldn't split card columns
const SUB_CARD_DECOR_CLASSES = [
  'hero__scroll',
  'hv__dots-ui',
  'hv__toggle',
  'hv__typing',
  'hv__circuits',
  'roadmap__node',
  'cta-panel__node',
  'site-footer__mark',
  'site-header__bg',
  'p-card__beam',
  'p-card__scan',
  'g-tile__shade',
  'g-tile__frame',
  'g-tile__arrow',
  'sh__seam',
  'sh__node',
  's-card__trace',
  'led',
];

const SVG_ICON_TO_FA_MAP: Record<string, string> = {
  '#i-layout-template': 'fas fa-laptop-code',
  '#i-search-check': 'fas fa-search',
  '#i-shield-check': 'fas fa-shield-alt',
  '#i-code-xml': 'fas fa-code',
  '#i-badge-check': 'fas fa-check-circle',
  '#i-package-check': 'fas fa-box-open',
  '#i-layers': 'fas fa-layer-group',
  '#i-handshake': 'fas fa-handshake',
  '#i-target': 'fas fa-bullseye',
  '#i-compass': 'fas fa-compass',
  '#i-rocket': 'fas fa-rocket',
  '#i-headset': 'fas fa-headset',
  '#i-chef-hat': 'fas fa-utensils',
  '#i-clipboard-list': 'fas fa-clipboard-list',
  '#i-workflow': 'fas fa-project-diagram',
  '#i-layout-dashboard': 'fas fa-tachometer-alt',
  '#i-cpu': 'fas fa-microchip',
  '#i-sparkles': 'fas fa-magic',
  '#i-plug': 'fas fa-plug',
  '#i-store': 'fas fa-store',
  '#i-trees': 'fas fa-tree',
  '#i-coffee': 'fas fa-mug-hot',
  '#i-house': 'fas fa-home',
  '#i-map-pin': 'fas fa-map-marker-alt',
  '#i-calendar-clock': 'fas fa-calendar-check',
  '#i-blocks': 'fas fa-cubes',
  '#i-gauge': 'fas fa-tachometer-alt',
  '#i-life-buoy': 'fas fa-life-ring',
  '#i-git-branch': 'fas fa-code-branch',
  '#i-info': 'fas fa-info-circle',
  '#i-shopping-cart': 'fas fa-shopping-cart',
  '#i-user-round': 'fas fa-user',
  '#i-arrow-left': 'fas fa-arrow-left',
  '#i-arrow-up': 'fas fa-arrow-up',
  '#i-check': 'fas fa-check',
};

const DESKTOP_WIDTH = 1440;
const TABLET_WIDTH = 768;
const MOBILE_WIDTH = 375;

// ===== TYPES & INTERFACES =====
export interface ExtractedBundle {
  htmlContent: string;
  fileName: string;
  assetMap: Map<string, string>;
}

export interface ParseStageOutput {
  rootNodes: ParsedDOMNode[];
  bodyBackgroundColor: string;
  fontsDetected: string[];
  placeholders: PlaceholderEntry[];
  excludedSections: ExcludedSectionEntry[];
  sanitizedPreviewHtml: string;
  annotatedRawHtml: string;
  computedDimensionsMap: Map<string, ComputedElementDimensionsSnapshot>;
}

// ===== UTILITY FUNCTIONS =====

function normalizeAssetPath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/^\.?\//, '')
    .replace(/^(\.\.\/)+/, '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();
}

/**
 * Resolves image src using strict priority order (Requirement 7):
 * data-src -> srcset -> data-fallback -> src
 */
function resolvePriorityImageSrc(img: Element): string {
  const dataSrc = (img.getAttribute('data-src') || '').trim();
  if (dataSrc && !dataSrc.startsWith('data:image/gif;base64,R0lGOD')) {
    return dataSrc;
  }

  const srcset = (img.getAttribute('srcset') || '').trim();
  if (srcset) {
    const firstCandidate = srcset
      .split(',')[0]
      ?.trim()
      .split(/\s+/)[0]
      ?.trim();
    if (
      firstCandidate &&
      !firstCandidate.startsWith('data:image/gif;base64,R0lGOD')
    ) {
      return firstCandidate;
    }
  }

  const dataFallback = (img.getAttribute('data-fallback') || '').trim();
  if (dataFallback && !dataFallback.startsWith('data:image/gif;base64,R0lGOD')) {
    return dataFallback;
  }

  return (img.getAttribute('src') || '').trim();
}

/**
 * Extracts HTML, CSS, and images from a single HTML file or a ZIP archive.
 */
export async function extractUploadedFiles(file: File): Promise<ExtractedBundle> {
  const assetMap = new Map<string, string>();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    let htmlContent = '';
    let htmlFileName = file.name.replace(/\.zip$/i, '.html');
    const cssChunks: string[] = [];

    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    for (const entry of entries) {
      const cleanName = normalizeAssetPath(entry.name);
      const baseName = cleanName.split('/').pop() || cleanName;

      if (cleanName.endsWith('.html') || cleanName.endsWith('.htm')) {
        const text = await entry.async('string');
        if (!htmlContent || baseName === 'index.html') {
          htmlContent = text;
          htmlFileName = entry.name.split('/').pop() || htmlFileName;
        }
      } else if (cleanName.endsWith('.css')) {
        const cssText = await entry.async('string');
        cssChunks.push(`/* ${entry.name} */\n${cssText}`);
      } else if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(cleanName)) {
        const base64 = await entry.async('base64');
        const ext = cleanName.split('.').pop() || 'png';
        const mime =
          ext === 'svg'
            ? 'image/svg+xml'
            : ext === 'jpg'
            ? 'image/jpeg'
            : `image/${ext}`;
        const dataUrl = `data:${mime};base64,${base64}`;
        assetMap.set(cleanName, dataUrl);
        assetMap.set(baseName, dataUrl);
      }
    }

    if (!htmlContent) {
      throw new Error(
        'هیچ فایل HTML (.html یا .htm) در داخل فایل فشرده ZIP یافت نشد.'
      );
    }

    if (cssChunks.length > 0) {
      const combinedStyleTag = `<style data-inlined-zip="true">\n${cssChunks.join(
        '\n'
      )}\n</style>`;
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${combinedStyleTag}\n</head>`);
      } else {
        htmlContent = `${combinedStyleTag}\n${htmlContent}`;
      }
    }

    return {
      htmlContent,
      fileName: htmlFileName,
      assetMap,
    };
  }

  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    const htmlContent = await file.text();
    if (!htmlContent.trim()) {
      throw new Error('فایل HTML انتخاب‌شده خالی است.');
    }
    return {
      htmlContent,
      fileName: file.name,
      assetMap,
    };
  }

  throw new Error('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل .html یا .zip آپلود کنید.');
}

function readEdges(
  style: CSSStyleDeclaration,
  prefix: 'padding' | 'margin' | 'border'
): BoxEdges {
  if (prefix === 'border') {
    return {
      top: parsePx(style.borderTopWidth),
      right: parsePx(style.borderRightWidth),
      bottom: parsePx(style.borderBottomWidth),
      left: parsePx(style.borderLeftWidth),
    };
  }
  return {
    top: parsePx(style.getPropertyValue(`${prefix}-top`)),
    right: parsePx(style.getPropertyValue(`${prefix}-right`)),
    bottom: parsePx(style.getPropertyValue(`${prefix}-bottom`)),
    left: parsePx(style.getPropertyValue(`${prefix}-left`)),
  };
}

function readBorderRadius(style: CSSStyleDeclaration): BoxEdges {
  return {
    top: parsePx(style.borderTopLeftRadius),
    right: parsePx(style.borderTopRightRadius),
    bottom: parsePx(style.borderBottomRightRadius),
    left: parsePx(style.borderBottomLeftRadius),
  };
}

function mapTextAlign(
  raw: string,
  direction = 'rtl'
): 'left' | 'center' | 'right' | 'justify' | '' {
  const val = (raw || '').toLowerCase();
  const isRtl = (direction || 'rtl').toLowerCase() === 'rtl';
  if (val === 'center') return 'center';
  if (val === 'justify') return 'justify';
  if (val === 'right') return 'right';
  if (val === 'left') return 'left';
  if (val === 'start') return isRtl ? 'right' : 'left';
  if (val === 'end') return isRtl ? 'left' : 'right';
  return isRtl ? 'right' : 'left';
}

function computeStyleForElement(
  el: Element,
  win: Window
): { rect: { x: number; y: number; width: number; height: number }; styles: ComputedBoxStyle } {
  const cs = win.getComputedStyle(el);
  const domRect = el.getBoundingClientRect();

  const fontSizePx = parsePx(cs.fontSize, 16);
  const rawLineHeight = cs.lineHeight;
  const lineHeightPx =
    rawLineHeight === 'normal'
      ? Math.round(fontSizePx * 1.5)
      : parsePx(rawLineHeight, Math.round(fontSizePx * 1.5));

  const letterSpacingPx =
    cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;

  const columnGapPx = parsePx(cs.columnGap || cs.gap || '0px', 0);
  const rowGapPx = parsePx(cs.rowGap || cs.gap || '0px', 0);
  const gapPx = Math.max(columnGapPx, rowGapPx, parsePx(cs.gap || '0px', 0));

  const minHeightPx = parsePx(cs.minHeight, 0);
  const maxWidthPx = cs.maxWidth && cs.maxWidth !== 'none' ? parsePx(cs.maxWidth, 0) : 0;

  return {
    rect: {
      x: Math.round(domRect.left),
      y: Math.round(domRect.top),
      width: Math.round(domRect.width),
      height: Math.round(domRect.height),
    },
    styles: {
      display: cs.display || 'block',
      position: cs.position || 'static',
      color: normalizeColor(cs.color),
      backgroundColor: normalizeColor(cs.backgroundColor),
      backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage : '',
      fontFamily: cs.fontFamily || '',
      fontSizePx,
      fontWeight: normalizeFontWeight(cs.fontWeight),
      lineHeightPx,
      letterSpacingPx: Number(letterSpacingPx.toFixed(2)),
      textAlign: mapTextAlign(cs.textAlign, cs.direction),
      padding: readEdges(cs, 'padding'),
      margin: readEdges(cs, 'margin'),
      borderWidth: readEdges(cs, 'border'),
      borderStyle: cs.borderTopStyle || cs.borderBottomStyle || 'none',
      borderColor:
        normalizeColor(cs.borderTopColor) ||
        normalizeColor(cs.borderBottomColor),
      borderRadius: readBorderRadius(cs),
      boxShadow: parseBoxShadow(cs.boxShadow),
      flexDirection: cs.flexDirection || 'row',
      justifyContent: cs.justifyContent || 'normal',
      alignItems: cs.alignItems || 'normal',
      flexWrap: cs.flexWrap || 'nowrap',
      gapPx,
      columnGapPx,
      rowGapPx,
      gridTemplateColumns: cs.gridTemplateColumns || 'none',
      widthPx: Math.round(domRect.width),
      heightPx: Math.round(domRect.height),
      minHeightPx,
      maxWidthPx,
    },
  };
}

function getDirectTextContent(el: Element): string {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || '';
    }
  }
  return text.replace(/\s+/g, ' ').trim();
}

function getCleanVisibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone
    .querySelectorAll(
      'script, style, noscript, template, .visually-hidden, .sr-only, .nav-panel, [hidden], [data-skeleton]'
    )
    .forEach((n) => n.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function sanitizeInlineHtml(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone
    .querySelectorAll(
      'script, style, noscript, iframe, object, embed, svg, .visually-hidden, .sr-only, .nav-panel, [hidden]'
    )
    .forEach((node) => node.remove());
  return clone.innerHTML.trim();
}

function isDecorativeLayerElement(el: Element): boolean {
  if (el.hasAttribute('data-circuit')) return true;
  const classList = Array.from(el.classList);
  if (classList.some((cls) => DECORATIVE_LAYER_CLASSES.includes(cls))) {
    return true;
  }
  const hasNoTextOrMedia =
    !(el.textContent || '').trim() && !el.querySelector('img, svg, input, button, a');
  if (
    hasNoTextOrMedia &&
    classList.some(
      (cls) =>
        cls === 'pointer-events-none' ||
        cls === '-z-10' ||
        cls === 'ambient-glow-blue' ||
        cls.startsWith('blur-')
    )
  ) {
    return true;
  }
  return false;
}

function shouldIgnoreElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  if (IGNORED_TAGS.has(tag)) return true;

  if (el.hasAttribute('hidden') || el.hasAttribute('data-skeleton')) {
    return true;
  }

  // Ignore tiny empty decorative status dots (e.g., w-2 h-2 rounded-full animate-ping)
  const classList = Array.from(el.classList);
  if (
    (tag === 'SPAN' || tag === 'DIV') &&
    !(el.textContent || '').trim() &&
    el.children.length === 0 &&
    !el.hasAttribute('data-star-rating') &&
    !el.hasAttribute('data-fa-icon') &&
    (classList.includes('animate-ping') ||
      classList.includes('w-2') ||
      classList.includes('w-2.5') ||
      classList.includes('w-3') ||
      classList.includes('w-4'))
  ) {
    return true;
  }

  // Keep decorative layer elements so they can be reconstructed as spacer/divider + _css_classes (Requirement 5)
  if (isDecorativeLayerElement(el)) {
    return false;
  }

  for (const cls of classList) {
    if (
      CHROME_IGNORE_CLASSES.includes(cls) ||
      SUB_CARD_DECOR_CLASSES.includes(cls) ||
      cls.endsWith('-system') ||
      cls.endsWith('-skip') ||
      cls.endsWith('-sr-only')
    ) {
      return true;
    }
  }

  if (el.getAttribute('aria-hidden') === 'true') {
    if (
      el.hasAttribute('data-el-html-widget') ||
      el.hasAttribute('data-raw-svg') ||
      Boolean(el.closest('[data-el-html-widget="true"]'))
    ) {
      return false;
    }
    const hasHeadingOrLinks = Boolean(
      el.querySelector('h1, h2, h3, h4, h5, h6, a[href], button, img[src], svg')
    );
    const textLen = (el.textContent || '').replace(/\s+/g, '').length;
    const isRichVisualShowcase =
      classList.includes('hv') ||
      classList.includes('cc') ||
      classList.includes('ticker') ||
      classList.includes('wf-stage') ||
      classList.includes('wf-scene') ||
      classList.includes('wf-dots') ||
      classList.includes('wf-num') ||
      classList.includes('fchip') ||
      classList.includes('demo-dots') ||
      classList.includes('dot-live') ||
      classList.includes('meter') ||
      classList.includes('track') ||
      classList.includes('cta-beam') ||
      classList.includes('layer') ||
      classList.includes('orb') ||
      classList.includes('progress') ||
      Boolean(el.closest('.hv')) ||
      Boolean(el.closest('.cc')) ||
      Boolean(el.closest('.wf-stage')) ||
      Boolean(el.closest('.wf-step'));

    if (
      !hasHeadingOrLinks &&
      !isRichVisualShowcase &&
      !el.hasAttribute('data-svg-src') &&
      textLen < 4
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Serializes a live `<svg>` element from the measurement sandbox iframe into a standalone,
 * self-contained `.svg` XML string by resolving `currentColor` and computed CSS `fill`,
 * `stroke`, `stroke-width`, `stroke-linecap`, and `stroke-linejoin` directly from `getComputedStyle`.
 */
function serializeLiveSvgWithComputedStyles(
  liveSvg: SVGElement,
  win: Window
): {
  svgXml: string;
  widthPx: number;
  heightPx: number;
  viewBox: string;
} {
  const clone = liveSvg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  clone.removeAttribute('data-el-measure-id');
  clone
    .querySelectorAll('[data-el-measure-id]')
    .forEach((n) => n.removeAttribute('data-el-measure-id'));

  const cs = win.getComputedStyle(liveSvg);
  const rect = liveSvg.getBoundingClientRect();
  const viewBox = (liveSvg.getAttribute('viewBox') || '').trim();
  const vbParts = viewBox
    .split(/[\s,]+/)
    .map((n) => parseFloat(n))
    .filter((n) => Number.isFinite(n));
  const vbWidth = vbParts.length === 4 && vbParts[2] > 0 ? vbParts[2] : 24;
  const vbHeight = vbParts.length === 4 && vbParts[3] > 0 ? vbParts[3] : 24;

  const rawWidthAttr = parseFloat(liveSvg.getAttribute('width') || '0') || 0;
  const rawHeightAttr = parseFloat(liveSvg.getAttribute('height') || '0') || 0;
  const cssWidthPx = parsePx(cs.width, 0);
  const cssHeightPx = parsePx(cs.height, 0);

  const widthPx = Math.max(
    1,
    Math.round(rect.width) || cssWidthPx || rawWidthAttr || vbWidth
  );
  const heightPx = Math.max(
    1,
    Math.round(rect.height) || cssHeightPx || rawHeightAttr || vbHeight
  );

  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  if (!viewBox) {
    clone.setAttribute('viewBox', `0 0 ${widthPx} ${heightPx}`);
  }

  const computedColor = normalizeColor(cs.color) || '#0c1a36';
  const hasExplicitRootFill = liveSvg.hasAttribute('fill');
  const hasExplicitRootStroke = liveSvg.hasAttribute('stroke');
  const hasGradientOrMultiColorChildren = Boolean(
    liveSvg.querySelector(
      'linearGradient, radialGradient, [fill^="url("], [stroke^="url("]'
    ) ||
      (liveSvg.querySelector('[fill]:not([fill="none"]):not([fill="currentColor"])') &&
        liveSvg.querySelector('[stroke]:not([stroke="none"]):not([stroke="currentColor"])'))
  );

  const isStrokeBasedSvg =
    !hasGradientOrMultiColorChildren &&
    !liveSvg.classList.contains('e-font-icon-svg') &&
    ((liveSvg.getAttribute('fill') || '').toLowerCase() === 'none' ||
      cs.fill === 'none' ||
      Boolean(
        hasExplicitRootStroke &&
          (liveSvg.getAttribute('stroke') || '').toLowerCase() !== 'none'
      ) ||
      Boolean(cs.stroke && cs.stroke !== 'none') ||
      Boolean(
        liveSvg.querySelector('line, polyline, [stroke]:not([stroke="none"])')
      ));

  if (!hasGradientOrMultiColorChildren) {
    if (isStrokeBasedSvg) {
      clone.setAttribute('fill', 'none');
    } else if (!hasExplicitRootFill) {
      if (cs.fill === 'none') {
        clone.setAttribute('fill', 'none');
      } else if (
        liveSvg.classList.contains('e-font-icon-svg') ||
        (cs.fill && cs.fill.startsWith('rgb'))
      ) {
        clone.setAttribute('fill', normalizeColor(cs.fill) || computedColor);
      }
    } else if (
      (liveSvg.getAttribute('fill') || '').toLowerCase() === 'currentcolor'
    ) {
      clone.setAttribute('fill', computedColor);
    }

    if (!hasExplicitRootStroke) {
      if ((cs.stroke && cs.stroke !== 'none') || isStrokeBasedSvg) {
        clone.setAttribute(
          'stroke',
          cs.stroke && cs.stroke !== 'none'
            ? normalizeColor(cs.stroke) || computedColor
            : computedColor
        );
        const sw = parseFloat(cs.strokeWidth || '0');
        if (sw > 0 && !liveSvg.hasAttribute('stroke-width')) {
          clone.setAttribute('stroke-width', String(Number(sw.toFixed(2))));
        } else if (!liveSvg.hasAttribute('stroke-width')) {
          clone.setAttribute('stroke-width', '2');
        }
        if (
          cs.strokeLinecap &&
          cs.strokeLinecap !== 'butt' &&
          !liveSvg.hasAttribute('stroke-linecap')
        ) {
          clone.setAttribute('stroke-linecap', cs.strokeLinecap);
        } else if (!liveSvg.hasAttribute('stroke-linecap')) {
          clone.setAttribute('stroke-linecap', 'round');
        }
        if (
          cs.strokeLinejoin &&
          cs.strokeLinejoin !== 'miter' &&
          !liveSvg.hasAttribute('stroke-linejoin')
        ) {
          clone.setAttribute('stroke-linejoin', cs.strokeLinejoin);
        } else if (!liveSvg.hasAttribute('stroke-linejoin')) {
          clone.setAttribute('stroke-linejoin', 'round');
        }
      }
    } else if (
      (liveSvg.getAttribute('stroke') || '').toLowerCase() === 'currentcolor'
    ) {
      clone.setAttribute('stroke', computedColor);
    }
  }

  // Sync computed stroke/fill on child vector shapes if they rely on CSS rules or currentColor
  const liveShapes = Array.from(
    liveSvg.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse')
  );
  const cloneShapes = Array.from(
    clone.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse')
  );
  for (let i = 0; i < liveShapes.length && i < cloneShapes.length; i++) {
    const lShape = liveShapes[i];
    const cShape = cloneShapes[i];
    const sCs = win.getComputedStyle(lShape);
    const shapeColor = normalizeColor(sCs.color) || computedColor;

    const fillAttr = (cShape.getAttribute('fill') || '').trim();
    if (fillAttr.toLowerCase() === 'currentcolor') {
      cShape.setAttribute('fill', shapeColor);
    } else if (fillAttr.startsWith('var(')) {
      cShape.setAttribute(
        'fill',
        sCs.fill === 'none' || isStrokeBasedSvg
          ? 'none'
          : normalizeColor(sCs.fill) || shapeColor
      );
    }

    const strokeAttr = (cShape.getAttribute('stroke') || '').trim();
    if (strokeAttr.toLowerCase() === 'currentcolor') {
      cShape.setAttribute('stroke', shapeColor);
    } else if (strokeAttr.startsWith('var(')) {
      cShape.setAttribute(
        'stroke',
        sCs.stroke === 'none'
          ? 'none'
          : normalizeColor(sCs.stroke) || shapeColor
      );
    }
  }

  const rawXml = new XMLSerializer()
    .serializeToString(clone)
    .replace(/currentColor/gi, computedColor);

  return {
    svgXml: `<?xml version="1.0" encoding="UTF-8"?>\n${rawXml}`,
    widthPx,
    heightPx,
    viewBox: clone.getAttribute('viewBox') || `0 0 ${widthPx} ${heightPx}`,
  };
}

/**
 * New DOM Analysis Method:
 * Extracts the exact `Computed Style` (width, height, responsive tablet/mobile dimensions, padding, margin,
 * typography, border-radius, and resolved SVG vector styles) for EVERY element in the source HTML document
 * BEFORE converting to Elementor JSON, tagging each element with a deterministic `data-el-measure-id`.
 */
export async function extractComputedDimensionsBeforeJsonConversion(
  rawHtml: string,
  assetMap: Map<string, string> = new Map(),
  _settings?: ConverterSettings
): Promise<{
  annotatedRawHtml: string;
  computedDimensionsMap: Map<string, ComputedElementDimensionsSnapshot>;
}> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 0. Normalize case-mismatched CSS class names (e.g. HTML `class="header-End"` when CSS defines `.header-end`)
  const cssTextCombined = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent || '')
    .join('\n');
  const definedCssClasses = new Set<string>();
  const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  let clsMatch: RegExpExecArray | null;
  while ((clsMatch = classRegex.exec(cssTextCombined)) !== null) {
    definedCssClasses.add(clsMatch[1]);
  }
  doc.body.querySelectorAll('[class]').forEach((el) => {
    Array.from(el.classList).forEach((cls) => {
      if (!definedCssClasses.has(cls) && definedCssClasses.has(cls.toLowerCase())) {
        el.classList.add(cls.toLowerCase());
      }
    });
  });

  // 1. Collect all SVG <defs> children by id (e.g. <linearGradient id="brandGrad">) and <symbol id="...">
  const defsById = new Map<string, Element>();
  doc
    .querySelectorAll(
      'svg defs [id], svg linearGradient[id], svg radialGradient[id], svg filter[id], svg clipPath[id], svg mask[id]'
    )
    .forEach((defEl) => {
      if (defEl.id) {
        defsById.set(defEl.id, defEl);
      }
    });

  // Resolve inline `<svg><use href="#..."></svg>` from any sprite `<symbol>` before measurement
  const symbolMap = new Map<string, Element>();
  doc.querySelectorAll('svg symbol[id]').forEach((sym) => {
    symbolMap.set(`#${sym.id}`, sym);
  });
  doc.querySelectorAll('svg use').forEach((useEl) => {
    const href = (
      useEl.getAttribute('href') ||
      useEl.getAttribute('xlink:href') ||
      ''
    ).trim();
    const sym = symbolMap.get(href);
    const parentSvg = useEl.closest('svg');
    if (sym && parentSvg) {
      const symParentSvg = sym.closest('svg');
      const inheritedAttrs = [
        'viewBox',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
      ];
      for (const attr of inheritedAttrs) {
        if (!parentSvg.getAttribute(attr)) {
          const val =
            sym.getAttribute(attr) || symParentSvg?.getAttribute(attr) || '';
          if (val) {
            parentSvg.setAttribute(attr, val);
          }
        }
      }
      parentSvg.innerHTML = sym.innerHTML;
    }
  });

  // Inline any referenced `url(#defId)` (like `#brandGrad`) into standalone `<svg>` elements so they remain self-contained
  doc.querySelectorAll('svg:not(.sprite)').forEach((svgEl) => {
    const rawSvgHtml = svgEl.outerHTML;
    const urlRefRegex = /url\(\s*['"]?#([a-zA-Z0-9_-]+)['"]?\s*\)/g;
    let refMatch: RegExpExecArray | null;
    while ((refMatch = urlRefRegex.exec(rawSvgHtml)) !== null) {
      const defId = refMatch[1];
      const defNode = defsById.get(defId);
      if (defNode && !svgEl.querySelector(`#${defId}`)) {
        let defsEl = svgEl.querySelector('defs');
        if (!defsEl) {
          defsEl = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svgEl.insertBefore(defsEl, svgEl.firstChild);
        }
        defsEl.appendChild(defNode.cloneNode(true));
      }
    }
  });

  // Assign deterministic `data-el-measure-id` to every element in body
  let measureCounter = 0;
  doc.body.querySelectorAll('*').forEach((el) => {
    measureCounter++;
    el.setAttribute('data-el-measure-id', `el_m_${measureCounter}`);
  });

  const annotatedRawHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

  // Prepare sandbox measurement clone (hoist <style>, synthesize Tailwind, disable scroll-reveal opacity:0)
  const sandboxDoc = parser.parseFromString(annotatedRawHtml, 'text/html');
  sandboxDoc
    .querySelectorAll('body style, [class*="-system"] style')
    .forEach((s) => sandboxDoc.head.appendChild(s));

  sandboxDoc.querySelectorAll('img').forEach((imgEl) => {
    const src = resolvePriorityImageSrc(imgEl);
    if (src && assetMap.size > 0) {
      const norm = normalizeAssetPath(src);
      const base = norm.split('/').pop() || norm;
      const mapped = assetMap.get(src) || assetMap.get(norm) || assetMap.get(base);
      if (mapped) imgEl.setAttribute('src', mapped);
    }
  });

  const twCss = synthesizeTailwindStylesheet(sandboxDoc);
  if (twCss) {
    const twStyle = sandboxDoc.createElement('style');
    twStyle.textContent = twCss;
    sandboxDoc.head.appendChild(twStyle);
  }

  sandboxDoc.querySelectorAll('script').forEach((s) => s.remove());

  // Activate progressive-enhancement live states (#demo-tabs, .js-only, #demo.is-live) in the measurement sandbox
  // so interactive tab bars and controls are measured with their true display:flex/grid layout instead of display:none
  sandboxDoc.documentElement.classList.add('js');
  sandboxDoc
    .querySelectorAll('#demo-tabs[hidden], .js-only[hidden]')
    .forEach((el) => {
      el.removeAttribute('hidden');
    });
  sandboxDoc.querySelectorAll('#demo').forEach((el) => {
    el.classList.add('is-live');
    const firstTab = el.querySelector('.demo-tab');
    if (firstTab && !firstTab.hasAttribute('aria-selected')) {
      firstTab.setAttribute('aria-selected', 'true');
    }
  });

  const cleanCustomFont = (_settings?.customFontFamily || '').trim();
  const customFontRule = cleanCustomFont
    ? `body, body *:not(code):not(pre):not(.mono):not(.out-box):not(.mock-out):not(.tool-slug) { font-family: "${cleanCustomFont}", Tahoma, system-ui, -apple-system, sans-serif !important; }`
    : '';

  const helperStyle = sandboxDoc.createElement('style');
  helperStyle.textContent = `
    .reveal, [data-reveal], [data-split], [class*="-reveal"], .gf-reveal, .ga-reveal, .gc-reveal, .gs-reveal, .anim-in, .w, .w__i, .hero__content, .hero__visual, .g-tile, .g-tile__img, .cc__tag {
      opacity: 1 !important;
      transform: none !important;
      translate: none !important;
      scale: 1 !important;
      clip-path: none !important;
      visibility: visible !important;
      animation: none !important;
    }
    ${customFontRule}
  `;
  sandboxDoc.head.appendChild(helperStyle);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.className =
    'fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none border-0';
  iframe.style.width = `${DESKTOP_WIDTH}px`;
  iframe.style.height = '3200px';
  document.body.appendChild(iframe);

  const computedDimensionsMap = new Map<
    string,
    ComputedElementDimensionsSnapshot
  >();

  try {
    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      return { annotatedRawHtml, computedDimensionsMap };
    }

    iframeDoc.open();
    iframeDoc.write('<!DOCTYPE html>\n' + sandboxDoc.documentElement.outerHTML);
    iframeDoc.close();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const measuredElements = Array.from(
      iframeDoc.body.querySelectorAll('[data-el-measure-id]')
    );

    // 1. Desktop (1440px)
    const desktopStyles = new Map<string, ComputedBoxStyle>();
    const resolvedSvgMap = new Map<string, string>();

    for (const el of measuredElements) {
      const mId = el.getAttribute('data-el-measure-id') || '';
      if (!mId) continue;
      const comp = computeStyleForElement(el, iframeWin);
      desktopStyles.set(mId, comp.styles);

      if (el.tagName.toLowerCase() === 'svg') {
        const svgRes = serializeLiveSvgWithComputedStyles(
          el as unknown as SVGElement,
          iframeWin
        );
        comp.styles.widthPx = svgRes.widthPx;
        comp.styles.heightPx = svgRes.heightPx;
        resolvedSvgMap.set(mId, svgRes.svgXml);
      }
    }

    // 2. Tablet (768px)
    iframe.style.width = `${TABLET_WIDTH}px`;
    await new Promise((resolve) => setTimeout(resolve, 30));

    const tabletStyles = new Map<
      string,
      ResponsiveStyleOverrides & { widthPx: number; heightPx: number }
    >();
    for (const el of measuredElements) {
      const mId = el.getAttribute('data-el-measure-id') || '';
      const d = desktopStyles.get(mId);
      if (!mId || !d) continue;
      const tab = computeStyleForElement(el, iframeWin).styles;
      const ov: ResponsiveStyleOverrides & { widthPx: number; heightPx: number } =
        {
          widthPx: tab.widthPx || d.widthPx,
          heightPx: tab.heightPx || d.heightPx,
        };
      if (tab.fontSizePx !== d.fontSizePx) ov.fontSizePx = tab.fontSizePx;
      if (tab.lineHeightPx !== d.lineHeightPx) ov.lineHeightPx = tab.lineHeightPx;
      if (edgesDiffer(tab.padding, d.padding)) ov.padding = tab.padding;
      if (edgesDiffer(tab.margin, d.margin)) ov.margin = tab.margin;
      if (tab.flexDirection !== d.flexDirection)
        ov.flexDirection = tab.flexDirection;
      if (tab.gapPx !== d.gapPx) ov.gapPx = tab.gapPx;
      tabletStyles.set(mId, ov);
    }

    // 3. Mobile (375px)
    iframe.style.width = `${MOBILE_WIDTH}px`;
    await new Promise((resolve) => setTimeout(resolve, 30));

    for (const el of measuredElements) {
      const mId = el.getAttribute('data-el-measure-id') || '';
      const d = desktopStyles.get(mId);
      if (!mId || !d) continue;
      const mob = computeStyleForElement(el, iframeWin).styles;
      const tabOv = tabletStyles.get(mId) || {
        widthPx: d.widthPx,
        heightPx: d.heightPx,
      };
      const mobOv: ResponsiveStyleOverrides & {
        widthPx: number;
        heightPx: number;
      } = {
        widthPx: mob.widthPx || d.widthPx,
        heightPx: mob.heightPx || d.heightPx,
      };
      if (mob.fontSizePx !== d.fontSizePx) mobOv.fontSizePx = mob.fontSizePx;
      if (mob.lineHeightPx !== d.lineHeightPx)
        mobOv.lineHeightPx = mob.lineHeightPx;
      if (edgesDiffer(mob.padding, d.padding)) mobOv.padding = mob.padding;
      if (edgesDiffer(mob.margin, d.margin)) mobOv.margin = mob.margin;
      if (mob.flexDirection !== d.flexDirection)
        mobOv.flexDirection = mob.flexDirection;
      if (mob.gapPx !== d.gapPx) mobOv.gapPx = mob.gapPx;

      const hasExplicitWidth =
        Boolean(el.getAttribute('width')) ||
        Array.from(el.classList).some(
          (c) => /^w-\d/.test(c) || /^w-\[/.test(c) || c.includes('icon')
        );
      const hasExplicitHeight =
        Boolean(el.getAttribute('height')) ||
        Array.from(el.classList).some(
          (c) => /^h-\d/.test(c) || /^h-\[/.test(c) || c.includes('icon')
        );

      computedDimensionsMap.set(mId, {
        measureId: mId,
        tag: el.tagName.toLowerCase(),
        desktop: d,
        tablet: tabOv,
        mobile: mobOv,
        hasExplicitWidth,
        hasExplicitHeight,
        resolvedSvgString: resolvedSvgMap.get(mId),
      });
    }
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }

  return { annotatedRawHtml, computedDimensionsMap };
}

/**
 * Injects the exact pre-conversion `Computed Style` (width, height, responsive tablet/mobile dimensions,
 * padding, margin, border-radius, typography, and flex/grid gap) directly into the Elementor controller
 * parameters (`targetSettings`) for widgets and containers.
 */
export function injectComputedStylesIntoElementorController(
  el: Element | null,
  role:
    | 'container'
    | 'heading'
    | 'button'
    | 'text-editor'
    | 'image'
    | 'icon-box'
    | 'accordion'
    | 'toggle'
    | 'spacer'
    | 'divider'
    | 'html',
  targetSettings: Record<string, unknown>,
  computedDimensionsMap?: Map<string, ComputedElementDimensionsSnapshot>,
  customFontFamily?: string
): ComputedElementDimensionsSnapshot | undefined {
  const cleanCustomFont = (customFontFamily || '').trim();
  if (cleanCustomFont) {
    if (role === 'heading' || role === 'text-editor' || role === 'button') {
      targetSettings.typography_typography = 'custom';
      targetSettings.typography_font_family = cleanCustomFont;
    } else if (role === 'icon-box') {
      targetSettings.title_typography_typography = 'custom';
      targetSettings.title_typography_font_family = cleanCustomFont;
      targetSettings.description_typography_typography = 'custom';
      targetSettings.description_typography_font_family = cleanCustomFont;
    } else if (role === 'accordion' || role === 'toggle') {
      targetSettings.title_typography_typography = 'custom';
      targetSettings.title_typography_font_family = cleanCustomFont;
      targetSettings.content_typography_typography = 'custom';
      targetSettings.content_typography_font_family = cleanCustomFont;
    }
  }

  if (!el || !computedDimensionsMap) return undefined;
  const measureId = (el.getAttribute('data-el-measure-id') || '').trim();
  if (!measureId) return undefined;

  const snap = computedDimensionsMap.get(measureId);
  if (!snap) return undefined;

  const d = snap.desktop;
  const tab = snap.tablet;
  const mob = snap.mobile;
  const cssClassesStr = String(
    targetSettings._css_classes || targetSettings.css_classes || ''
  );
  const isNativeScopedWidget = cssClassesStr.includes('el-native-');

  // 1. Always record exact computed dimensions (width & height across Desktop, Tablet, Mobile)
  if (d.widthPx > 0) {
    targetSettings._computed_width_px = d.widthPx;
    targetSettings._computed_width_tablet_px = tab.widthPx || d.widthPx;
    targetSettings._computed_width_mobile_px = mob.widthPx || d.widthPx;
  }
  if (d.heightPx > 0) {
    targetSettings._computed_height_px = d.heightPx;
    targetSettings._computed_height_tablet_px = tab.heightPx || d.heightPx;
    targetSettings._computed_height_mobile_px = mob.heightPx || d.heightPx;
  }
  if (
    d.display === 'none' &&
    !el.hasAttribute('hidden') &&
    !el.classList.contains('js-only') &&
    !el.closest('[hidden], .js-only')
  ) {
    targetSettings.hide_desktop = 'hidden-desktop';
    targetSettings._hide_desktop = 'hidden-desktop';
  }

  const effectiveFont = cleanCustomFont || d.fontFamily || '';

  // 2. Role-specific Elementor controller parameter injection
  if (role === 'icon-box') {
    if (!isNativeScopedWidget) {
      if (d.backgroundColor) {
        targetSettings.view = 'stacked';
        targetSettings.shape = 'square';
        targetSettings.primary_color = d.backgroundColor;
      }
      if (d.color) {
        targetSettings.secondary_color = d.color;
        targetSettings.icon_color = d.color;
      }
      if (!edgesZero(d.borderRadius)) {
        targetSettings.border_radius = formatDimension(d.borderRadius, 'px');
      }
      if (d.padding.top > 0) {
        targetSettings.icon_padding = formatSize(d.padding.top, 'px');
      }
    }
    if (d.widthPx > 0 && snap.hasExplicitWidth) {
      targetSettings._element_custom_width = formatSize(d.widthPx, 'px');
    }
  } else if (role === 'image') {
    if (d.widthPx > 0) {
      targetSettings.width = formatSize(d.widthPx, 'px');
      if (tab.widthPx > 0 && tab.widthPx !== d.widthPx) {
        targetSettings.width_tablet = formatSize(tab.widthPx, 'px');
      }
      if (mob.widthPx > 0 && mob.widthPx !== d.widthPx) {
        targetSettings.width_mobile = formatSize(mob.widthPx, 'px');
      }
      if (snap.hasExplicitWidth || snap.tag === 'svg') {
        targetSettings._element_custom_width = formatSize(d.widthPx, 'px');
      }
    }
    if (d.heightPx > 0) {
      targetSettings.height = formatSize(d.heightPx, 'px');
      if (tab.heightPx > 0 && tab.heightPx !== d.heightPx) {
        targetSettings.height_tablet = formatSize(tab.heightPx, 'px');
      }
      if (mob.heightPx > 0 && mob.heightPx !== d.heightPx) {
        targetSettings.height_mobile = formatSize(mob.heightPx, 'px');
      }
    }
    if (!edgesZero(d.borderRadius)) {
      targetSettings.image_border_radius = formatDimension(d.borderRadius, 'px');
    }
  } else if (role === 'button') {
    if (d.widthPx > 0 && snap.hasExplicitWidth) {
      targetSettings._element_custom_width = formatSize(d.widthPx, 'px');
    }
    if (d.fontSizePx > 0) {
      targetSettings.typography_typography = 'custom';
      if (effectiveFont) {
        targetSettings.typography_font_family = effectiveFont;
      }
      targetSettings.typography_font_size = formatSize(d.fontSizePx, 'px');
      targetSettings.typography_font_weight = d.fontWeight;
      targetSettings.typography_line_height = formatSize(d.lineHeightPx, 'px');
    }
    if (d.color) {
      targetSettings.button_text_color = d.color;
    }
    if (d.backgroundColor && d.backgroundColor !== '#00000000') {
      targetSettings.background_color = d.backgroundColor;
    } else if (d.backgroundImage && d.backgroundImage.includes('gradient')) {
      const hexMatches = d.backgroundImage.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
      if (hexMatches && hexMatches.length >= 2) {
        targetSettings.background_background = 'gradient';
        targetSettings.background_color = normalizeColor(hexMatches[0]) || hexMatches[0];
        targetSettings.background_color_b = normalizeColor(hexMatches[1]) || hexMatches[1];
      }
    } else if (isNativeScopedWidget) {
      targetSettings.background_color = '#00000000';
    }
    if (!edgesZero(d.padding)) {
      targetSettings.text_padding = formatDimension(d.padding, 'px');
    }
    if (!edgesZero(d.borderRadius)) {
      targetSettings.border_radius = formatDimension(d.borderRadius, 'px');
    }
    if (d.borderStyle && d.borderStyle !== 'none' && !edgesZero(d.borderWidth)) {
      targetSettings.border_border = d.borderStyle;
      targetSettings.border_width = formatDimension(d.borderWidth, 'px');
      if (d.borderColor) {
        targetSettings.border_color = d.borderColor;
      }
    }
    if (!edgesZero(d.margin)) {
      targetSettings._margin = formatDimension(d.margin, 'px');
    }
    if (d.textAlign) {
      targetSettings.align = d.textAlign;
    }
  } else if (role === 'heading' || role === 'text-editor') {
    if (d.fontSizePx > 0) {
      targetSettings.typography_typography = 'custom';
      if (effectiveFont) {
        targetSettings.typography_font_family = effectiveFont;
      }
      targetSettings.typography_font_size = formatSize(d.fontSizePx, 'px');
      if (tab.fontSizePx && tab.fontSizePx !== d.fontSizePx) {
        targetSettings.typography_font_size_tablet = formatSize(
          tab.fontSizePx,
          'px'
        );
      }
      if (mob.fontSizePx && mob.fontSizePx !== d.fontSizePx) {
        targetSettings.typography_font_size_mobile = formatSize(
          mob.fontSizePx,
          'px'
        );
      }
      targetSettings.typography_font_weight = d.fontWeight;
      targetSettings.typography_line_height = formatSize(d.lineHeightPx, 'px');
      if (d.letterSpacingPx !== 0) {
        targetSettings.typography_letter_spacing = formatSize(
          d.letterSpacingPx,
          'px'
        );
      }
    }
    if (d.color) {
      if (role === 'heading') {
        targetSettings.title_color = d.color;
      } else {
        targetSettings.text_color = d.color;
      }
    }
    if (d.textAlign) {
      targetSettings.align = d.textAlign;
    }
    if (!edgesZero(d.padding)) {
      targetSettings._padding = formatDimension(d.padding, 'px');
      if (tab.padding) {
        targetSettings._padding_tablet = formatDimension(tab.padding, 'px');
      }
      if (mob.padding) {
        targetSettings._padding_mobile = formatDimension(mob.padding, 'px');
      }
    }
    if (!edgesZero(d.margin)) {
      targetSettings._margin = formatDimension(d.margin, 'px');
      if (tab.margin) {
        targetSettings._margin_tablet = formatDimension(tab.margin, 'px');
      }
      if (mob.margin) {
        targetSettings._margin_mobile = formatDimension(mob.margin, 'px');
      }
    }
  } else if (role === 'spacer') {
    const h = Math.max(1, d.heightPx || 1);
    targetSettings.space = formatSize(h, 'px');
    if (tab.heightPx > 0 && tab.heightPx !== h) {
      targetSettings.space_tablet = formatSize(tab.heightPx, 'px');
    }
    if (mob.heightPx > 0 && mob.heightPx !== h) {
      targetSettings.space_mobile = formatSize(mob.heightPx, 'px');
    }
    if (d.widthPx > 0 && snap.hasExplicitWidth) {
      targetSettings._element_custom_width = formatSize(d.widthPx, 'px');
    }
  } else if (role === 'container') {
    if (d.display.includes('flex')) {
      targetSettings.flex_direction =
        d.flexDirection === 'row' || d.flexDirection === 'row-reverse'
          ? d.flexDirection
          : 'column';
      if (d.justifyContent && d.justifyContent !== 'normal') {
        targetSettings.flex_justify_content = d.justifyContent;
      }
      if (d.alignItems && d.alignItems !== 'normal') {
        targetSettings.flex_align_items = d.alignItems;
      }
      if (d.flexWrap && d.flexWrap !== 'nowrap') {
        targetSettings.flex_wrap = d.flexWrap;
      }
      const colGap = d.columnGapPx ?? d.gapPx ?? 0;
      const rowGap = d.rowGapPx ?? d.gapPx ?? 0;
      if (colGap > 0 || rowGap > 0) {
        const primaryGap = Math.max(colGap, rowGap);
        targetSettings.flex_gap = {
          unit: 'px',
          size: primaryGap,
          column: String(colGap || primaryGap),
          row: String(rowGap || primaryGap),
          isLinked: colGap === rowGap,
        };
      }
    }
    const isHeaderTag = el.tagName.toLowerCase() === 'header';
    if (d.minHeightPx >= 40) {
      targetSettings.min_height = formatSize(d.minHeightPx, 'px');
    } else if (isHeaderTag && d.heightPx >= 48 && d.heightPx <= 140) {
      targetSettings.min_height = formatSize(d.heightPx, 'px');
    }
    if (d.maxWidthPx >= 280 && d.maxWidthPx < DESKTOP_WIDTH) {
      targetSettings.boxed_width = formatSize(d.maxWidthPx, 'px');
      targetSettings._max_width_px = d.maxWidthPx;
    }
    if (!edgesZero(d.padding)) {
      targetSettings.padding = formatDimension(d.padding, 'px');
      if (tab.padding) {
        targetSettings.padding_tablet = formatDimension(tab.padding, 'px');
      }
      if (mob.padding) {
        targetSettings.padding_mobile = formatDimension(mob.padding, 'px');
      }
    }
    const isAutoCenteredMargin =
      el.classList.contains('container') ||
      el.classList.contains('mx-auto') ||
      (d.maxWidthPx > 0 &&
        d.maxWidthPx < DESKTOP_WIDTH &&
        d.margin.left >= 16 &&
        Math.abs(d.margin.left - d.margin.right) <= 4);
    if (isAutoCenteredMargin) {
      targetSettings._margin_inline_auto = true;
    }
    const cleanMargin = isAutoCenteredMargin
      ? { ...d.margin, left: 0, right: 0 }
      : d.margin;
    if (!edgesZero(cleanMargin)) {
      targetSettings.margin = formatDimension(cleanMargin, 'px');
    }
    if (tab.margin) {
      const cleanTabMargin = isAutoCenteredMargin
        ? { ...tab.margin, left: 0, right: 0 }
        : tab.margin;
      if (!edgesZero(cleanTabMargin)) {
        targetSettings.margin_tablet = formatDimension(cleanTabMargin, 'px');
      }
    }
    if (mob.margin) {
      const cleanMobMargin = isAutoCenteredMargin
        ? { ...mob.margin, left: 0, right: 0 }
        : mob.margin;
      if (!edgesZero(cleanMobMargin)) {
        targetSettings.margin_mobile = formatDimension(cleanMobMargin, 'px');
      }
    }
    if (d.backgroundColor && d.backgroundColor !== '#00000000') {
      targetSettings.background_background = 'classic';
      targetSettings.background_color = d.backgroundColor;
    }
    if (d.borderStyle && d.borderStyle !== 'none' && !edgesZero(d.borderWidth)) {
      targetSettings.border_border = d.borderStyle;
      targetSettings.border_width = formatDimension(d.borderWidth, 'px');
      if (d.borderColor) {
        targetSettings.border_color = d.borderColor;
      }
    }
    if (!edgesZero(d.borderRadius)) {
      targetSettings.border_radius = formatDimension(d.borderRadius, 'px');
    }
    if (d.boxShadow) {
      targetSettings.box_shadow_box_shadow_type = 'yes';
      targetSettings.box_shadow_box_shadow = d.boxShadow;
    }
  }

  return snap;
}

// ===== CORE BUSINESS LOGIC =====

export async function parseHtmlWithSandbox(
  rawHtml: string,
  assetMap: Map<string, string> = new Map(),
  settings?: ConverterSettings
): Promise<ParseStageOutput> {
  if (!rawHtml || !rawHtml.trim()) {
    throw new Error('محتوای HTML ورودی خالی است.');
  }

  // Run Pre-Conversion Computed Style & SVG Vector Resolution Pass on untouched DOM
  const { annotatedRawHtml, computedDimensionsMap } =
    await extractComputedDimensionsBeforeJsonConversion(
      rawHtml,
      assetMap,
      settings
    );

  const includeHeaderFooter = Boolean(settings?.includeHeaderFooter);
  const placeholders: PlaceholderEntry[] = [];
  const excludedSections: ExcludedSectionEntry[] = [];
  const fontsSet = new Set<string>();

  const previewParser = new DOMParser();
  const previewDoc = previewParser.parseFromString(rawHtml, 'text/html');
  const sanitizedPreviewHtml =
    '<!DOCTYPE html>\n' + previewDoc.documentElement.outerHTML;

  const parser = new DOMParser();
  const preDoc = parser.parseFromString(rawHtml, 'text/html');

  // Requirement 1: Separate <header>, <nav>, .rail, <footer> unless includeHeaderFooter is enabled
  const checkAndRecordExcluded = (el: Element, reason: string) => {
    const tag = el.tagName.toLowerCase();
    const idStr = el.id ? `#${el.id}` : '';
    const clsStr = el.classList.length
      ? `.${Array.from(el.classList).slice(0, 3).join('.')}`
      : '';
    excludedSections.push({
      tag,
      identifier: `${tag}${idStr}${clsStr}`,
      reason,
    });
    el.remove();
  };

  // 0a. Hoist any <style> tags placed inside <body> or *-system into <head> BEFORE removing *-system,
  // so that the measurement sandbox iframe has 100% of the page's CSS rules for grid/flex layouts and colors!
  preDoc
    .querySelectorAll('body style, [class*="-system"] style')
    .forEach((styleEl) => {
      preDoc.head.appendChild(styleEl);
    });

  // Always exclude .rail, *-skip, *-system and standalone floating nav-panel/mobile-nav
  preDoc
    .querySelectorAll(
      '.rail, nav.mobile-nav, .nav-panel, .skip-link, [class*="-skip"], [class*="-system"]'
    )
    .forEach((el) => {
      checkAndRecordExcluded(
        el,
        'نوار ناوبری شناور / بلوک سیستمی و لینک پرش دسترس‌پذیری (.rail / *-skip / *-system) طبق استاندارد قالب صفحه حذف و در گزارش ثبت شد.'
      );
    });

  if (!includeHeaderFooter) {
    preDoc
      .querySelectorAll(
        'body > header, main > header, [class*="-page"] > header, body > div > header, .site-header, .ga-header, .gf-header, .gc-header, body > nav'
      )
      .forEach((el) => {
        checkAndRecordExcluded(
          el,
          'هدر/ناوبری بالای صفحه (<header> / <nav>) به‌صورت پیش‌فرض وارد JSON برگه نشد (از طریق تنظیمات «شامل هدر/فوتر» قابل فعال‌سازی است).'
        );
      });

    preDoc
      .querySelectorAll(
        'body > footer, main > footer, [class*="-page"] > footer, body > div > footer, .site-footer, .ga-footer, .gf-footer, .gc-footer'
      )
      .forEach((el) => {
        checkAndRecordExcluded(
          el,
          'فوتر صفحه (<footer>) به‌صورت پیش‌فرض وارد JSON برگه نشد (از طریق تنظیمات «شامل هدر/فوتر» قابل فعال‌سازی است).'
        );
      });
  }

  // 0b. Normalize pre-existing Elementor-like HTML markup (.elementor-widget wrappers):
  // - Transfer custom classes (e.g. gf-eyebrow, ga-eyebrow, gf-hero-title, gf-button, gf-question)
  //   from the outer .elementor-widget wrapper down to the inner semantic element (h1..h6, p, a, button)
  // - Keep .elementor-widget-text-editor (e.g. .gf-answer with <p> + <ul>) intact as a single text-editor widget
  // - Mark rich .elementor-widget-html blocks (containing SVG illustrations, sticky filter/search bar, aside card)
  //   with data-el-html-widget="true" so they are preserved intact without breaking SVGs or interactive controls.
  preDoc.querySelectorAll('.elementor-widget').forEach((widgetWrap) => {
    const rawClasses = Array.from(widgetWrap.classList);
    if (
      rawClasses.some((c) => c.endsWith('-system') || c.endsWith('-skip'))
    ) {
      widgetWrap.remove();
      return;
    }

    const customClasses = rawClasses.filter(
      (c) => !ELEMENTOR_INTERNAL_CLASSES.has(c)
    );
    const container =
      widgetWrap.querySelector(':scope > .elementor-widget-container') ||
      widgetWrap;

    if (widgetWrap.classList.contains('elementor-widget-html')) {
      const rawInner = container.innerHTML.trim();
      if (rawInner) {
        widgetWrap.setAttribute('data-el-html-widget', 'true');
        widgetWrap.setAttribute('data-raw-html-content', rawInner);
      }
      return;
    }

    if (widgetWrap.classList.contains('elementor-widget-text-editor')) {
      const rawInner = container.innerHTML.trim();
      if (rawInner) {
        widgetWrap.setAttribute('data-el-text-editor-widget', 'true');
        widgetWrap.setAttribute('data-raw-text-editor-html', rawInner);
      }
      return;
    }

    const isHeadingWidget = widgetWrap.classList.contains(
      'elementor-widget-heading'
    );
    const isButtonWidget = widgetWrap.classList.contains(
      'elementor-widget-button'
    );

    let semanticTarget: Element | null = null;
    if (isHeadingWidget) {
      semanticTarget = container.querySelector(
        'h1, h2, h3, h4, h5, h6, p, .elementor-heading-title'
      );
      if (
        semanticTarget &&
        !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(
          semanticTarget.tagName.toUpperCase()
        )
      ) {
        semanticTarget.setAttribute('data-el-heading-p', 'true');
      }
    } else if (isButtonWidget) {
      semanticTarget = container.querySelector('a, button, .elementor-button');
      if (semanticTarget) {
        semanticTarget.setAttribute('data-el-button-widget', 'true');
      }
    } else if (container.children.length === 1) {
      semanticTarget = container.children[0];
    }

    if (semanticTarget) {
      customClasses.forEach((cls) => semanticTarget!.classList.add(cls));
      if (widgetWrap.id && !semanticTarget.id) {
        semanticTarget.id = widgetWrap.id;
      }
    }
  });

  // 1. Annotate elements that contain <svg><use href="#i-..."></svg> with data-fa-icon
  preDoc.querySelectorAll('svg use').forEach((useEl) => {
    const href = (
      useEl.getAttribute('href') ||
      useEl.getAttribute('xlink:href') ||
      ''
    ).trim();
    const mappedFa = SVG_ICON_TO_FA_MAP[href];
    if (mappedFa) {
      const svg = useEl.closest('svg');
      const host = svg?.parentElement;
      if (host && !host.getAttribute('data-fa-icon')) {
        host.setAttribute('data-fa-icon', mappedFa);
      }
      const cardHost = svg?.closest(
        '.s-card, .b-item, .process__step, .roadmap__card, .capabilities__item, .p-notice, .p-card--custom, .hv__card, .btn'
      );
      if (cardHost && !cardHost.getAttribute('data-fa-icon')) {
        cardHost.setAttribute('data-fa-icon', mappedFa);
      }
    }
  });

  // 1b. Annotate Google Material Symbols (.material-symbols-outlined / .material-icons / [data-icon])
  // First detect star rating rows (3+ star icons in one container)
  preDoc.querySelectorAll('div, span').forEach((container) => {
    const directMaterialStars = Array.from(container.children).filter(
      (ch) =>
        (ch.classList.contains('material-symbols-outlined') ||
          ch.classList.contains('material-icons')) &&
        ((ch.getAttribute('data-icon') || ch.textContent || '').trim() === 'star')
    );
    if (directMaterialStars.length >= 3) {
      container.setAttribute('data-star-rating', String(directMaterialStars.length));
      directMaterialStars.forEach((s) => s.remove());
    }
  });

  // Map remaining Material Symbols to FontAwesome 5 (data-fa-icon) and remove the ligature span so raw icon names never appear in text
  preDoc
    .querySelectorAll('.material-symbols-outlined, .material-icons, [data-icon]')
    .forEach((iconEl) => {
      const rawIconName = (
        iconEl.getAttribute('data-icon') ||
        iconEl.textContent ||
        ''
      )
        .trim()
        .toLowerCase();

      // Skip expand_more inside <summary> since Elementor Accordion already provides its own toggle icon
      if (rawIconName === 'expand_more' && iconEl.closest('summary')) {
        iconEl.remove();
        return;
      }

      const mappedFa =
        MATERIAL_ICON_TO_FA_MAP[rawIconName] || 'fas fa-check-circle';
      const parent = iconEl.parentElement;
      if (parent && !parent.getAttribute('data-fa-icon')) {
        parent.setAttribute('data-fa-icon', mappedFa);
      }
      const actionableHost = iconEl.closest('a, button, li');
      if (actionableHost && !actionableHost.getAttribute('data-fa-icon')) {
        actionableHost.setAttribute('data-fa-icon', mappedFa);
      }
      iconEl.remove();
    });

  // 2. Unwrap <noscript> blocks that provide fallback cards for dynamic API grids
  preDoc.querySelectorAll('noscript').forEach((ns) => {
    const innerHtml = ns.innerHTML || ns.textContent || '';
    if (innerHtml && (innerHtml.includes('<div') || innerHtml.includes('<article'))) {
      const temp = preDoc.createElement('div');
      temp.innerHTML = innerHtml;
      const parent = ns.parentNode;
      if (parent) {
        while (temp.firstChild) {
          parent.insertBefore(temp.firstChild, ns);
        }
      }
    }
    ns.remove();
  });

  // 3. Handle SVGs per Requirement 5:
  // - SVGs inside [data-el-html-widget="true"] are kept intact as inline vector HTML
  // - Small inline SVG icons inside <a>, <button>, <li>, <summary>, <label>, <h1..h6>, <p> are mapped to data-fa-icon (not turned into <img>!)
  // - Circuit/decorative SVGs ([data-circuit]) are converted into decorative placeholder divs so they become spacer/divider + _css_classes
  // - Standalone content SVGs are serialized to both data:image/svg+xml and data-raw-svg so WordPress never shows broken images
  preDoc.querySelectorAll('svg').forEach((svgEl, sIdx) => {
    if (svgEl.closest('[data-el-html-widget="true"]')) {
      return;
    }

    if (svgEl.classList.contains('sprite') || svgEl.querySelector('symbol')) {
      svgEl.remove();
      return;
    }

    if (svgEl.hasAttribute('data-circuit') || svgEl.classList.contains('hv__circuits')) {
      const decorDiv = preDoc.createElement('div');
      Array.from(svgEl.classList).forEach((c) => decorDiv.classList.add(c));
      if (svgEl.id) decorDiv.id = svgEl.id;
      if (svgEl.hasAttribute('data-circuit')) {
        decorDiv.setAttribute(
          'data-circuit',
          svgEl.getAttribute('data-circuit') || ''
        );
      }
      decorDiv.setAttribute('data-decorative-node', 'true');
      svgEl.replaceWith(decorDiv);
      return;
    }

    // If it's a small icon using <use href="#i-...">, we already mapped it to FontAwesome
    if (svgEl.querySelector('use')) {
      svgEl.remove();
      return;
    }

    // Never turn an inline SVG icon inside a button, link, heading, paragraph, or list item into an <img>!
    const inlineHost = svgEl.closest('a, button, summary, label, h1, h2, h3, h4, h5, h6, p');
    if (inlineHost) {
      const svgCls = (svgEl.getAttribute('class') || '').toLowerCase();
      let faGuess = '';
      if (svgCls.includes('shopping-bag') || svgCls.includes('cart')) {
        faGuess = 'fas fa-shopping-cart';
      } else if (svgCls.includes('user')) {
        faGuess = 'fas fa-user';
      } else if (svgCls.includes('bars') || svgCls.includes('menu')) {
        faGuess = 'fas fa-bars';
      } else if (svgCls.includes('arrow-left')) {
        faGuess = 'fas fa-arrow-left';
      } else if (svgCls.includes('check')) {
        faGuess = 'fas fa-check';
      }
      if (faGuess && !inlineHost.getAttribute('data-fa-icon')) {
        inlineHost.setAttribute('data-fa-icon', faGuess);
      }
      svgEl.remove();
      return;
    }

    // Content SVG (e.g. .p-card__art-svg or standalone vector illustration)
    const parentInCard = svgEl.closest('.p-card__art');
    if (parentInCard) {
      svgEl.remove();
      return;
    }

    const cloneSvg = svgEl.cloneNode(true) as SVGElement;
    if (!cloneSvg.getAttribute('xmlns')) {
      cloneSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const serialized = new XMLSerializer().serializeToString(cloneSvg);
    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(serialized)}`;

    const imgReplacement = preDoc.createElement('img');
    imgReplacement.setAttribute('src', svgDataUri);
    imgReplacement.setAttribute('data-raw-svg', serialized);
    imgReplacement.setAttribute('alt', svgEl.getAttribute('aria-label') || `vector-svg-${sIdx + 1}`);
    Array.from(svgEl.classList).forEach((c) => imgReplacement.classList.add(c));
    if (svgEl.id) imgReplacement.id = svgEl.id;
    svgEl.replaceWith(imgReplacement);

    placeholders.push({
      type: 'svg',
      element: `svg${svgEl.id ? '#' + svgEl.id : '.' + Array.from(svgEl.classList).join('.')}`,
      placeholderValue: 'Inline SVG / Vector Graphic',
      description: 'گرافیک برداری <svg> محتوایی با حفظ کامل کدهای برداری منتقل شد.',
    });
  });

  // 3b. Synthesize Tailwind CSS rules (from tailwind.config + utility classes) BEFORE removing <script> tags
  const synthesizedTailwindCss = synthesizeTailwindStylesheet(preDoc);
  if (synthesizedTailwindCss) {
    const twStyle = preDoc.createElement('style');
    twStyle.setAttribute('data-tailwind-synthesized', 'true');
    twStyle.textContent = synthesizedTailwindCss;
    preDoc.head.appendChild(twStyle);
  }

  // 4. Remove script tags and non-visual chrome
  preDoc.querySelectorAll('script').forEach((s) => s.remove());
  preDoc
    .querySelectorAll(
      '[hidden], [data-skeleton], .sprite, .skip-link, [class*="-skip"], [class*="-system"], .scroll-progress, .cursor-aura, .to-top'
    )
    .forEach((el) => el.remove());

  // 5. Inject helper style tag so scroll-reveal elements ([data-reveal], [data-split], *-reveal) are 100% visible & unshifted
  const overrideStyle = preDoc.createElement('style');
  overrideStyle.textContent = `
    .reveal, [data-reveal], [data-split], [class*="-reveal"], .gf-reveal, .ga-reveal, .gc-reveal, .gs-reveal, .anim-in, .w, .w__i, .hero__content, .hero__visual, .g-tile, .g-tile__img, .cc__tag {
      opacity: 1 !important;
      transform: none !important;
      translate: none !important;
      scale: 1 !important;
      clip-path: none !important;
      visibility: visible !important;
      animation: none !important;
    }
    .site-header {
      position: relative !important;
    }
  `;
  preDoc.head.appendChild(overrideStyle);

  // 6. Resolve images in preDoc using strict order: data-src -> srcset -> data-fallback -> src (Requirement 7)
  const images = Array.from(preDoc.querySelectorAll('img'));
  images.forEach((img, idx) => {
    const resolvedSrc = resolvePriorityImageSrc(img);
    const widthAttr = parseInt(img.getAttribute('width') || '600', 10) || 600;
    const heightAttr = parseInt(img.getAttribute('height') || '400', 10) || 400;

    if (!resolvedSrc || resolvedSrc.startsWith('data:image/gif;base64,R0lGOD')) {
      const placeholderUrl = `https://placehold.co/${widthAttr}x${heightAttr}?text=Replace+Image`;
      img.setAttribute('src', placeholderUrl);
      img.setAttribute('data-elementor-placeholder', 'true');
      placeholders.push({
        type: 'image',
        element: `img#${img.id || idx + 1}`,
        placeholderValue: placeholderUrl,
        description:
          'تصویر ۱ پیکسلی (data:image/gif) یا فاقد آدرس پس از بررسی (data-src → srcset → data-fallback → src) با Placeholder جایگزین شد.',
      });
      return;
    }

    if (
      !resolvedSrc.startsWith('http://') &&
      !resolvedSrc.startsWith('https://') &&
      !resolvedSrc.startsWith('data:') &&
      !resolvedSrc.startsWith('//')
    ) {
      const normalizedKey = normalizeAssetPath(resolvedSrc);
      const fileNameOnly = normalizedKey.split('/').pop() || normalizedKey;
      const matchedDataUrl =
        assetMap.get(normalizedKey) || assetMap.get(fileNameOnly);

      if (matchedDataUrl) {
        img.setAttribute('src', matchedDataUrl);
      } else {
        const placeholderUrl = `https://placehold.co/${widthAttr}x${heightAttr}?text=Replace+Image`;
        img.setAttribute('src', placeholderUrl);
        img.setAttribute('data-elementor-placeholder', 'true');
        img.setAttribute('data-original-src', resolvedSrc);
        placeholders.push({
          type: 'image',
          element: `img (${resolvedSrc})`,
          placeholderValue: placeholderUrl,
          description: `مسیر نسبی تصویر «${resolvedSrc}» در فایل‌ها یافت نشد؛ با Placeholder استاندارد جایگزین گردید.`,
        });
      }
    } else {
      img.setAttribute('src', resolvedSrc);
    }
  });

  // 7. Normalize empty/missing links
  preDoc.querySelectorAll('a').forEach((anchor, idx) => {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href || href.startsWith('javascript:')) {
      anchor.setAttribute('href', '#');
      placeholders.push({
        type: 'link',
        element: `a (${(anchor.textContent || '').trim().slice(0, 25) || idx + 1})`,
        placeholderValue: '#',
        description: 'لینک نامشخص یا جاوااسکریپتی با Placeholder استاندارد «#» جایگزین شد.',
      });
    }
  });

  const measurementHtml = '<!DOCTYPE html>\n' + preDoc.documentElement.outerHTML;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.className = 'fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none border-0';
  iframe.style.width = `${DESKTOP_WIDTH}px`;
  iframe.style.height = '3200px';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      throw new Error('عدم امکان ایجاد محیط Sandbox برای تحلیل استایل‌های واقعی.');
    }

    iframeDoc.open();
    iframeDoc.write(measurementHtml);
    iframeDoc.close();

    await new Promise((resolve) => setTimeout(resolve, 75));

    // Propagate background from decorative .bg children (like .benefits__bg, .cta-panel__bg) to their parent section
    iframeDoc
      .querySelectorAll('.benefits__bg, .cta-panel__bg, .hero__bg')
      .forEach((bgChild) => {
        const parent = bgChild.parentElement;
        if (!parent) return;
        const bgCs = iframeWin.getComputedStyle(bgChild);
        const parentCs = iframeWin.getComputedStyle(parent);
        if (
          (!normalizeColor(parentCs.backgroundColor) &&
            normalizeColor(bgCs.backgroundColor)) ||
          (parentCs.backgroundImage === 'none' &&
            bgCs.backgroundImage !== 'none')
        ) {
          if (normalizeColor(bgCs.backgroundColor)) {
            (parent as HTMLElement).style.backgroundColor = bgCs.backgroundColor;
          }
          if (bgCs.backgroundImage !== 'none') {
            (parent as HTMLElement).style.backgroundImage = bgCs.backgroundImage;
          }
        }
      });

    let uidCounter = 1;
    const uidToElement = new Map<string, Element>();
    const allElements = Array.from(iframeDoc.body.querySelectorAll('*'));
    for (const el of allElements) {
      if (shouldIgnoreElement(el)) continue;

      const uid = `node_${uidCounter++}`;
      el.setAttribute('data-el-uid', uid);
      uidToElement.set(uid, el);
    }

    const bodyCs = iframeWin.getComputedStyle(iframeDoc.body);
    const htmlCs = iframeWin.getComputedStyle(iframeDoc.documentElement);
    const bodyBackgroundColor =
      normalizeColor(bodyCs.backgroundColor) ||
      normalizeColor(htmlCs.backgroundColor) ||
      '#FFFFFF';

    // 1. Measure Desktop (1440px)
    const desktopMap = new Map<
      string,
      { rect: { x: number; y: number; width: number; height: number }; styles: ComputedBoxStyle }
    >();

    uidToElement.forEach((el, uid) => {
      const computed = computeStyleForElement(el, iframeWin);
      desktopMap.set(uid, computed);

      const { primaryFont, isCustomFont } = extractPrimaryFont(
        computed.styles.fontFamily
      );
      if (isCustomFont && primaryFont) {
        fontsSet.add(primaryFont);
      }
    });

    uidToElement.forEach((el, uid) => {
      if (
        el.tagName.toUpperCase() === 'IMG' &&
        el.getAttribute('data-elementor-placeholder') === 'true'
      ) {
        const d = desktopMap.get(uid);
        if (d && d.rect.width > 20 && d.rect.height > 20) {
          const w = Math.round(d.rect.width);
          const h = Math.round(d.rect.height);
          const updatedUrl = `https://placehold.co/${w}x${h}?text=Replace+Image`;
          el.setAttribute('src', updatedUrl);
        }
      }
    });

    // 2. Measure Tablet (768px)
    iframe.style.width = `${TABLET_WIDTH}px`;
    await new Promise((resolve) => setTimeout(resolve, 40));

    const tabletMap = new Map<string, ResponsiveStyleOverrides>();
    uidToElement.forEach((el, uid) => {
      const desktop = desktopMap.get(uid);
      if (!desktop) return;
      const tab = computeStyleForElement(el, iframeWin);
      const overrides: ResponsiveStyleOverrides = {};

      if (tab.styles.fontSizePx !== desktop.styles.fontSizePx) {
        overrides.fontSizePx = tab.styles.fontSizePx;
      }
      if (tab.styles.lineHeightPx !== desktop.styles.lineHeightPx) {
        overrides.lineHeightPx = tab.styles.lineHeightPx;
      }
      if (edgesDiffer(tab.styles.padding, desktop.styles.padding)) {
        overrides.padding = tab.styles.padding;
      }
      if (edgesDiffer(tab.styles.margin, desktop.styles.margin)) {
        overrides.margin = tab.styles.margin;
      }
      if (tab.styles.textAlign !== desktop.styles.textAlign) {
        overrides.textAlign = tab.styles.textAlign;
      }
      if (tab.styles.flexDirection !== desktop.styles.flexDirection) {
        overrides.flexDirection = tab.styles.flexDirection;
      }
      if (tab.styles.gapPx !== desktop.styles.gapPx) {
        overrides.gapPx = tab.styles.gapPx;
      }
      tabletMap.set(uid, overrides);
    });

    // 3. Measure Mobile (375px)
    iframe.style.width = `${MOBILE_WIDTH}px`;
    await new Promise((resolve) => setTimeout(resolve, 40));

    const mobileMap = new Map<string, ResponsiveStyleOverrides>();
    uidToElement.forEach((el, uid) => {
      const desktop = desktopMap.get(uid);
      if (!desktop) return;
      const mob = computeStyleForElement(el, iframeWin);
      const overrides: ResponsiveStyleOverrides = {};

      if (mob.styles.fontSizePx !== desktop.styles.fontSizePx) {
        overrides.fontSizePx = mob.styles.fontSizePx;
      }
      if (mob.styles.lineHeightPx !== desktop.styles.lineHeightPx) {
        overrides.lineHeightPx = mob.styles.lineHeightPx;
      }
      if (edgesDiffer(mob.styles.padding, desktop.styles.padding)) {
        overrides.padding = mob.styles.padding;
      }
      if (edgesDiffer(mob.styles.margin, desktop.styles.margin)) {
        overrides.margin = mob.styles.margin;
      }
      if (mob.styles.textAlign !== desktop.styles.textAlign) {
        overrides.textAlign = mob.styles.textAlign;
      }
      if (mob.styles.flexDirection !== desktop.styles.flexDirection) {
        overrides.flexDirection = mob.styles.flexDirection;
      }
      if (mob.styles.gapPx !== desktop.styles.gapPx) {
        overrides.gapPx = mob.styles.gapPx;
      }
      mobileMap.set(uid, overrides);
    });

    const buildNode = (el: Element): ParsedDOMNode | null => {
      if (shouldIgnoreElement(el)) return null;

      // If this element is a standard .elementor-widget wrapper (not data-el-html-widget / data-el-text-editor-widget)
      // or .elementor-widget-container with a single child, unwrap directly to its child.
      const isElWidgetWrapper =
        (el.classList.contains('elementor-widget') &&
          !el.hasAttribute('data-el-html-widget') &&
          !el.hasAttribute('data-el-text-editor-widget')) ||
        el.classList.contains('elementor-widget-container');

      if (isElWidgetWrapper && el.children.length === 1) {
        return buildNode(el.children[0]);
      }

      const tag = el.tagName.toUpperCase();
      const uid = el.getAttribute('data-el-uid') || '';
      const desktop = desktopMap.get(uid);
      if (!desktop) return null;

      const isDecorative =
        isDecorativeLayerElement(el) ||
        el.getAttribute('data-decorative-node') === 'true';

      const isHtmlWidgetBlock =
        el.getAttribute('data-el-html-widget') === 'true' ||
        el.getAttribute('data-el-text-editor-widget') === 'true';

      if (desktop.styles.display === 'none' && !isDecorative && !isHtmlWidgetBlock) {
        return null;
      }

      const attrs: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.name !== 'data-el-uid') {
          attrs[attr.name] = attr.value;
        }
      }

      const childNodes: ParsedDOMNode[] = [];
      if (!isDecorative && !isHtmlWidgetBlock) {
        for (let i = 0; i < el.children.length; i++) {
          const parsedChild = buildNode(el.children[i]);
          if (parsedChild) {
            childNodes.push(parsedChild);
          }
        }
      }

      const filteredClassList = Array.from(el.classList).filter(
        (cls) => !ELEMENTOR_INTERNAL_CLASSES.has(cls)
      );

      return {
        uid,
        tag: tag.toLowerCase(),
        idAttr: el.id || '',
        classList: filteredClassList,
        textContent: isDecorative ? '' : getCleanVisibleText(el),
        directText: isDecorative ? '' : getDirectTextContent(el),
        innerHTMLClean: isDecorative ? '' : sanitizeInlineHtml(el),
        attributes: attrs,
        rect: desktop.rect,
        styles: desktop.styles,
        tabletOverrides: tabletMap.get(uid) || {},
        mobileOverrides: mobileMap.get(uid) || {},
        children: childNodes,
        isDecorative,
      };
    };

    const rootNodes: ParsedDOMNode[] = [];
    for (let i = 0; i < iframeDoc.body.children.length; i++) {
      const child = iframeDoc.body.children[i];
      const built = buildNode(child);
      if (built) {
        rootNodes.push(built);
      }
    }

    if (rootNodes.length === 0 && (iframeDoc.body.textContent || '').trim()) {
      const fallbackComputed = computeStyleForElement(iframeDoc.body, iframeWin);
      rootNodes.push({
        uid: 'node_body_fallback',
        tag: 'p',
        idAttr: '',
        classList: [],
        textContent: (iframeDoc.body.textContent || '').trim(),
        directText: (iframeDoc.body.textContent || '').trim(),
        innerHTMLClean: sanitizeInlineHtml(iframeDoc.body),
        attributes: {},
        rect: fallbackComputed.rect,
        styles: fallbackComputed.styles,
        tabletOverrides: {},
        mobileOverrides: {},
        children: [],
      });
    }

    return {
      rootNodes,
      bodyBackgroundColor,
      fontsDetected: Array.from(fontsSet),
      placeholders,
      excludedSections,
      sanitizedPreviewHtml,
      annotatedRawHtml,
      computedDimensionsMap,
    };
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
