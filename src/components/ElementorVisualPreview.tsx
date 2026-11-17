// ===== IMPORTS & DEPENDENCIES =====
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns2,
  Eye,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Sparkles,
  Tablet,
} from 'lucide-react';
import {
  ElementorDimension,
  ElementorNode,
  ElementorTemplateJSON,
  ExtractedSvgAsset,
} from '../types/elementor';

// ===== TYPES & INTERFACES =====
export type SimulatorViewportMode = 'desktop' | 'tablet' | 'mobile' | 'split';
type SingleDevice = 'desktop' | 'tablet' | 'mobile';

interface ElementorVisualPreviewProps {
  template: ElementorTemplateJSON;
  extraCss?: string;
  extraJs?: string;
  extractedSvgs?: ExtractedSvgAsset[];
}

// ===== CONFIGURATION & CONSTANTS =====

const FA_ICON_SYMBOL_MAP: Record<string, string> = {
  'fas fa-cube': '⬢',
  'fas fa-phone-alt': '📞',
  'fas fa-phone': '☎',
  'fas fa-arrow-left': '←',
  'fas fa-arrow-right': '→',
  'fas fa-magic': '✨',
  'fas fa-play-circle': '▶',
  'fas fa-lock': '🔒',
  'fas fa-rocket': '🚀',
  'fas fa-gem': '◆',
  'fas fa-network-wired': '❖',
  'fas fa-coins': '◈',
  'fas fa-cloud': '☁',
  'fas fa-bolt': '⚡',
  'fas fa-shield-alt': '🛡',
  'fas fa-layer-group': '❖',
  'fas fa-building': '🏢',
  'fas fa-check-circle': '✔',
  'fas fa-check': '✓',
  'fas fa-shopping-cart': '🛒',
  'fas fa-code': '⟨/⟩',
  'fas fa-palette': '🎨',
  'fas fa-tachometer-alt': '⚡',
  'fas fa-headset': '🎧',
  'fas fa-user-shield': '🛡',
  'fas fa-pencil-ruler': '✎',
  'fas fa-sync-alt': '↻',
  'fas fa-times-circle': '✖',
  'fas fa-exclamation-triangle': '⚠',
  'fas fa-shield-virus': '⊘',
  'fas fa-copy': '❐',
  'fas fa-phone-slash': '✕',
  'fas fa-star': '★',
  'fas fa-chart-line': '📈',
  'fas fa-eye': '👁',
  'fas fa-search-plus': '🔍',
  'fas fa-pen-nib': '✒',
  'fas fa-terminal': '⌘',
  'fas fa-tags': '🏷',
  'fas fa-calculator': '⊞',
  'fas fa-paper-plane': '➤',
  'fas fa-chevron-down': '▼',
  'fas fa-chevron-up': '▲',
  'fas fa-at': '@',
  'fas fa-share-alt': '↗',
  'fas fa-map-marker-alt': '📍',
  'fas fa-envelope': '✉',
  'fas fa-dot-circle': '◉',
  'far fa-circle': '○',
  'fas fa-check-square': '☑',
  'far fa-square': '☐',
  'fas fa-user-circle': '👤',
  'far fa-user': '👤',
  'fas fa-shopping-bag': '🛍',
  'fas fa-bars': '☰',
  'fas fa-plug': '🔌',
  'fas fa-microchip': '❖',
};

// ===== UTILITY FUNCTIONS =====

function escapeHtmlAttr(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveFaSymbol(iconObj: unknown, fallback = ''): string {
  if (!iconObj || typeof iconObj !== 'object') return fallback;
  const val = (iconObj as { value?: string }).value || '';
  if (!val) return fallback;
  return FA_ICON_SYMBOL_MAP[val] || fallback;
}

function createFallbackMockupDataUrl(label: string): string {
  const safeText = (label || 'پیش‌نمایش پروژه و رابط کاربری اختصاصی')
    .slice(0, 48)
    .replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090e1c"/>
        <stop offset="50%" stop-color="#161b2a"/>
        <stop offset="100%" stop-color="#1d4ed8"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)"/>
    <rect x="56" y="48" width="688" height="404" rx="20" fill="#0e1321" fill-opacity="0.82" stroke="#00d2ff" stroke-opacity="0.32" stroke-width="1.5"/>
    <text x="400" y="260" text-anchor="middle" fill="#a5e7ff" font-family="Tahoma, sans-serif" font-size="18" font-weight="bold">${safeText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function dimToCss(dim: unknown, allowAllZeros = false): string | undefined {
  if (!dim || typeof dim !== 'object') return undefined;
  const d = dim as ElementorDimension;
  const top = Number(d.top || 0);
  const right = Number(d.right || 0);
  const bottom = Number(d.bottom || 0);
  const left = Number(d.left || 0);
  if (!allowAllZeros && top === 0 && right === 0 && bottom === 0 && left === 0) {
    return undefined;
  }
  const u = d.unit || 'px';
  return `${top}${u} ${right}${u} ${bottom}${u} ${left}${u}`;
}

function sizeToCss(sizeObj: unknown): string | undefined {
  if (!sizeObj || typeof sizeObj !== 'object') return undefined;
  const s = sizeObj as { size?: number | string; unit?: string };
  if (s.size === undefined || s.size === '') return undefined;
  const u = s.unit || 'px';
  return `${s.size}${u}`;
}

function isDecorativeSpacerNode(node: ElementorNode): boolean {
  if (node.elType !== 'widget' || node.widgetType !== 'spacer') return false;
  const cls = String(node.settings?._css_classes || '').toLowerCase();
  if (!cls) return false;
  return /(ambient-glow|blur-|particles|aurora|beam|blueprint|circuit|__bg|__light|__decor|__spot|pointer-events-none|-z-10|grid-bg|noise)/.test(
    cls
  );
}

/**
 * Generates Elementor-style CSS rules for a node's settings, scoped to `.elementor-element.elementor-element-<id>`
 * so that `extra.css` can naturally cascade or override without inline `style=""` specificity conflicts.
 */
function buildNodeInlineCssRules(
  node: ElementorNode,
  desktopRules: string[],
  tabletRules: string[],
  mobileRules: string[],
  applyHybridCss: boolean
): void {
  const s = node.settings || {};
  const rawSel = `.elementor-element.elementor-element-${node.id}`;
  const sel = `:where(${rawSel})`;
  const isWidget = node.elType === 'widget';
  const userClasses = String(s.css_classes || s._css_classes || '').trim();
  const isNativeDisplayContentsWidget =
    isWidget && userClasses.includes('el-native-');
  const targetBoxSel = isWidget
    ? isNativeDisplayContentsWidget
      ? sel
      : `:where(${rawSel} > .elementor-widget-container)`
    : node.elType === 'column'
    ? `:where(${rawSel} > .elementor-widget-wrap)`
    : sel;

  const hasCustomAuthorClasses =
    applyHybridCss &&
    userClasses
      .split(/\s+/)
      .some(
        (c) =>
          Boolean(c) &&
          !c.startsWith('elementor-') &&
          !c.startsWith('e-') &&
          !c.startsWith('el-')
      );

  const boxProps: string[] = [];
  const boxTabletProps: string[] = [];
  const boxMobileProps: string[] = [];

  // Background
  const bgType =
    (s.background_background as string) ||
    (s._background_background as string);
  const bgColor =
    (s.background_color as string) || (s._background_color as string);
  const bgColorB =
    (s.background_color_b as string) || (s._background_color_b as string);
  const bgAngle =
    (s.background_gradient_angle as { size?: number } | undefined)?.size ??
    (s._background_gradient_angle as { size?: number } | undefined)?.size ??
    135;
  const bgImageObj = (s.background_image || s._background_image) as
    | { url?: string }
    | undefined;
  const overlayBg = s.background_overlay_background as string | undefined;
  const overlayColorA = s.background_overlay_color as string | undefined;
  const overlayColorB = s.background_overlay_color_b as string | undefined;

  if (node.widgetType !== 'button') {
    if (bgImageObj?.url) {
      if (overlayBg === 'gradient' && overlayColorA && overlayColorB) {
        boxProps.push(
          `background-image: linear-gradient(180deg, ${overlayColorA} 10%, ${overlayColorB} 100%), url("${bgImageObj.url}")`
        );
      } else {
        boxProps.push(`background-image: url("${bgImageObj.url}")`);
      }
      boxProps.push(
        `background-size: ${(s.background_size as string) || 'cover'}`
      );
      boxProps.push(
        `background-position: ${(s.background_position as string) || 'center center'}`
      );
      boxProps.push(
        `background-repeat: ${(s.background_repeat as string) || 'no-repeat'}`
      );
      if (bgColor) boxProps.push(`background-color: ${bgColor}`);
    } else if (bgType === 'gradient' && bgColor && bgColorB) {
      boxProps.push(
        `background: linear-gradient(${bgAngle}deg, ${bgColor}, ${bgColorB})`
      );
    } else if (
      bgColor &&
      bgColor !== '#00000000' &&
      bgColor !== 'transparent' &&
      !hasCustomAuthorClasses
    ) {
      boxProps.push(`background-color: ${bgColor}`);
    }
  }

  // Padding & Margin (emitted with :where() specificity so page.json settings always apply as baseline and extra.css @media/:hover cleanly cascades)
  const pad = dimToCss(s.padding || s._padding);
  if (pad) boxProps.push(`padding: ${pad}`);

  const padTab = dimToCss(s.padding_tablet || s._padding_tablet, Boolean(pad));
  if (padTab && padTab !== pad) boxTabletProps.push(`padding: ${padTab}`);

  const padMob = dimToCss(s.padding_mobile || s._padding_mobile, Boolean(pad || padTab));
  if (padMob && padMob !== pad) boxMobileProps.push(`padding: ${padMob}`);

  const mar = dimToCss(s.margin || s._margin);
  if (mar) boxProps.push(`margin: ${mar}`);
  if (s._margin_inline_auto) {
    boxProps.push(`margin-left: auto`, `margin-right: auto`);
    boxTabletProps.push(`margin-left: auto`, `margin-right: auto`);
    boxMobileProps.push(`margin-left: auto`, `margin-right: auto`);
  }

  const marTab = dimToCss(s.margin_tablet || s._margin_tablet, Boolean(mar));
  if (marTab && marTab !== mar) boxTabletProps.push(`margin: ${marTab}`);

  const marMob = dimToCss(s.margin_mobile || s._margin_mobile, Boolean(mar || marTab));
  if (marMob && marMob !== mar) boxMobileProps.push(`margin: ${marMob}`);

  // Border & Radius
  const borderStyle =
    (s.border_border as string) || (s._border_border as string);
  const borderWidth = dimToCss(s.border_width || s._border_width);
  const borderColor =
    (s.border_color as string) || (s._border_color as string);

  if (
    node.widgetType !== 'button' &&
    !hasCustomAuthorClasses &&
    borderStyle &&
    borderStyle !== 'none' &&
    borderWidth
  ) {
    boxProps.push(`border-style: ${borderStyle}`);
    boxProps.push(`border-width: ${borderWidth}`);
    if (borderColor) boxProps.push(`border-color: ${borderColor}`);
  }

  const radius = dimToCss(s.border_radius || s._border_radius);
  if (node.widgetType !== 'button' && !hasCustomAuthorClasses && radius) {
    boxProps.push(`border-radius: ${radius}`);
  }

  // Box Shadow
  const shadow = (s.box_shadow_box_shadow || s._box_shadow_box_shadow) as
    | {
        horizontal?: number;
        vertical?: number;
        blur?: number;
        spread?: number;
        color?: string;
      }
    | undefined;
  if (shadow && shadow.color && !hasCustomAuthorClasses) {
    boxProps.push(
      `box-shadow: ${shadow.horizontal || 0}px ${shadow.vertical || 0}px ${
        shadow.blur || 0
      }px ${shadow.spread || 0}px ${shadow.color}`
    );
  }

  if (boxProps.length > 0) {
    desktopRules.push(`${targetBoxSel} { ${boxProps.join('; ')}; }`);
  }
  if (boxTabletProps.length > 0) {
    tabletRules.push(`${targetBoxSel} { ${boxTabletProps.join('; ')}; }`);
  }
  if (boxMobileProps.length > 0) {
    mobileRules.push(`${targetBoxSel} { ${boxMobileProps.join('; ')}; }`);
  }

  // Section-specific rules
  if (node.elType === 'section') {
    const contentWidth =
      (s.content_width as { size?: number } | undefined)?.size || 1280;
    if (s.layout !== 'full_width') {
      desktopRules.push(
        `${sel} > .elementor-container { max-width: ${contentWidth}px; }`
      );
    }
    const minH = sizeToCss(s.min_height || s.custom_height);
    if (minH) {
      desktopRules.push(
        `${sel} > .elementor-container { min-height: ${minH}; }`
      );
    }
    if (s.content_position === 'middle') {
      desktopRules.push(
        `${sel} > .elementor-container { align-items: center; }`
      );
    } else if (s.content_position === 'bottom') {
      desktopRules.push(
        `${sel} > .elementor-container { align-items: flex-end; }`
      );
    }
  }

  // Column-specific rules
  if (node.elType === 'column') {
    const colSize = Number(s._column_size || 100);
    desktopRules.push(`${sel} { width: ${colSize}%; }`);
    const spaceBetween = Number(s.space_between_widgets || 0);
    if (spaceBetween > 0 && !hasCustomAuthorClasses) {
      desktopRules.push(
        `${sel} > .elementor-widget-wrap { gap: ${spaceBetween}px; }`
      );
    }
  }

  // Container-specific rules (emitted with :where() specificity so page.json flex/spacing settings work in both Pure JSON & Hybrid modes)
  if (node.elType === 'container') {
    const conProps: string[] = [];
    const hasExplicitFlex =
      s.flex_direction !== undefined ||
      s.flex_gap !== undefined ||
      s.flex_justify_content !== undefined ||
      s.flex_align_items !== undefined;
    if (hasExplicitFlex) {
      const flexDir =
        (s.flex_direction as string) === 'row' ||
        (s.flex_direction as string) === 'row-reverse'
          ? (s.flex_direction as string)
          : 'column';
      conProps.push(`display: flex`, `flex-direction: ${flexDir}`);
      if (s.flex_justify_content) {
        conProps.push(`justify-content: ${String(s.flex_justify_content)}`);
      }
      if (s.flex_align_items) {
        conProps.push(`align-items: ${String(s.flex_align_items)}`);
      }
      if (s.flex_wrap) {
        conProps.push(`flex-wrap: ${String(s.flex_wrap)}`);
      }
      const gapObj = s.flex_gap as
        | { size?: number; column?: string; row?: string }
        | undefined;
      if (gapObj) {
        const colG = Number(gapObj.column ?? gapObj.size ?? 0);
        const rowG = Number(gapObj.row ?? gapObj.size ?? 0);
        if (colG > 0 || rowG > 0) {
          conProps.push(`column-gap: ${colG}px`, `row-gap: ${rowG}px`);
        }
      }
    }
    const widthVal = sizeToCss(s.width);
    if (widthVal) conProps.push(`width: ${widthVal}`);
    const minHVal = sizeToCss(s.min_height);
    if (minHVal) conProps.push(`min-height: ${minHVal}`);
    const boxedWidth = (s.boxed_width as { size?: number } | undefined)?.size;
    if (boxedWidth && s._margin_inline_auto) {
      conProps.push(`max-width: ${boxedWidth}px`, `width: 100%`);
    }
    if (conProps.length > 0) {
      desktopRules.push(`${sel} { ${conProps.join('; ')}; }`);
    }
    if (!node.isInner && s.content_width === 'boxed') {
      const bw = boxedWidth || 1280;
      desktopRules.push(
        `:where(${rawSel} > .e-con-inner) { max-width: ${bw}px; margin: 0 auto; width: 100%; }`
      );
    }
  }

  // Widget-specific typography & colors (only when not overridden by custom author classes in extra.css)
  if (isWidget && !hasCustomAuthorClasses) {
    const wType = node.widgetType || '';
    const align = s.align as string | undefined;
    if (align) {
      desktopRules.push(`${sel} { text-align: ${align}; }`);
    }

    if (wType === 'heading') {
      const hProps: string[] = [];
      if (s.title_color) hProps.push(`color: ${String(s.title_color)}`);
      const fs = sizeToCss(s.typography_font_size);
      if (fs) hProps.push(`font-size: ${fs}`);
      if (s.typography_font_weight) {
        hProps.push(`font-weight: ${String(s.typography_font_weight)}`);
      }
      const lh = sizeToCss(s.typography_line_height);
      if (lh) hProps.push(`line-height: ${lh}`);
      if (hProps.length > 0) {
        desktopRules.push(
          `${sel} .elementor-heading-title { ${hProps.join('; ')}; }`
        );
      }
      const fsTab = sizeToCss(s.typography_font_size_tablet);
      if (fsTab) {
        tabletRules.push(
          `${sel} .elementor-heading-title { font-size: ${fsTab}; }`
        );
      }
      const fsMob = sizeToCss(s.typography_font_size_mobile);
      if (fsMob) {
        mobileRules.push(
          `${sel} .elementor-heading-title { font-size: ${fsMob}; }`
        );
      }
    }

    if (wType === 'text-editor') {
      const tProps: string[] = [];
      if (s.text_color) tProps.push(`color: ${String(s.text_color)}`);
      const fs = sizeToCss(s.typography_font_size);
      if (fs) tProps.push(`font-size: ${fs}`);
      if (s.typography_font_weight) {
        tProps.push(`font-weight: ${String(s.typography_font_weight)}`);
      }
      const lh = sizeToCss(s.typography_line_height);
      if (lh) tProps.push(`line-height: ${lh}`);
      if (tProps.length > 0) {
        desktopRules.push(
          `${sel} > .elementor-widget-container { ${tProps.join('; ')}; }`
        );
      }
    }

    if (wType === 'button') {
      const bProps: string[] = [];
      if (bgType === 'gradient' && bgColor && bgColorB) {
        bProps.push(
          `background: linear-gradient(${bgAngle}deg, ${bgColor}, ${bgColorB})`
        );
      } else if (bgColor) {
        bProps.push(`background-color: ${bgColor}`);
      }
      if (s.button_text_color) {
        bProps.push(`color: ${String(s.button_text_color)}`);
      }
      const btnPad = dimToCss(s.text_padding);
      if (btnPad) bProps.push(`padding: ${btnPad}`);
      if (radius) bProps.push(`border-radius: ${radius}`);
      const fs = sizeToCss(s.typography_font_size);
      if (fs) bProps.push(`font-size: ${fs}`);
      if (s.typography_font_weight) {
        bProps.push(`font-weight: ${String(s.typography_font_weight)}`);
      }
      if (borderStyle && borderStyle !== 'none' && borderWidth) {
        bProps.push(`border-style: ${borderStyle}`);
        bProps.push(`border-width: ${borderWidth}`);
        if (borderColor) bProps.push(`border-color: ${borderColor}`);
      }
      if (bProps.length > 0) {
        desktopRules.push(
          `${sel} .elementor-button { ${bProps.join('; ')}; }`
        );
      }
    }

    if (wType === 'spacer' && !isDecorativeSpacerNode(node)) {
      const sp = sizeToCss(s.space) || '24px';
      desktopRules.push(`${sel} .elementor-spacer-inner { height: ${sp}; }`);
    }
  }

  for (const child of node.elements || []) {
    buildNodeInlineCssRules(
      child,
      desktopRules,
      tabletRules,
      mobileRules,
      applyHybridCss
    );
  }
}

/**
 * Serializes an `ElementorNode` tree into authentic WordPress Elementor Frontend HTML.
 */
function serializeElementorNodeToHtml(
  node: ElementorNode,
  showOutlines: boolean,
  svgDataUrlMap?: Map<string, string>
): string {
  const s = node.settings || {};
  const userClasses = String(s.css_classes || s._css_classes || '').trim();
  const userId = String(s.css_id || s._element_id || '').trim();
  const idAttr = userId ? ` id="${escapeHtmlAttr(userId)}"` : '';
  const customAttrsObj =
    s._custom_attrs && typeof s._custom_attrs === 'object'
      ? (s._custom_attrs as Record<string, string>)
      : {};
  const customAttrsHtml = Object.entries(customAttrsObj)
    .map(([k, v]) =>
      k === 'hidden'
        ? ' hidden'
        : ` ${escapeHtmlAttr(k)}="${escapeHtmlAttr(String(v ?? ''))}"`
    )
    .join('');

  if (node.elType === 'section') {
    const isInner = Boolean(node.isInner);
    const layout = s.layout === 'full_width' ? 'full_width' : 'boxed';
    const gap = String(s.gap || 'default');
    const cols = node.elements || [];
    const outlineBadge = showOutlines
      ? `<span dir="ltr" class="el-sim-badge ${
          isInner ? 'el-sim-badge--inner' : 'el-sim-badge--sec'
        }">${isInner ? 'Inner Section' : 'Section'} (${cols.length} col)</span>`
      : '';

    const childrenHtml = cols
      .map((col) =>
        serializeElementorNodeToHtml(col, showOutlines, svgDataUrlMap)
      )
      .join('\n');

    return `<section${idAttr}${customAttrsHtml} data-id="${escapeHtmlAttr(
      node.id
    )}" data-element_type="section" class="elementor-section elementor-element elementor-element-${escapeHtmlAttr(
      node.id
    )} ${
      isInner ? 'elementor-inner-section' : 'elementor-top-section'
    } elementor-section-${layout} ${escapeHtmlAttr(userClasses)} ${
      showOutlines ? 'el-sim-outline-sec' : ''
    }">
      ${outlineBadge}
      <div class="elementor-container elementor-column-gap-${escapeHtmlAttr(gap)}">
        ${childrenHtml}
      </div>
    </section>`;
  }

  if (node.elType === 'column') {
    const isInner = Boolean(node.isInner);
    const colSize = Number(s._column_size || 100);
    const childrenHtml = (node.elements || [])
      .map((child) =>
        serializeElementorNodeToHtml(child, showOutlines, svgDataUrlMap)
      )
      .join('\n');

    return `<div${idAttr}${customAttrsHtml} data-id="${escapeHtmlAttr(
      node.id
    )}" data-element_type="column" class="elementor-column elementor-col-${colSize} ${
      isInner ? 'elementor-inner-column' : 'elementor-top-column'
    } elementor-element elementor-element-${escapeHtmlAttr(
      node.id
    )} ${escapeHtmlAttr(userClasses)} ${
      showOutlines ? 'el-sim-outline-col' : ''
    }">
      <div class="elementor-widget-wrap elementor-element-populated">
        ${childrenHtml}
      </div>
    </div>`;
  }

  if (node.elType === 'container') {
    const isInner = Boolean(node.isInner);
    const isBoxed = !isInner && s.content_width === 'boxed';
    const rawContainerTag = String(s.html_tag || 'div').toLowerCase();
    const containerTag = [
      'div',
      'header',
      'footer',
      'main',
      'article',
      'section',
      'aside',
      'nav',
      'a',
      'label',
    ].includes(rawContainerTag)
      ? rawContainerTag
      : 'div';
    const containerLinkUrl =
      containerTag === 'a' && s.link && typeof s.link === 'object'
        ? String((s.link as { url?: string }).url || '#')
        : '';
    const hrefAttr = containerLinkUrl
      ? ` href="${escapeHtmlAttr(containerLinkUrl)}"`
      : '';
    const childrenHtml = (node.elements || [])
      .map((child) =>
        serializeElementorNodeToHtml(child, showOutlines, svgDataUrlMap)
      )
      .join('\n');

    return `<${containerTag}${idAttr}${hrefAttr}${customAttrsHtml} data-id="${escapeHtmlAttr(
      node.id
    )}" data-element_type="container" class="elementor-element elementor-element-${escapeHtmlAttr(
      node.id
    )} e-flex e-con-${isBoxed ? 'boxed' : 'full'} e-con ${
      isInner ? 'e-child' : 'e-parent'
    } ${escapeHtmlAttr(userClasses)} ${
      showOutlines ? 'el-sim-outline-sec' : ''
    }">
      ${
        isBoxed
          ? `<div class="e-con-inner">${childrenHtml}</div>`
          : childrenHtml
      }
    </${containerTag}>`;
  }

  // Widget
  const wType = node.widgetType || 'html';
  if (wType === 'html' && userId === 'hybrid-inline-assets') {
    return '';
  }

  const isAutoWidth = s._element_width === 'auto';
  const widgetWrapperOpen = `<div${idAttr}${customAttrsHtml} data-id="${escapeHtmlAttr(
    node.id
  )}" data-element_type="widget" data-widget_type="${escapeHtmlAttr(
    wType
  )}.default" class="elementor-element elementor-element-${escapeHtmlAttr(
    node.id
  )} elementor-widget elementor-widget-${escapeHtmlAttr(wType)} ${
    isAutoWidth ? 'elementor-widget__width-auto' : ''
  } ${escapeHtmlAttr(userClasses)} ${
    showOutlines ? 'el-sim-outline-widget' : ''
  }"><div class="elementor-widget-container">`;
  const widgetWrapperClose = `</div></div>`;

  if (wType === 'html') {
    return `${widgetWrapperOpen}${String(s.html || '')}${widgetWrapperClose}`;
  }

  if (wType === 'heading') {
    const rawTag = String(s.header_size || 'h2').toLowerCase();
    const tag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span'].includes(
      rawTag
    )
      ? rawTag
      : 'h2';
    const linkObj = s.link as { url?: string } | undefined;
    const titleHtml = String(s.title || '');
    const innerHeading =
      linkObj?.url && linkObj.url.trim() !== ''
        ? `<a href="${escapeHtmlAttr(linkObj.url)}">${titleHtml}</a>`
        : titleHtml;
    return `${widgetWrapperOpen}<${tag} class="elementor-heading-title">${innerHeading}</${tag}>${widgetWrapperClose}`;
  }

  if (wType === 'text-editor') {
    return `${widgetWrapperOpen}${String(s.editor || '')}${widgetWrapperClose}`;
  }

  if (wType === 'button') {
    const linkObj = s.link as { url?: string } | undefined;
    const href = linkObj?.url || '#';
    const rawIconSvg = String(s._raw_icon_svg || '').trim();
    const iconSym = rawIconSvg || resolveFaSymbol(s.selected_icon, '');
    const iconSpanHtml = iconSym
      ? `<span class="elementor-button-icon">${iconSym}</span>`
      : '';
    const textSpanHtml = `<span class="elementor-button-text">${String(
      s.text || ''
    )}</span>`;
    const isIconAfter =
      s._icon_position === 'after' || s.icon_align === 'left';
    return `${widgetWrapperOpen}<div class="elementor-button-wrapper"><a href="${escapeHtmlAttr(
      href
    )}" class="elementor-button elementor-button-link elementor-size-sm" role="button"><span class="elementor-button-content-wrapper">${
      isIconAfter
        ? `${textSpanHtml}${iconSpanHtml}`
        : `${iconSpanHtml}${textSpanHtml}`
    }</span></a></div>${widgetWrapperClose}`;
  }

  if (wType === 'image') {
    const imgObj = (s.image || {}) as { url?: string; alt?: string };
    const rawUrl = (imgObj.url || '').trim();
    const isSvgWidget =
      userClasses.includes('el-svg-widget') || rawUrl.startsWith('assets/svg/');
    const resolvedSvgUrl =
      rawUrl && svgDataUrlMap ? svgDataUrlMap.get(rawUrl) : undefined;
    const fallbackUrl = createFallbackMockupDataUrl(
      imgObj.alt || 'پیش‌نمایش تصویر'
    );
    const src = resolvedSvgUrl || rawUrl || fallbackUrl;
    const wSize = (s.width as { size?: number } | undefined)?.size;
    const hSize = (s.height as { size?: number } | undefined)?.size;
    const wAttr = wSize && wSize > 0 ? ` width="${Math.round(wSize)}"` : '';
    const hAttr = hSize && hSize > 0 ? ` height="${Math.round(hSize)}"` : '';
    const imgClassAttr = isSvgWidget ? ` class="el-svg-img"` : '';
    return `${widgetWrapperOpen}<img src="${escapeHtmlAttr(
      src
    )}"${imgClassAttr}${wAttr}${hAttr} alt="${escapeHtmlAttr(
      imgObj.alt || ''
    )}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${escapeHtmlAttr(
      fallbackUrl
    )}';" />${widgetWrapperClose}`;
  }

  if (wType === 'icon-box' || wType === 'image-box') {
    const imgObj = (s.image || {}) as { url?: string };
    const titleText = String(s.title_text || '').trim();
    const descText = String(s.description_text || '').trim();
    const rawTitleTag = String(s.title_size || 'h3').toLowerCase();
    const titleTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'].includes(
      rawTitleTag
    )
      ? rawTitleTag
      : 'h3';
    const rawIconSvg = String(s._raw_icon_svg || '').trim();
    const iconSym = rawIconSvg || resolveFaSymbol(s.selected_icon, '✦');

    return `${widgetWrapperOpen}<div class="elementor-${wType}-wrapper">${
      wType === 'image-box' && imgObj.url
        ? `<figure class="elementor-image-box-img"><img src="${escapeHtmlAttr(
            imgObj.url
          )}" alt="${escapeHtmlAttr(titleText)}" /></figure>`
        : ''
    }${
      wType === 'icon-box'
        ? `<div class="elementor-icon-box-icon"><span class="elementor-icon">${iconSym}</span></div>`
        : ''
    }${
      titleText || descText
        ? `<div class="elementor-${wType}-content">${
            titleText
              ? `<${titleTag} class="elementor-${wType}-title">${titleText}</${titleTag}>`
              : ''
          }${
            descText
              ? `<p class="elementor-${wType}-description">${descText}</p>`
              : ''
          }</div>`
        : ''
    }</div>${widgetWrapperClose}`;
  }

  if (wType === 'icon-list') {
    const items =
      (s.icon_list as Array<{
        _id: string;
        text: string;
        selected_icon?: unknown;
      }>) || [];
    const isInline = s.view === 'inline';
    const itemsHtml = items
      .map(
        (item) =>
          `<li class="elementor-icon-list-item ${
            isInline ? 'elementor-inline-item' : ''
          }">${
            !isInline
              ? `<span class="elementor-icon-list-icon">${resolveFaSymbol(
                  item.selected_icon,
                  '✓'
                )}</span>`
              : ''
          }<span class="elementor-icon-list-text">${String(
            item.text || ''
          )}</span></li>`
      )
      .join('');
    return `${widgetWrapperOpen}<ul class="elementor-icon-list-items ${
      isInline ? 'elementor-inline-items' : ''
    }">${itemsHtml}</ul>${widgetWrapperClose}`;
  }

  if (wType === 'star-rating') {
    const count = Math.min(5, Math.max(1, Number(s.rating || 5)));
    return `${widgetWrapperOpen}<div class="elementor-star-rating" style="color:${escapeHtmlAttr(
      String(s.stars_color || '#FBBF24')
    )}">${'★'.repeat(count)}</div>${widgetWrapperClose}`;
  }

  if (wType === 'social-icons') {
    const socialList =
      (s.social_icon_list as Array<{ _id: string; social_icon?: unknown }>) ||
      [];
    return `${widgetWrapperOpen}<div class="elementor-social-icons-wrapper">${socialList
      .map(
        (soc) =>
          `<span class="elementor-icon elementor-social-icon">${resolveFaSymbol(
            soc.social_icon,
            '●'
          )}</span>`
      )
      .join('')}</div>${widgetWrapperClose}`;
  }

  if (wType === 'alert') {
    return `${widgetWrapperOpen}<div class="elementor-alert" role="alert"><span class="elementor-alert-title">${String(
      s.alert_title || ''
    )}</span><span class="elementor-alert-description">${String(
      s.alert_description || ''
    )}</span></div>${widgetWrapperClose}`;
  }

  if (wType === 'divider') {
    return `${widgetWrapperOpen}<div class="elementor-divider"><span class="elementor-divider-separator"></span></div>${widgetWrapperClose}`;
  }

  if (wType === 'spacer') {
    return `${widgetWrapperOpen}<div class="elementor-spacer"><div class="elementor-spacer-inner"></div></div>${widgetWrapperClose}`;
  }

  if (wType === 'counter') {
    return `${widgetWrapperOpen}<div class="elementor-counter"><div class="elementor-counter-number-wrapper"><span class="elementor-counter-number-prefix">${String(
      s.prefix || ''
    )}</span><span class="elementor-counter-number">${String(
      s.ending_number ?? 0
    )}</span><span class="elementor-counter-number-suffix">${String(
      s.suffix || ''
    )}</span></div><div class="elementor-counter-title">${String(
      s.title || ''
    )}</div></div>${widgetWrapperClose}`;
  }

  if (wType === 'accordion' || wType === 'toggle' || wType === 'tabs') {
    const tabs =
      (s.tabs as Array<{
        _id: string;
        tab_title: string;
        tab_content: string;
        _title_classes?: string;
        _content_classes?: string;
        _is_open?: boolean;
      }>) || [];

    if (userClasses.split(/\s+/).includes('gf-item') && tabs.length > 0) {
      const firstTab = tabs[0];
      return `${widgetWrapperOpen}<div class="elementor-widget elementor-widget-heading gf-question"><div class="elementor-widget-container"><h3 class="elementor-heading-title">${String(
        firstTab.tab_title || ''
      )}</h3></div></div><div class="elementor-widget elementor-widget-text-editor gf-answer"><div class="elementor-widget-container">${String(
        firstTab.tab_content || ''
      )}</div></div>${widgetWrapperClose}`;
    }

    const rawIconSvg = String(s._raw_icon_svg || '').trim();
    const iconHtml =
      rawIconSvg ||
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    const firstOpen = Boolean(tabs[0]?._is_open);
    const openWrapper = firstOpen
      ? widgetWrapperOpen.replace(
          /^<div\b/,
          '<div open'
        )
      : widgetWrapperOpen;

    const tabsHtml = tabs
      .map((t) => {
        const isOpen = Boolean(t._is_open);
        const titleCls = String(t._title_classes || '').trim();
        const contentCls = String(t._content_classes || '').trim();
        return `<details class="elementor-accordion-item" ${
          isOpen ? 'open' : ''
        } ontoggle="var w=this.closest('.el-native-accordion');if(w)w.toggleAttribute('open',this.open);"><summary class="elementor-tab-title ${escapeHtmlAttr(
          titleCls
        )}"><span class="elementor-accordion-title">${String(
          t.tab_title || ''
        )}</span><span class="elementor-accordion-icon" aria-hidden="true">${iconHtml}</span></summary><div class="elementor-tab-content ${escapeHtmlAttr(
          contentCls
        )}">${String(t.tab_content || '')}</div></details>`;
      })
      .join('');
    return `${openWrapper}<div class="elementor-accordion">${tabsHtml}</div>${widgetWrapperClose}`;
  }

  return '';
}

/**
 * Builds the complete, isolated HTML document (`srcDoc`) for the Elementor Visual Simulator iframe.
 */
export function buildAuthenticElementorSrcDoc(
  template: ElementorTemplateJSON,
  extraCss: string,
  extraJs: string,
  applyHybridCss: boolean,
  showOutlines: boolean,
  extractedSvgs: ExtractedSvgAsset[] = [],
  resolveSvgsToDataUrl = true
): string {
  const pageBg =
    (template.page_settings?.background_color as string) || '#060A12';
  const pageScopeClasses =
    (template.page_settings?.css_classes as string) || 'elementor-page';

  const svgDataUrlMap = new Map<string, string>();
  if (resolveSvgsToDataUrl) {
    extractedSvgs.forEach((asset) => {
      svgDataUrlMap.set(asset.relativePath, asset.dataUrl);
      svgDataUrlMap.set(asset.fileName, asset.dataUrl);
    });
  }

  const desktopRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];

  for (const rootNode of template.content) {
    buildNodeInlineCssRules(
      rootNode,
      desktopRules,
      tabletRules,
      mobileRules,
      applyHybridCss
    );
  }

  const inlineElementorCss = [
    desktopRules.join('\n'),
    tabletRules.length > 0
      ? `@media (max-width: 1024px) {\n  ${tabletRules.join('\n  ')}\n}`
      : '',
    mobileRules.length > 0
      ? `@media (max-width: 767px) {\n  ${mobileRules.join('\n  ')}\n}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  let bodyNodesHtml = template.content
    .map((node) =>
      serializeElementorNodeToHtml(
        node,
        showOutlines,
        resolveSvgsToDataUrl ? svgDataUrlMap : undefined
      )
    )
    .join('\n');

  if (resolveSvgsToDataUrl && svgDataUrlMap.size > 0) {
    svgDataUrlMap.forEach((dataUrl, relPath) => {
      if (relPath.startsWith('assets/svg/')) {
        bodyNodesHtml = bodyNodesHtml
          .split(`src="${relPath}"`)
          .join(`src="${dataUrl}"`);
      }
    });
  }

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style id="elementor-frontend-base-css">
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html {
      margin: 0;
      padding: 0;
      background-color: ${pageBg};
    }
    body {
      margin: 0;
      padding: 0;
      background-color: transparent;
      font-family: "Vazirmatn", Tahoma, system-ui, -apple-system, sans-serif;
      direction: rtl;
      overflow-x: clip;
      -webkit-font-smoothing: antialiased;
    }
    img, video, canvas {
      max-width: 100%;
      height: auto;
    }
    svg {
      max-width: 100%;
    }
    .elementor {
      position: relative;
      width: 100%;
    }
    .elementor-section {
      position: relative;
      width: 100%;
    }
    .elementor-section > .elementor-container {
      display: flex;
      margin-right: auto;
      margin-left: auto;
      position: relative;
      width: 100%;
    }
    .elementor-section.elementor-section-boxed > .elementor-container {
      max-width: 1280px;
    }
    .elementor-column-gap-default > .elementor-column > .elementor-element-populated {
      padding: 10px;
    }
    .elementor-column-gap-extended > .elementor-column > .elementor-element-populated {
      padding: 15px;
    }
    .elementor-column {
      position: relative;
      min-height: 1px;
      display: flex;
      min-width: 0;
    }
    .elementor-widget-wrap {
      position: relative;
      width: 100%;
      flex-wrap: wrap;
      align-content: flex-start;
      display: flex;
      flex-direction: column;
    }
    .elementor-widget {
      position: relative;
      min-width: 0;
      max-width: 100%;
    }
    .elementor-widget-wrap > .elementor-widget:not(.elementor-widget__width-auto) {
      width: 100%;
    }
    .elementor-widget.elementor-widget__width-auto {
      width: auto;
      display: inline-block;
    }
    .elementor-widget-wrap > .elementor-widget > .elementor-widget-container {
      width: 100%;
    }
    .elementor-heading-title {
      margin: 0;
      padding: 0;
    }
    .elementor-heading-title a {
      color: inherit;
      text-decoration: none;
    }
    .elementor-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      cursor: pointer;
    }
    .elementor-button-content-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .elementor-icon-list-items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .elementor-icon-list-items.elementor-inline-items {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .elementor-icon-list-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .elementor-icon-box-wrapper, .elementor-image-box-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .elementor-divider {
      display: flex;
      align-items: center;
      padding: 8px 0;
    }
    .elementor-divider-separator {
      width: 100%;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
    }
    @media (max-width: 1024px) {
      .elementor-section > .elementor-container {
        flex-wrap: wrap;
      }
      .elementor-column.elementor-col-25,
      .elementor-column.elementor-col-33,
      .elementor-column.elementor-col-20 {
        width: 50% !important;
      }
    }
    @media (max-width: 767px) {
      .elementor-section > .elementor-container {
        flex-wrap: wrap;
      }
      .elementor-column {
        width: 100% !important;
      }
    }
    /* Simulator Outline Helpers */
    .el-sim-outline-sec {
      outline: 1px dashed rgba(236, 72, 153, 0.65) !important;
      outline-offset: -1px;
    }
    .el-sim-outline-col {
      outline: 1px dashed rgba(56, 189, 248, 0.65) !important;
      outline-offset: -2px;
    }
    .el-sim-outline-widget {
      outline: 1px dashed rgba(129, 140, 248, 0.5) !important;
      outline-offset: -1px;
    }
    .el-sim-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      z-index: 9999;
      padding: 2px 6px;
      font-size: 10px;
      font-family: monospace;
      border-radius: 4px;
      pointer-events: none;
    }
    .el-sim-badge--sec {
      background: rgba(219, 39, 119, 0.9);
      color: #fff;
    }
    .el-sim-badge--inner {
      background: rgba(245, 158, 11, 0.92);
      color: #0f172a;
    }
  </style>
  <style id="elementor-frontend-inline-css">
${inlineElementorCss}
  </style>
  ${
    applyHybridCss && extraCss
      ? `<style id="elementor-hybrid-extra-css">\n${extraCss}\n</style>`
      : ''
  }
  <style id="elementor-simulator-reveal-safety">
    .elementor-column-gap-default > .elementor-column > .elementor-element-populated,
    .elementor-column-gap-extended > .elementor-column > .elementor-element-populated {
      padding: 0;
    }
    .elementor-section.el-exact-section,
    .elementor-section.el-exact-section > .elementor-container,
    .elementor-section.el-exact-section > .elementor-container > .elementor-column,
    .elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap,
    .elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap > .elementor-widget.el-exact-html-carrier,
    .elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap > .elementor-widget.el-exact-html-carrier > .elementor-widget-container {
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      gap: 0 !important;
    }
    .elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap {
      display: block !important;
    }
    .reveal {
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
    }
  </style>
</head>
<body class="elementor-page">
  <div data-elementor-type="wp-page" class="elementor ${escapeHtmlAttr(
    pageScopeClasses
  )}">
    ${bodyNodesHtml}
  </div>
  ${
    applyHybridCss && extraJs
      ? `<script id="elementor-hybrid-extra-js">\n${extraJs}\n</script>`
      : ''
  }
  <script>
    (function () {
      window.addEventListener('error', function (e) {
        if (e && e.message && e.message.indexOf('ResizeObserver loop') !== -1) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      });
      // Prevent external link navigation inside simulator iframe while allowing in-page #hash smooth scrolling
      document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (href === '#') {
          e.preventDefault();
          return;
        }
        if (href.charAt(0) === '#' && href.length > 1) {
          var target = document.getElementById(href.slice(1));
          if (target && !e.defaultPrevented) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }
        if (href.indexOf('http') === 0 || href.indexOf('/') === 0) {
          e.preventDefault();
        }
      });
    })();
  </script>
</body>
</html>`;
}

// ===== CORE BUSINESS LOGIC =====

const DeviceCanvasFrame: React.FC<{
  template: ElementorTemplateJSON;
  device: SingleDevice;
  showOutlines: boolean;
  isFullHeight: boolean;
  applyHybridCss: boolean;
  extraCss: string;
  extraJs: string;
  extractedSvgs: ExtractedSvgAsset[];
}> = ({
  template,
  device,
  showOutlines,
  isFullHeight,
  applyHybridCss,
  extraCss,
  extraJs,
  extractedSvgs,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(820);

  const srcDoc = useMemo(
    () =>
      buildAuthenticElementorSrcDoc(
        template,
        extraCss,
        extraJs,
        applyHybridCss,
        showOutlines,
        extractedSvgs,
        true
      ),
    [template, extraCss, extraJs, applyHybridCss, showOutlines, extractedSvgs]
  );

  const syncIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;
    const elRoot = iframe.contentDocument.querySelector(
      '.elementor'
    ) as HTMLElement | null;
    const bodyEl = iframe.contentDocument.body;
    const contentHeight = elRoot
      ? Math.max(elRoot.scrollHeight, elRoot.offsetHeight)
      : bodyEl
      ? bodyEl.offsetHeight
      : 0;
    const nextHeight = Math.max(Math.ceil(contentHeight), 640);
    setMeasuredHeight((prev) =>
      Math.abs(prev - nextHeight) > 4 ? nextHeight : prev
    );
  }, []);

  useEffect(() => {
    const t = setTimeout(syncIframeHeight, 180);
    return () => {
      clearTimeout(t);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
    };
  }, [srcDoc, isFullHeight, syncIframeHeight]);

  useEffect(() => {
    if (!isFullHeight) return;
    const notifyIframeScroll = () => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const rect = iframe.getBoundingClientRect();
      const scrollTopInsideIframe = Math.max(0, -rect.top);
      iframe.contentWindow.postMessage(
        {
          type: 'EL_SIM_PARENT_SCROLL',
          scrollTop: scrollTopInsideIframe,
          viewportHeight: window.innerHeight || 800,
        },
        '*'
      );
    };
    window.addEventListener('scroll', notifyIframeScroll, { passive: true });
    document.addEventListener('scroll', notifyIframeScroll, {
      passive: true,
      capture: true,
    });
    const initTimer = setTimeout(notifyIframeScroll, 350);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('scroll', notifyIframeScroll);
      document.removeEventListener('scroll', notifyIframeScroll, true);
    };
  }, [isFullHeight, srcDoc]);

  const handleIframeLoad = () => {
    syncIframeHeight();
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    const iframe = iframeRef.current;
    const targetEl =
      iframe?.contentDocument?.querySelector('.elementor') ||
      iframe?.contentDocument?.body;
    if (!targetEl || typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        syncIframeHeight();
      });
    });
    ro.observe(targetEl);
    roRef.current = ro;
  };

  const frameWidthClass =
    device === 'mobile'
      ? 'w-[375px] shrink-0 rounded-[32px] border-[6px] border-slate-800 shadow-2xl overflow-hidden'
      : device === 'tablet'
      ? 'w-[768px] shrink-0 rounded-[24px] border-[5px] border-slate-800 shadow-xl overflow-hidden'
      : 'w-full rounded-xl border border-slate-300 shadow-sm overflow-hidden';

  const deviceTitle =
    device === 'mobile'
      ? 'نمای موبایل (Mobile · 375px)'
      : device === 'tablet'
      ? 'نمای تبلت (Tablet · 768px)'
      : 'نمای دسکتاپ (Desktop · 1440px)';

  const iframeHeightPx = isFullHeight ? Math.max(760, measuredHeight) : 780;

  return (
    <div
      className={`flex flex-col items-center ${
        device === 'desktop' ? 'w-full' : ''
      }`}
    >
      {/* Device Header Badge */}
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
        {device === 'mobile' ? (
          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
        ) : device === 'tablet' ? (
          <Tablet className="w-3.5 h-3.5 text-indigo-600" />
        ) : (
          <Monitor className="w-3.5 h-3.5 text-indigo-600" />
        )}
        <span>{deviceTitle}</span>
      </div>

      <div className={frameWidthClass}>
        {/* Simulated Mobile Notch / Browser Bar */}
        {device === 'mobile' ? (
          <div className="bg-slate-900 text-slate-300 px-5 py-2 flex items-center justify-between text-[10px] font-mono border-b border-slate-800">
            <span>9:41</span>
            <div className="w-20 h-3 rounded-full bg-slate-950" />
            <span>5G · 100%</span>
          </div>
        ) : (
          <div className="bg-slate-900 text-slate-300 px-4 py-2 flex items-center justify-between text-[11px] font-mono border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-slate-400 truncate max-w-[320px]">
              Elementor Canvas · {template.title} ({device})
            </span>
            <span className="text-emerald-400">v{template.version}</span>
          </div>
        )}

        {/* Authentic Elementor Frontend Viewport Iframe */}
        <iframe
          ref={iframeRef}
          title={`Elementor Simulator (${device})`}
          sandbox="allow-same-origin allow-scripts"
          srcDoc={srcDoc}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: `${iframeHeightPx}px`,
            border: 'none',
            display: 'block',
          }}
          className="bg-slate-950"
        />
      </div>
    </div>
  );
};

export const ElementorVisualPreview: React.FC<ElementorVisualPreviewProps> = ({
  template,
  extraCss = '',
  extraJs = '',
  extractedSvgs = [],
}) => {
  const [viewportMode, setViewportMode] =
    useState<SimulatorViewportMode>('split');
  const [isFullHeight, setIsFullHeight] = useState<boolean>(true);
  const [applyHybridCss, setApplyHybridCss] = useState<boolean>(true);
  const [showOutlines, setShowOutlines] = useState<boolean>(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Top Simulator Toolbar: Desktop / Tablet / Mobile / Side-by-Side + Controls */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900">
            شبیه‌ساز بصری زنده Elementor
          </span>
          <span className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            {template.content.length} سکشن ریشه
          </span>
          {extractedSvgs.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              {extractedSvgs.length} فایل SVG لوکال
            </span>
          )}
        </div>

        {/* Device Mode Switcher: Split (Desktop + Mobile) | Desktop | Tablet | Mobile */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
          <button
            type="button"
            onClick={() => setViewportMode('split')}
            className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              viewportMode === 'split'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>دسکتاپ + موبایل (همزمان)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              viewportMode === 'desktop'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>دسکتاپ</span>
          </button>

          <button
            type="button"
            onClick={() => setViewportMode('tablet')}
            className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              viewportMode === 'tablet'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>تبلت (768px)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              viewportMode === 'mobile'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>موبایل (375px)</span>
          </button>
        </div>

        {/* Auxiliary Simulator Controls: Hybrid CSS, Elementor Outlines, Full Height */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setApplyHybridCss((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              applyHybridCss
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              اعمال extra.css + extra.js: {applyHybridCss ? 'فعال' : 'غیرفعال'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowOutlines((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showOutlines
                ? 'border-pink-300 bg-pink-50 text-pink-900 font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-pink-600" />
            <span>کادرهای المنتور</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullHeight((prev) => !prev)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isFullHeight
                ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-medium'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {isFullHeight ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>نمایش کل ارتفاع صفحه</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
                <span>قاب اسکرول‌دار</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulator Viewport Stage */}
      <div className="p-4 sm:p-6 bg-slate-100/90 overflow-x-auto">
        {viewportMode === 'split' ? (
          <div className="flex flex-col xl:flex-row items-start gap-6">
            {/* Desktop Canvas (Left/Main) */}
            <div className="flex-1 min-w-[780px] w-full">
              <DeviceCanvasFrame
                template={template}
                device="desktop"
                showOutlines={showOutlines}
                isFullHeight={isFullHeight}
                applyHybridCss={applyHybridCss}
                extraCss={extraCss}
                extraJs={extraJs}
                extractedSvgs={extractedSvgs}
              />
            </div>

            {/* Mobile Canvas (Right/Side) */}
            <div className="shrink-0 mx-auto xl:mx-0 xl:sticky xl:top-20">
              <DeviceCanvasFrame
                template={template}
                device="mobile"
                showOutlines={showOutlines}
                isFullHeight={false}
                applyHybridCss={applyHybridCss}
                extraCss={extraCss}
                extraJs={extraJs}
                extractedSvgs={extractedSvgs}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <DeviceCanvasFrame
              template={template}
              device={viewportMode}
              showOutlines={showOutlines}
              isFullHeight={isFullHeight}
              applyHybridCss={applyHybridCss}
              extraCss={extraCss}
              extraJs={extraJs}
              extractedSvgs={extractedSvgs}
            />
          </div>
        )}
      </div>
    </div>
  );
};
