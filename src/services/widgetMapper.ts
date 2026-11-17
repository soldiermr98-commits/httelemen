// ===== IMPORTS & DEPENDENCIES =====
import {
  ConverterSettings,
  ElementorNode,
  ParsedDOMNode,
  PlaceholderEntry,
  ReplacedWidgetEntry,
  WrapperReconstructionSpec,
} from '../types/elementor';
import { ElementorIdRegistry } from './idGenerator';
import {
  buildElementorDimension,
  extractCssUrl,
  extractPrimaryFont,
  hasNonZeroEdges,
  parseLinearGradient,
} from './styleUtils';

// ===== TYPES & INTERFACES =====
export interface MappingContext {
  settings: ConverterSettings;
  idRegistry: ElementorIdRegistry;
  replacedWidgets: ReplacedWidgetEntry[];
  placeholders: PlaceholderEntry[];
  manualAdjustments: Set<string>;
  widgetBreakdown: Record<string, number>;
  decorativeWidgetsCount: number;
  reconstructedWrappers: WrapperReconstructionSpec[];
  nodeEffectiveIds: Map<string, string[]>;
}

// ===== UTILITY FUNCTIONS =====

function incrementWidgetCount(ctx: MappingContext, widgetType: string): void {
  ctx.widgetBreakdown[widgetType] = (ctx.widgetBreakdown[widgetType] || 0) + 1;
}

/**
 * Extracts official Elementor entrance animation settings from HTML data-reveal / data-split / anim-in attributes.
 */
export function applyEntranceAnimation(
  node: ParsedDOMNode,
  targetSettings: Record<string, unknown>,
  isWidget = true
): void {
  const revealAttr = node.attributes['data-reveal'];
  const splitAttr = node.attributes['data-split'];
  const isAnimIn = node.classList.includes('anim-in');

  if (revealAttr === undefined && splitAttr === undefined && !isAnimIn) {
    return;
  }

  let animName = 'fadeInUp';
  if (revealAttr === 'fade') animName = 'fadeIn';
  else if (revealAttr === 'scale') animName = 'zoomIn';
  else if (revealAttr === 'start') animName = 'fadeInRight';
  else if (revealAttr === 'end') animName = 'fadeInLeft';

  const key = isWidget ? '_animation' : 'animation';
  const delayKey = isWidget ? '_animation_delay' : 'animation_delay';

  targetSettings[key] = animName;

  const styleAttr = node.attributes.style || '';
  const idxMatch = styleAttr.match(/--(?:reveal-i|i)\s*:\s*(\d+)/);
  if (idxMatch) {
    const step = parseInt(idxMatch[1], 10);
    if (step > 0) {
      targetSettings[delayKey] = step * 90;
    }
  }
}

/**
 * Applies official Elementor advanced settings (_margin, _padding, _border, _box_shadow, _background)
 * including responsive _tablet and _mobile keys.
 */
export function applyAdvancedWidgetSettings(
  node: ParsedDOMNode,
  targetSettings: Record<string, unknown>,
  options: { skipBackground?: boolean; skipPadding?: boolean } = {}
): void {
  const { styles, tabletOverrides, mobileOverrides } = node;

  // Requirement 3: Preserve original HTML classes in _css_classes and id in _element_id
  if (node.classList.length > 0 && !targetSettings._css_classes) {
    targetSettings._css_classes = node.classList.join(' ');
  }
  if (node.idAttr && !targetSettings._element_id) {
    targetSettings._element_id = node.idAttr;
  }

  applyEntranceAnimation(node, targetSettings, true);

  const isAutoCenteredMargin =
    styles.margin.left >= 24 &&
    Math.abs(styles.margin.left - styles.margin.right) <= 4;

  if (hasNonZeroEdges(styles.margin) && !isAutoCenteredMargin) {
    targetSettings._margin = buildElementorDimension(styles.margin, 'px');
  }
  if (
    tabletOverrides.margin &&
    hasNonZeroEdges(tabletOverrides.margin) &&
    !isAutoCenteredMargin
  ) {
    targetSettings._margin_tablet = buildElementorDimension(
      tabletOverrides.margin,
      'px'
    );
  }
  if (
    mobileOverrides.margin &&
    hasNonZeroEdges(mobileOverrides.margin) &&
    !isAutoCenteredMargin
  ) {
    targetSettings._margin_mobile = buildElementorDimension(
      mobileOverrides.margin,
      'px'
    );
  }

  if (!options.skipPadding) {
    if (hasNonZeroEdges(styles.padding)) {
      targetSettings._padding = buildElementorDimension(styles.padding, 'px');
    }
    if (tabletOverrides.padding && hasNonZeroEdges(tabletOverrides.padding)) {
      targetSettings._padding_tablet = buildElementorDimension(
        tabletOverrides.padding,
        'px'
      );
    }
    if (mobileOverrides.padding && hasNonZeroEdges(mobileOverrides.padding)) {
      targetSettings._padding_mobile = buildElementorDimension(
        mobileOverrides.padding,
        'px'
      );
    }
  }

  if (!options.skipBackground) {
    const grad = parseLinearGradient(styles.backgroundImage);
    if (grad) {
      targetSettings._background_background = 'gradient';
      targetSettings._background_color = grad.colorA;
      targetSettings._background_color_b = grad.colorB;
      targetSettings._background_gradient_angle = {
        unit: 'deg',
        size: grad.angle,
      };
    } else if (styles.backgroundColor) {
      targetSettings._background_background = 'classic';
      targetSettings._background_color = styles.backgroundColor;
    }
  }

  if (styles.borderStyle !== 'none' && hasNonZeroEdges(styles.borderWidth)) {
    targetSettings._border_border = styles.borderStyle;
    targetSettings._border_width = buildElementorDimension(
      styles.borderWidth,
      'px'
    );
    if (styles.borderColor) {
      targetSettings._border_color = styles.borderColor;
    }
  }

  if (hasNonZeroEdges(styles.borderRadius)) {
    targetSettings._border_radius = buildElementorDimension(
      styles.borderRadius,
      'px'
    );
  }

  if (styles.boxShadow) {
    targetSettings._box_shadow_box_shadow_type = 'yes';
    targetSettings._box_shadow_box_shadow = styles.boxShadow;
  }
}

/**
 * Applies official Elementor Typography settings including responsive _tablet and _mobile sizes.
 */
export function applyTypographySettings(
  node: ParsedDOMNode,
  targetSettings: Record<string, unknown>,
  prefix = 'typography'
): void {
  const { styles, tabletOverrides, mobileOverrides } = node;
  const { primaryFont } = extractPrimaryFont(styles.fontFamily);

  targetSettings[`${prefix}_typography`] = 'custom';
  if (primaryFont) {
    targetSettings[`${prefix}_font_family`] = primaryFont;
  }

  targetSettings[`${prefix}_font_size`] = {
    unit: 'px',
    size: styles.fontSizePx,
  };

  if (tabletOverrides.fontSizePx) {
    targetSettings[`${prefix}_font_size_tablet`] = {
      unit: 'px',
      size: tabletOverrides.fontSizePx,
    };
  }

  if (mobileOverrides.fontSizePx) {
    targetSettings[`${prefix}_font_size_mobile`] = {
      unit: 'px',
      size: mobileOverrides.fontSizePx,
    };
  }

  if (styles.fontWeight) {
    targetSettings[`${prefix}_font_weight`] = styles.fontWeight;
  }

  if (styles.lineHeightPx > 0) {
    targetSettings[`${prefix}_line_height`] = {
      unit: 'px',
      size: styles.lineHeightPx,
    };
  }

  if (tabletOverrides.lineHeightPx) {
    targetSettings[`${prefix}_line_height_tablet`] = {
      unit: 'px',
      size: tabletOverrides.lineHeightPx,
    };
  }

  if (mobileOverrides.lineHeightPx) {
    targetSettings[`${prefix}_line_height_mobile`] = {
      unit: 'px',
      size: mobileOverrides.lineHeightPx,
    };
  }

  if (styles.letterSpacingPx !== 0) {
    targetSettings[`${prefix}_letter_spacing`] = {
      unit: 'px',
      size: styles.letterSpacingPx,
    };
  }
}

function applyAlignmentSettings(
  node: ParsedDOMNode,
  targetSettings: Record<string, unknown>,
  alignKey = 'align'
): void {
  if (node.styles.textAlign) {
    targetSettings[alignKey] = node.styles.textAlign;
  }
  if (node.tabletOverrides.textAlign) {
    targetSettings[`${alignKey}_tablet`] = node.tabletOverrides.textAlign;
  }
  if (node.mobileOverrides.textAlign) {
    targetSettings[`${alignKey}_mobile`] = node.mobileOverrides.textAlign;
  }
}

export function createWidget(
  ctx: MappingContext,
  widgetType: string,
  settings: Record<string, unknown>,
  seed?: string
): ElementorNode {
  incrementWidgetCount(ctx, widgetType);
  return {
    id: ctx.idRegistry.generateId(seed || widgetType),
    elType: 'widget',
    widgetType,
    settings,
    elements: [],
  };
}

// ===== PATTERN DETECTORS =====

function hasDescendantTag(node: ParsedDOMNode, tags: Set<string>): boolean {
  for (const child of node.children) {
    if (tags.has(child.tag)) return true;
    if (hasDescendantTag(child, tags)) return true;
  }
  return false;
}

/**
 * Checks if a node is a Linked Image Tile (e.g. <a class="g-tile"> or <li class="guide__tile"> with <img> and <h3>).
 */
export function isLinkedImageCard(node: ParsedDOMNode): {
  imageUrl: string;
  title: string;
  caption: string;
  href: string;
  faIcon: string;
} | null {
  const target =
    node.tag === 'li' && node.children.length === 1 && node.children[0].tag === 'a'
      ? node.children[0]
      : node;

  if (target.tag !== 'a') return null;

  let imgNode: ParsedDOMNode | null = null;
  let headingNode: ParsedDOMNode | null = null;
  let faIcon = target.attributes['data-fa-icon'] || 'fas fa-map-marker-alt';
  const otherTexts: string[] = [];

  const scan = (n: ParsedDOMNode) => {
    if (n.attributes['data-fa-icon'] && faIcon === 'fas fa-map-marker-alt') {
      faIcon = n.attributes['data-fa-icon'];
    }
    if (n.tag === 'img' && !imgNode) {
      imgNode = n;
      return;
    }
    if (/^h[1-6]$/.test(n.tag) && !headingNode) {
      headingNode = n;
      return;
    }
    if (
      n.children.length === 0 &&
      n.textContent.trim() &&
      n !== headingNode &&
      !/^[۰-۹0-9]{1,3}$/.test(n.textContent.trim())
    ) {
      otherTexts.push(n.textContent.trim());
      return;
    }
    n.children.forEach(scan);
  };

  target.children.forEach(scan);

  if (imgNode && headingNode) {
    return {
      imageUrl:
        (imgNode as ParsedDOMNode).attributes.src ||
        'https://placehold.co/600x400?text=Replace+Image',
      title: (headingNode as ParsedDOMNode).textContent.trim(),
      caption: otherTexts.join(' · '),
      href: target.attributes.href || '#',
      faIcon,
    };
  }

  return null;
}

/**
 * Determines whether a node is a button or CTA link (and NOT a card wrapper).
 */
export function isButtonLikeLink(node: ParsedDOMNode): boolean {
  if (node.attributes['data-el-button-widget'] === 'true') return true;
  if (node.tag === 'button') return true;
  if (node.tag !== 'a') return false;

  if (
    hasDescendantTag(
      node,
      new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'img'])
    )
  ) {
    return false;
  }

  const classStr = node.classList.join(' ').toLowerCase();
  if (
    /(?:^|[\s_-])(btn|button|cta|header-cta|icon-btn|related-link|nav-link)(?:$|[\s_-])/.test(
      classStr
    )
  ) {
    return true;
  }

  if (
    Boolean(node.attributes['data-fa-icon']) &&
    (node.classList.includes('inline-flex') ||
      node.classList.includes('flex') ||
      node.classList.includes('rounded-full') ||
      node.classList.includes('rounded-xl'))
  ) {
    return true;
  }

  const hasBg =
    Boolean(node.styles.backgroundColor) ||
    Boolean(parseLinearGradient(node.styles.backgroundImage));
  const hasBorder =
    node.styles.borderStyle !== 'none' &&
    hasNonZeroEdges(node.styles.borderWidth);
  const hasPad =
    node.styles.padding.top >= 6 && node.styles.padding.left >= 12;

  return (hasBg || hasBorder) && hasPad && node.textContent.length < 70;
}

/**
 * Checks whether a <ul> or <ol> is a simple list of text/links (appropriate for icon-list)
 * vs. a layout grid of cards (like .services__grid, .guide__grid, .benefits__grid, .process__steps, .roadmap__list, .capabilities__list).
 */
export function isSimpleTextList(node: ParsedDOMNode): boolean {
  if (node.tag !== 'ul' && node.tag !== 'ol') return false;
  const liChildren = node.children.filter((c) => c.tag === 'li');
  if (liChildren.length === 0) return false;

  const classStr = `${node.idAttr} ${node.classList.join(' ')}`.toLowerCase();

  // Never collapse card grids, roadmap lists, capability lists, or code line lists into plain icon-list
  if (
    classStr.includes('grid') ||
    classStr.includes('steps') ||
    classStr.includes('tiles') ||
    classStr.includes('roadmap__list') ||
    classStr.includes('capabilities__list') ||
    classStr.includes('hv__lines')
  ) {
    return false;
  }

  for (const li of liChildren) {
    if (
      hasDescendantTag(
        li,
        new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'img', 'ul', 'ol'])
      )
    ) {
      return false;
    }
    if (
      li.classList.some((cls) =>
        /(?:^|[_-])(card|tile|step|box|item)(?:$|[_-])/i.test(cls) &&
        !cls.includes('nav')
      ) ||
      li.children.some((c) =>
        c.classList.some((cls) =>
          /(?:^|[_-])(card|tile|step|box)(?:$|[_-])/i.test(cls)
        )
      )
    ) {
      return false;
    }
  }

  return true;
}

function isSocialLinksGroup(node: ParsedDOMNode): boolean {
  const classStr = `${node.idAttr} ${node.classList.join(' ')}`.toLowerCase();
  const childrenLinks =
    node.tag === 'ul'
      ? node.children
          .map((li) => li.children.find((c) => c.tag === 'a'))
          .filter((a): a is ParsedDOMNode => Boolean(a))
      : node.children.filter((c) => c.tag === 'a');

  if (childrenLinks.length < 2) return false;

  if (/\b(social|socials|share|follow)\b/.test(classStr)) return true;

  const socialDomains = [
    'twitter.com',
    'x.com',
    'linkedin.com',
    'instagram.com',
    'github.com',
    'telegram.me',
    't.me',
    'youtube.com',
    'facebook.com',
    'aparat.com',
    'wa.me',
  ];
  return childrenLinks.some((a) => {
    const href = (a.attributes.href || '').toLowerCase();
    return socialDomains.some((d) => href.includes(d));
  });
}

// ===== CORE BUSINESS LOGIC =====

/**
 * Converts a ParsedDOMNode into one or more official Elementor Widget nodes.
 * Strictly obeys the no-HTML widget rule and Elementor Free/Pro configuration.
 */
export function mapNodeToElementorWidgets(
  node: ParsedDOMNode,
  ctx: MappingContext,
  inlineGroup = false,
  isColumnRoot = false
): ElementorNode[] {
  const tag = node.tag;

  // Requirement 5: Reconstruct decorative layers (aurora, particles, beam, grid, circuit svg, etc.)
  // as spacer/divider widgets with _css_classes preserved so extra.css rules apply to them!
  if (node.isDecorative) {
    ctx.decorativeWidgetsCount++;
    const cssClasses = node.classList.join(' ');
    const isThinLine =
      node.rect.height > 0 &&
      node.rect.height <= 4 &&
      (cssClasses.includes('rail') ||
        cssClasses.includes('seam') ||
        cssClasses.includes('beam'));

    if (isThinLine) {
      const divSettings: Record<string, unknown> = {
        style: 'solid',
        weight: { unit: 'px', size: Math.max(1, node.rect.height || 1) },
        color: node.styles.backgroundColor || node.styles.borderColor || 'rgba(25, 197, 139, 0.25)',
        _css_classes: cssClasses,
      };
      if (node.idAttr) divSettings._element_id = node.idAttr;
      return [createWidget(ctx, 'divider', divSettings, `${node.uid}_decor_div`)];
    }

    const spacerSettings: Record<string, unknown> = {
      space: {
        unit: 'px',
        size: Math.max(1, Math.min(40, node.rect.height || 10)),
      },
      _css_classes: cssClasses,
    };
    if (node.idAttr) spacerSettings._element_id = node.idAttr;
    return [createWidget(ctx, 'spacer', spacerSettings, `${node.uid}_decor_spc`)];
  }

  // Rich interactive/SVG HTML widget block (.gf-hero-art, .gf-cta-art, .gf-controls, .gf-aside-wrap, .gf-hero-bottom, .gf-intro-mark, .gf-group-symbol)
  if (
    node.attributes['data-el-html-widget'] === 'true' &&
    node.attributes['data-raw-html-content']
  ) {
    const rawHtmlContent = node.attributes['data-raw-html-content'];
    if (ctx.settings.embedAssetsInPageJson !== false) {
      const htmlSettings: Record<string, unknown> = {
        html: rawHtmlContent,
      };
      if (node.classList.length > 0) {
        htmlSettings._css_classes = node.classList.join(' ');
      }
      if (node.idAttr) {
        htmlSettings._element_id = node.idAttr;
      }
      return [createWidget(ctx, 'html', htmlSettings, `${node.uid}_rich_html`)];
    }
  }

  // Pre-existing .elementor-widget-text-editor block (e.g. .gf-answer with <p> + <ul>) -> single native text-editor widget
  if (
    node.attributes['data-el-text-editor-widget'] === 'true' &&
    node.attributes['data-raw-text-editor-html']
  ) {
    const rawEditorHtml = node.attributes['data-raw-text-editor-html'];
    const textSettings: Record<string, unknown> = {
      editor: rawEditorHtml,
    };
    if (node.styles.color) {
      textSettings.text_color = node.styles.color;
    }
    applyAlignmentSettings(node, textSettings, 'align');
    applyTypographySettings(node, textSettings, 'typography');
    applyAdvancedWidgetSettings(node, textSettings);
    return [
      createWidget(ctx, 'text-editor', textSettings, `${node.uid}_text_editor`),
    ];
  }

  // Special Handler A: Hero Illustration Visual (.hv) -> Clean Code Window + 2 Floating Product Cards
  if (node.classList.includes('hv') || node.classList.includes('hero__visual')) {
    const codeLines: string[] = [];
    const collectCode = (n: ParsedDOMNode) => {
      if (n.classList.includes('hv__lines')) {
        n.children.forEach((li) => {
          codeLines.push(li.textContent.trim() || ' ');
        });
      } else {
        n.children.forEach(collectCode);
      }
    };
    collectCode(node);

    const codePre =
      codeLines.length > 0
        ? codeLines.join('\n')
        : `<?php\n// Hami · Call for Price for WooCommerce\nadd_filter('woocommerce_get_price_html', 'gc_price_inquiry', 20, 2);\n\nfunction gc_price_inquiry($html, $product) {\n  return gc_inquiry_button($product);\n}`;

    const codePanelWidget = createWidget(
      ctx,
      'text-editor',
      {
        editor: `<div style="direction:ltr;text-align:left;font-family:monospace;"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid rgba(233,247,240,0.12);"><span style="color:#A3F451;font-weight:700;">● فعال</span><span style="color:#E9F7F0;background:rgba(233,247,240,0.08);padding:3px 10px;border-radius:4px;">call-for-price.php</span></div><pre style="margin:0;color:#E9F7F0;font-size:13px;line-height:1.8;overflow-x:auto;">${codePre}</pre><div style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(233,247,240,0.12);direction:rtl;text-align:right;color:#A3F451;font-size:12px;font-weight:600;">✓ ساخت  ───  ✓ آزمون  ───  ● انتشار</div></div>`,
        text_color: '#E9F7F0',
        align: 'left',
        _background_background: 'gradient',
        _background_color: '#0D4A3A',
        _background_color_b: '#072D23',
        _background_gradient_angle: { unit: 'deg', size: 180 },
        _padding: buildElementorDimension(
          { top: 22, right: 24, bottom: 20, left: 24 },
          'px'
        ),
        _border_border: 'solid',
        _border_width: buildElementorDimension(
          { top: 1, right: 1, bottom: 1, left: 1 },
          'px'
        ),
        _border_color: 'rgba(25, 197, 139, 0.35)',
        _border_radius: buildElementorDimension(
          { top: 14, right: 14, bottom: 14, left: 14 },
          'px'
        ),
        _box_shadow_box_shadow_type: 'yes',
        _box_shadow_box_shadow: {
          horizontal: 0,
          vertical: 28,
          blur: 55,
          spread: -20,
          color: 'rgba(0, 0, 0, 0.55)',
        },
        _animation: 'fadeInUp',
      },
      `${node.uid}_hv_code`
    );

    const pluginCardWidget = createWidget(
      ctx,
      'icon-box',
      {
        selected_icon: { value: 'fas fa-plug', library: 'fa-solid' },
        title_text: 'تماس برای قیمت',
        description_text: 'افزونه ووکامرس · فعال',
        position: 'right',
        text_align: 'right',
        primary_color: '#06271F',
        title_color: '#172B25',
        description_color: '#64756E',
        title_size: 'h4',
        _background_background: 'classic',
        _background_color: '#F0FBF6',
        _margin: buildElementorDimension(
          { top: 16, right: 0, bottom: 12, left: 0 },
          'px'
        ),
        _padding: buildElementorDimension(
          { top: 14, right: 18, bottom: 14, left: 18 },
          'px'
        ),
        _border_radius: buildElementorDimension(
          { top: 12, right: 12, bottom: 12, left: 12 },
          'px'
        ),
        _box_shadow_box_shadow_type: 'yes',
        _box_shadow_box_shadow: {
          horizontal: 0,
          vertical: 16,
          blur: 32,
          spread: -12,
          color: 'rgba(0, 0, 0, 0.45)',
        },
        _animation: 'fadeInRight',
        _animation_delay: 200,
      },
      `${node.uid}_hv_plugin`
    );

    const aiCardWidget = createWidget(
      ctx,
      'icon-box',
      {
        selected_icon: { value: 'fas fa-magic', library: 'fa-solid' },
        title_text: 'Hami AI · آنلاین',
        description_text:
          'سلام! دنبال چه محصولی هستید؟ بگویید چه می‌خواهید؛ مرتبط‌ترین محصولات را پیدا می‌کنم.',
        position: 'right',
        text_align: 'right',
        primary_color: '#19C58B',
        title_color: '#172B25',
        description_color: '#172B25',
        title_size: 'h4',
        _background_background: 'classic',
        _background_color: '#F0FBF6',
        _padding: buildElementorDimension(
          { top: 16, right: 18, bottom: 16, left: 18 },
          'px'
        ),
        _border_radius: buildElementorDimension(
          { top: 12, right: 12, bottom: 12, left: 12 },
          'px'
        ),
        _box_shadow_box_shadow_type: 'yes',
        _box_shadow_box_shadow: {
          horizontal: 0,
          vertical: 16,
          blur: 32,
          spread: -12,
          color: 'rgba(0, 0, 0, 0.45)',
        },
        _animation: 'fadeInLeft',
        _animation_delay: 350,
      },
      `${node.uid}_hv_ai`
    );

    return [codePanelWidget, pluginCardWidget, aiCardWidget];
  }

  // Special Handler B: Capabilities Core Chip Visual (.cc / .capabilities__visual)
  if (node.classList.includes('cc') || node.classList.includes('capabilities__visual')) {
    const coreBox = createWidget(
      ctx,
      'icon-box',
      {
        selected_icon: { value: 'fas fa-microchip', library: 'fa-solid' },
        title_text: 'GILACLICK · CORE',
        description_text: 'WordPress  ·  WooCommerce  ·  PHP  ·  REST API',
        position: 'top',
        text_align: 'center',
        primary_color: '#A3F451',
        title_color: '#FFFFFF',
        description_color: '#A3F451',
        title_size: 'h3',
        _background_background: 'gradient',
        _background_color: '#0D5240',
        _background_color_b: '#06271F',
        _background_gradient_angle: { unit: 'deg', size: 145 },
        _padding: buildElementorDimension(
          { top: 44, right: 32, bottom: 44, left: 32 },
          'px'
        ),
        _border_border: 'solid',
        _border_width: buildElementorDimension(
          { top: 1, right: 1, bottom: 1, left: 1 },
          'px'
        ),
        _border_color: 'rgba(25, 197, 139, 0.45)',
        _border_radius: buildElementorDimension(
          { top: 18, right: 18, bottom: 18, left: 18 },
          'px'
        ),
        _box_shadow_box_shadow_type: 'yes',
        _box_shadow_box_shadow: {
          horizontal: 0,
          vertical: 24,
          blur: 60,
          spread: -18,
          color: 'rgba(25, 197, 139, 0.35)',
        },
        _animation: 'zoomIn',
      },
      `${node.uid}_cc_core`
    );
    return [coreBox];
  }

  // Special Handler C: Roadmap List (.roadmap__list) or Roadmap Item (.roadmap__item / .roadmap__card)
  if (node.classList.includes('roadmap__list')) {
    const widgets: ElementorNode[] = [];
    node.children.forEach((item, idx) => {
      const card =
        item.children.find((c) => c.classList.includes('roadmap__card')) || item;
      const faIcon =
        card.attributes['data-fa-icon'] ||
        item.attributes['data-fa-icon'] ||
        ['fas fa-utensils', 'fas fa-clipboard-list', 'fas fa-project-diagram', 'fas fa-tachometer-alt'][
          idx % 4
        ];
      const textWrap = card.children.find((c) =>
        c.classList.includes('roadmap__text')
      );
      const statusWrap = card.children.find((c) =>
        c.classList.includes('roadmap__status')
      );
      const indexLabel = textWrap?.children[0]?.textContent.trim() || `حوزه ۰${idx + 1}`;
      const titleLabel =
        textWrap?.children[1]?.textContent.trim() || card.textContent.trim();
      const statusLabel = statusWrap?.textContent.trim() || 'برنامه آینده';

      widgets.push(
        createWidget(
          ctx,
          'icon-box',
          {
            selected_icon: { value: faIcon, library: 'fa-solid' },
            title_text: titleLabel,
            description_text: `${indexLabel}  ·  ${statusLabel}`,
            position: 'right',
            text_align: 'right',
            title_size: 'h4',
            primary_color: '#0B4435',
            title_color: '#172B25',
            description_color: '#64756E',
            title_typography_typography: 'custom',
            title_typography_font_family: 'Peyda',
            title_typography_font_size: { unit: 'px', size: 16 },
            title_typography_font_weight: '800',
            _background_background: 'classic',
            _background_color: '#FFFFFF',
            _margin: buildElementorDimension(
              { top: 0, right: 0, bottom: 12, left: 0 },
              'px'
            ),
            _padding: buildElementorDimension(
              { top: 16, right: 18, bottom: 16, left: 18 },
              'px'
            ),
            _border_border: 'dashed',
            _border_width: buildElementorDimension(
              { top: 1, right: 1, bottom: 1, left: 1 },
              'px'
            ),
            _border_color: 'rgba(11, 68, 53, 0.32)',
            _border_radius: buildElementorDimension(
              { top: 10, right: 10, bottom: 10, left: 10 },
              'px'
            ),
            _animation: 'fadeInLeft',
            _animation_delay: idx * 90,
          },
          `${node.uid}_rm_${idx}`
        )
      );
    });
    return widgets;
  }

  // Special Handler D: Capabilities List (.capabilities__list) -> 4 Styled Dark Cards
  if (node.classList.includes('capabilities__list')) {
    const widgets: ElementorNode[] = [];
    node.children.forEach((item, idx) => {
      const faIcon =
        item.attributes['data-fa-icon'] ||
        ['fas fa-calendar-check', 'fas fa-cubes', 'fas fa-tachometer-alt', 'fas fa-life-ring'][
          idx % 4
        ];
      widgets.push(
        createWidget(
          ctx,
          'icon-box',
          {
            selected_icon: { value: faIcon, library: 'fa-solid' },
            title_text: item.textContent.trim(),
            description_text: '',
            position: 'right',
            text_align: 'right',
            title_size: 'h4',
            primary_color: '#A3F451',
            title_color: '#E9F7F0',
            title_typography_typography: 'custom',
            title_typography_font_family: 'Peyda',
            title_typography_font_size: { unit: 'px', size: 15 },
            title_typography_font_weight: '600',
            _background_background: 'classic',
            _background_color: 'rgba(233, 247, 240, 0.04)',
            _margin: buildElementorDimension(
              { top: 8, right: 0, bottom: 8, left: 0 },
              'px'
            ),
            _padding: buildElementorDimension(
              { top: 14, right: 16, bottom: 14, left: 16 },
              'px'
            ),
            _border_border: 'solid',
            _border_width: buildElementorDimension(
              { top: 1, right: 1, bottom: 1, left: 1 },
              'px'
            ),
            _border_color: 'rgba(233, 247, 240, 0.12)',
            _border_radius: buildElementorDimension(
              { top: 10, right: 10, bottom: 10, left: 10 },
              'px'
            ),
            _animation: 'fadeInRight',
            _animation_delay: idx * 90,
          },
          `${node.uid}_cap_${idx}`
        )
      );
    });
    return widgets;
  }

  // Special Handler E: Card Top Header (.s-card__head / .b-item__top / .process__node / .p-notice__icon)
  if (
    node.classList.includes('s-card__head') ||
    node.classList.includes('b-item__top') ||
    node.classList.includes('process__node') ||
    node.classList.includes('p-notice__icon') ||
    node.classList.includes('p-card__art')
  ) {
    const iconChild = node.children.find((c) => c.attributes['data-fa-icon']);
    const faIcon =
      node.attributes['data-fa-icon'] ||
      iconChild?.attributes['data-fa-icon'] ||
      'fas fa-layer-group';
    const indexText = node.textContent.trim();
    const isDarkCard =
      node.classList.includes('b-item__top') ||
      node.classList.includes('p-card__art');

    return [
      createWidget(
        ctx,
        'icon-box',
        {
          selected_icon: { value: faIcon, library: 'fa-solid' },
          title_text: indexText || '',
          description_text: '',
          position: node.classList.includes('process__node') ? 'top' : 'right',
          text_align: node.classList.includes('process__node')
            ? 'center'
            : 'right',
          primary_color: isDarkCard ? '#A3F451' : '#06271F',
          title_color: isDarkCard
            ? 'rgba(163, 244, 81, 0.75)'
            : 'rgba(11, 68, 53, 0.45)',
          title_size: 'span',
        },
        `${node.uid}_card_head`
      ),
    ];
  }

  // Special Handler F: Star Rating Row (data-star-rating) -> star-rating
  if (node.attributes['data-star-rating']) {
    const ratingVal = parseInt(node.attributes['data-star-rating'], 10) || 5;
    const starSettings: Record<string, unknown> = {
      rating_scale: 5,
      rating: Math.min(5, Math.max(1, ratingVal)),
      star_style: 'star_fontawesome',
      unmarked_star_style: 'solid',
      align: node.styles.textAlign || 'right',
      icon_size: { unit: 'px', size: 16 },
      icon_space: { unit: 'px', size: 4 },
      stars_color: node.styles.color || '#FBBF24',
    };
    applyAdvancedWidgetSettings(node, starSettings);
    return [createWidget(ctx, 'star-rating', starSettings, `${node.uid}_stars`)];
  }

  // Special Handler G: Accordion / <details> Group -> accordion
  if (
    tag === 'details' ||
    (node.children.length > 0 &&
      node.children.every((c) => c.tag === 'details'))
  ) {
    const detailsList = tag === 'details' ? [node] : node.children;
    const firstDetail = detailsList[0];
    const tabs = detailsList.map((det, idx) => {
      const summaryNode = det.children.find((c) => c.tag === 'summary');
      const contentNodes = det.children.filter((c) => c.tag !== 'summary');
      const titleText =
        summaryNode?.textContent.trim() || `سوال متداول ${idx + 1}`;
      const bodyText =
        contentNodes.map((c) => c.textContent.trim()).join('\n') || '';
      return {
        _id: ctx.idRegistry.generateId(`acc_${det.uid}_${idx}`),
        tab_title: titleText,
        tab_content: `<p>${bodyText}</p>`,
      };
    });

    const accSettings: Record<string, unknown> = {
      tabs,
      selected_icon: { value: 'fas fa-chevron-down', library: 'fa-solid' },
      selected_active_icon: { value: 'fas fa-chevron-up', library: 'fa-solid' },
      title_html_tag: 'h4',
      border_width: { unit: 'px', size: 1 },
      border_color:
        firstDetail.styles.borderColor || 'rgba(255, 255, 255, 0.12)',
      title_background:
        firstDetail.styles.backgroundColor || 'rgba(15, 23, 42, 0.65)',
      title_color:
        firstDetail.children.find((c) => c.tag === 'summary')?.styles.color ||
        firstDetail.styles.color ||
        '#DEE2F6',
      tab_active_color: '#A5E7FF',
      content_background_color:
        firstDetail.styles.backgroundColor || 'rgba(15, 23, 42, 0.45)',
      content_color:
        firstDetail.children.find((c) => c.tag !== 'summary')?.styles.color ||
        '#C4C5D7',
    };
    applyAdvancedWidgetSettings(node, accSettings, { skipBackground: true });
    return [createWidget(ctx, 'accordion', accSettings, `${node.uid}_acc`)];
  }

  // Special Handler H: Radio / Checkbox <label> Option Card -> icon-box
  if (tag === 'label' && node.children.some((c) => c.tag === 'input')) {
    const labelText = node.textContent.trim();
    if (!labelText) return [];
    const inputChild = node.children.find((c) => c.tag === 'input');
    const isChecked = inputChild?.attributes.checked !== undefined;
    const isRadio = inputChild?.attributes.type === 'radio';
    const settings: Record<string, unknown> = {
      selected_icon: {
        value: isChecked
          ? isRadio
            ? 'fas fa-dot-circle'
            : 'fas fa-check-square'
          : isRadio
          ? 'far fa-circle'
          : 'far fa-square',
        library: 'fa-solid',
      },
      title_text: labelText,
      description_text: '',
      position: 'right',
      text_align: 'right',
      title_size: 'h5',
      primary_color: isChecked ? '#A5E7FF' : '#8E90A0',
      title_color: node.styles.color || '#DEE2F6',
    };
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'icon-box', settings, `${node.uid}_opt`)];
  }

  // Special Handler I: Standalone Icon Badge (empty text div with data-fa-icon, e.g. w-14 h-14 in Service / Process cards)
  if (
    tag === 'div' &&
    node.children.length === 0 &&
    !node.textContent.trim() &&
    Boolean(node.attributes['data-fa-icon'])
  ) {
    const settings: Record<string, unknown> = {
      selected_icon: {
        value: node.attributes['data-fa-icon'],
        library: 'fa-solid',
      },
      view: node.styles.backgroundColor ? 'stacked' : 'framed',
      shape: 'square',
      title_text: '',
      description_text: '',
      position: 'top',
      text_align: 'right',
      primary_color: node.styles.backgroundColor || '#252A39',
      secondary_color: node.styles.color || '#A5E7FF',
      icon_size: { unit: 'px', size: 22 },
      icon_padding: { unit: 'px', size: 12 },
    };
    return [createWidget(ctx, 'icon-box', settings, `${node.uid}_iconbadge`)];
  }

  // Special Handler I2: Inline Icon + Text Pill / Brand Trust Item (div with data-fa-icon and 1 text span child)
  if (
    tag === 'div' &&
    Boolean(node.attributes['data-fa-icon']) &&
    node.textContent.trim().length > 0 &&
    node.textContent.trim().length <= 90 &&
    node.children.length <= 1 &&
    !node.children.some((c) => ['div', 'ul', 'ol', 'article', 'img', 'form'].includes(c.tag))
  ) {
    const textChild = node.children[0] || node;
    const isCenteredPill =
      node.styles.textAlign === 'center' ||
      node.classList.includes('justify-center') ||
      node.classList.includes('inline-flex');
    const settings: Record<string, unknown> = {
      selected_icon: {
        value: node.attributes['data-fa-icon'],
        library: 'fa-solid',
      },
      view: 'default',
      title_text: node.textContent.trim(),
      description_text: '',
      position: 'right',
      text_align: isCenteredPill ? 'center' : 'right',
      title_size: 'span',
      primary_color: node.styles.color || '#A5E7FF',
      title_color: textChild.styles.color || node.styles.color || '#DEE2F6',
      icon_size: { unit: 'px', size: 18 },
    };
    if (node.classList.includes('inline-flex')) {
      settings._element_width = 'auto';
    }
    applyTypographySettings(textChild, settings, 'title_typography');
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'icon-box', settings, `${node.uid}_iconpill`)];
  }

  // Special Handler J: Horizontal Icon/Avatar + Text Feature Row (e.g. Comparison items, Testimonial author, Hero mini-cards)
  if (
    tag === 'div' &&
    node.children.length === 2 &&
    (node.classList.includes('flex') || node.classList.includes('inline-flex')) &&
    !node.classList.includes('justify-between')
  ) {
    const [firstChild, secondChild] = node.children;
    const firstIsIconOrAvatar =
      Boolean(firstChild.attributes['data-fa-icon']) ||
      (firstChild.rect.width <= 72 &&
        firstChild.textContent.trim().length <= 4);

    if (firstIsIconOrAvatar && secondChild.textContent.trim().length > 0) {
      const faIcon =
        firstChild.attributes['data-fa-icon'] || 'fas fa-user-circle';
      const headingInSecond = secondChild.children.find((c) =>
        /^h[1-6]$/.test(c.tag)
      );
      const parasInSecond = secondChild.children.filter(
        (c) => c !== headingInSecond && c.textContent.trim().length > 0
      );

      const titleStr = headingInSecond
        ? headingInSecond.textContent.trim()
        : secondChild.children[0]?.textContent.trim() ||
          secondChild.textContent.trim();
      const descStr = headingInSecond
        ? parasInSecond.map((p) => p.textContent.trim()).join(' — ')
        : secondChild.children
            .slice(1)
            .map((p) => p.textContent.trim())
            .join(' — ');

      const iconBoxSettings: Record<string, unknown> = {
        selected_icon: { value: faIcon, library: 'fa-solid' },
        view: firstChild.styles.backgroundColor ? 'stacked' : 'default',
        shape: 'rounded',
        title_text: titleStr,
        description_text: descStr,
        position: 'right',
        text_align: 'right',
        title_size: 'h4',
        primary_color:
          firstChild.styles.backgroundColor ||
          firstChild.styles.color ||
          '#A5E7FF',
        secondary_color: firstChild.styles.color || '#A5E7FF',
        title_color:
          headingInSecond?.styles.color ||
          secondChild.children[0]?.styles.color ||
          node.styles.color ||
          '#DEE2F6',
        description_color:
          parasInSecond[0]?.styles.color ||
          secondChild.styles.color ||
          '#C4C5D7',
      };
      applyAdvancedWidgetSettings(node, iconBoxSettings);
      return [createWidget(ctx, 'icon-box', iconBoxSettings, `${node.uid}_fitem`)];
    }
  }

  // Special Handler K: Price Baseline Row (e.g. "۲۹" + "میلیون تومان") -> heading
  if (
    tag === 'div' &&
    node.classList.includes('items-baseline') &&
    node.children.length >= 1
  ) {
    const combinedPrice = node.children
      .map((c) => c.textContent.trim())
      .filter(Boolean)
      .join(' ');
    if (combinedPrice) {
      const mainChild = node.children[0];
      const settings: Record<string, unknown> = {
        title: combinedPrice,
        header_size: 'h3',
        title_color: mainChild.styles.color || node.styles.color || '#A5E7FF',
      };
      applyAlignmentSettings(node, settings, 'align');
      applyTypographySettings(mainChild, settings, 'typography');
      applyAdvancedWidgetSettings(node, settings);
      return [createWidget(ctx, 'heading', settings, `${node.uid}_price`)];
    }
  }

  // Special Handler L: Inline Tech Tags / Filter Pills Row (e.g. Next.js 14 · Tailwind CSS · PostgreSQL) -> inline icon-list
  if (
    tag === 'div' &&
    node.children.length >= 2 &&
    node.children.every(
      (c) =>
        (c.tag === 'span' || c.tag === 'button') &&
        c.textContent.trim().length > 0 &&
        c.textContent.trim().length <= 32
    )
  ) {
    const items = node.children.map((pill, idx) => ({
      _id: ctx.idRegistry.generateId(`pill_${node.uid}_${idx}`),
      text: pill.textContent.trim(),
      selected_icon: { value: 'fas fa-tag', library: 'fa-solid' },
      link: { url: '', is_external: '', nofollow: '' },
    }));
    const firstPill = node.children[0];
    const settings: Record<string, unknown> = {
      icon_list: items,
      view: 'inline',
      space_between: { unit: 'px', size: 12 },
      icon_color: '#A5E7FF',
      text_color: firstPill.styles.color || node.styles.color || '#C4C5D7',
    };
    applyTypographySettings(firstPill, settings, 'icon_typography');
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'icon-list', settings, `${node.uid}_pills`)];
  }

  // 1. Headings (h1 - h6 or <p/div/span data-el-heading-p="true">) -> heading
  if (
    /^h[1-6]$/.test(tag) ||
    (['p', 'div', 'span'].includes(tag) &&
      node.attributes['data-el-heading-p'] === 'true')
  ) {
    const hasSafeInlineFormatting =
      /<(em|strong|mark|br|span)\b/i.test(node.innerHTMLClean) &&
      !/<(a|div|p|h[1-6]|svg|img|ul|ol)\b/i.test(node.innerHTMLClean);
    const titleText =
      (hasSafeInlineFormatting
        ? node.innerHTMLClean.trim()
        : node.textContent.trim()) || '[عنوان را جایگزین کنید]';
    if (!node.textContent.trim()) {
      ctx.placeholders.push({
        type: 'text',
        element: tag,
        placeholderValue: titleText,
        description: `تگ ${tag.toUpperCase()} بدون متن بود؛ با Placeholder قابل ویرایش جایگزین شد.`,
      });
    }

    const settings: Record<string, unknown> = {
      title: titleText,
      header_size: ['p', 'div', 'span'].includes(tag) ? tag : tag,
    };

    if (node.styles.color) {
      settings.title_color = node.styles.color;
    }

    const linkChild = node.children.find((c) => c.tag === 'a');
    if (linkChild?.attributes.href) {
      settings.link = {
        url: linkChild.attributes.href,
        is_external: linkChild.attributes.href.startsWith('http') ? 'on' : '',
        nofollow: '',
      };
    }

    applyAlignmentSettings(node, settings, 'align');
    applyTypographySettings(node, settings, 'typography');
    applyAdvancedWidgetSettings(node, settings);

    return [createWidget(ctx, 'heading', settings, node.uid)];
  }

  // 2. Horizontal Rule (hr) -> divider
  if (tag === 'hr') {
    const settings: Record<string, unknown> = {
      style: 'solid',
      weight: {
        unit: 'px',
        size: Math.max(1, node.styles.borderWidth.top || 1),
      },
      color: node.styles.borderColor || '#E2E8F0',
      gap: {
        unit: 'px',
        size: Math.max(10, node.styles.margin.top || 15),
      },
    };
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'divider', settings, node.uid)];
  }

  // 3. Image (img / picture) -> image (or inline SVG widget when data-raw-svg is present so WordPress esc_url() does not strip data:image/svg+xml)
  if (tag === 'img' || tag === 'picture') {
    const rawSvgMarkup = node.attributes['data-raw-svg'];
    if (rawSvgMarkup && ctx.settings.embedAssetsInPageJson !== false) {
      const svgWidgetSettings: Record<string, unknown> = {
        html: rawSvgMarkup,
      };
      if (node.classList.length > 0) {
        svgWidgetSettings._css_classes = node.classList.join(' ');
      }
      if (node.idAttr) {
        svgWidgetSettings._element_id = node.idAttr;
      }
      return [createWidget(ctx, 'html', svgWidgetSettings, `${node.uid}_inline_svg`)];
    }

    let imageUrl = node.attributes.src || '';
    if (tag === 'picture') {
      const innerImg = node.children.find((c) => c.tag === 'img');
      imageUrl = innerImg?.attributes.src || '';
    }
    if (!imageUrl) {
      const w = Math.max(100, node.rect.width || 400);
      const h = Math.max(100, node.rect.height || 300);
      imageUrl = `https://placehold.co/${w}x${h}?text=Replace+Image`;
      ctx.placeholders.push({
        type: 'image',
        element: tag,
        placeholderValue: imageUrl,
        description: `عنصر ${tag} به ویجت تصویر Elementor با Placeholder استاندارد تبدیل شد.`,
      });
    }

    const settings: Record<string, unknown> = {
      image: {
        url: imageUrl,
        id: '',
        alt: node.attributes.alt || 'تصویر قالب',
      },
      image_size: 'full',
    };

    if (node.rect.width > 0 && node.rect.width < 1200) {
      settings.width = {
        unit: 'px',
        size: node.rect.width,
      };
    }

    if (hasNonZeroEdges(node.styles.borderRadius)) {
      settings.image_border_radius = buildElementorDimension(
        node.styles.borderRadius,
        'px'
      );
    }

    if (node.styles.boxShadow) {
      settings.image_box_shadow_box_shadow_type = 'yes';
      settings.image_box_shadow_box_shadow = node.styles.boxShadow;
    }

    applyAlignmentSettings(node, settings, 'align');
    applyAdvancedWidgetSettings(node, settings);

    return [createWidget(ctx, 'image', settings, node.uid)];
  }

  // 4. Linked Image Card (e.g. <a class="g-tile"> when not already handled by Column background)
  const linkedCard = isLinkedImageCard(node);
  if (linkedCard) {
    const titleWidget = createWidget(
      ctx,
      'heading',
      {
        title: linkedCard.title,
        header_size: 'h3',
        title_color: '#FFFFFF',
        align: 'right',
        link: {
          url: linkedCard.href,
          is_external: linkedCard.href.startsWith('http') ? 'on' : '',
          nofollow: '',
        },
        typography_typography: 'custom',
        typography_font_family: 'Peyda',
        typography_font_size: { unit: 'px', size: 22 },
        typography_font_weight: '800',
      },
      `${node.uid}_gtitle`
    );

    const captionWidget = createWidget(
      ctx,
      'icon-list',
      {
        icon_list: [
          {
            _id: ctx.idRegistry.generateId(`gcap_${node.uid}`),
            text: linkedCard.caption,
            selected_icon: {
              value: 'fas fa-map-marker-alt',
              library: 'fa-solid',
            },
            link: {
              url: linkedCard.href,
              is_external: linkedCard.href.startsWith('http') ? 'on' : '',
              nofollow: '',
            },
          },
        ],
        icon_color: '#A3F451',
        text_color: 'rgba(233, 247, 240, 0.9)',
        icon_align: 'right',
        icon_typography_typography: 'custom',
        icon_typography_font_family: 'Peyda',
        icon_typography_font_size: { unit: 'px', size: 13 },
      },
      `${node.uid}_gcap`
    );

    return [titleWidget, captionWidget];
  }

  // 5. Button or CTA Anchor -> button
  if (isButtonLikeLink(node)) {
    const rawText =
      node.textContent.trim() ||
      node.attributes['aria-label']?.trim() ||
      node.attributes.title?.trim() ||
      '';

    if (!rawText) return [];

    const rawHref = (node.attributes.href || '#').trim();
    const isExternal =
      node.attributes.target === '_blank' || rawHref.startsWith('http');
    const nofollow = (node.attributes.rel || '').includes('nofollow');
    const isLinkVariant = node.classList.includes('btn--link');

    const btnGrad = parseLinearGradient(node.styles.backgroundImage);
    const settings: Record<string, unknown> = {
      text: rawText,
      link: {
        url: rawHref || '#',
        is_external: isExternal ? 'on' : '',
        nofollow: nofollow ? 'on' : '',
      },
      size: 'md',
      background_color:
        btnGrad?.colorA || node.styles.backgroundColor || '#00000000',
      button_text_color: node.styles.color || '#0B4435',
    };

    if (btnGrad) {
      settings.background_background = 'gradient';
      settings.background_color_b = btnGrad.colorB;
      settings.background_gradient_angle = {
        unit: 'deg',
        size: btnGrad.angle,
      };
    }

    const btnIcon = node.attributes['data-fa-icon'];
    if (btnIcon) {
      settings.selected_icon = {
        value: btnIcon,
        library: 'fa-solid',
      };
      settings.icon_align = 'right';
      settings.icon_indent = { unit: 'px', size: 8 };
    } else if (isLinkVariant) {
      settings.selected_icon = {
        value: 'fas fa-arrow-left',
        library: 'fa-solid',
      };
      settings.icon_align = 'right';
      settings.icon_indent = { unit: 'px', size: 8 };
    }

    if (hasNonZeroEdges(node.styles.borderRadius)) {
      settings.border_radius = buildElementorDimension(
        node.styles.borderRadius,
        'px'
      );
    }
    if (hasNonZeroEdges(node.styles.padding)) {
      settings.text_padding = buildElementorDimension(
        node.styles.padding,
        'px'
      );
    }

    if (inlineGroup) {
      settings._element_width = 'auto';
    }

    applyAlignmentSettings(node, settings, 'align');
    applyTypographySettings(node, settings, 'typography');
    // Skip duplicate _padding and _background on button wrapper
    applyAdvancedWidgetSettings(node, settings, {
      skipBackground: true,
      skipPadding: true,
    });

    return [createWidget(ctx, 'button', settings, node.uid)];
  }

  // 6. Horizontal Button Group (.hero__actions / .cta-panel__actions / .gf-actions / .ga-actions) -> inline buttons
  if (
    node.children.length >= 2 &&
    node.children.every((c) => isButtonLikeLink(c))
  ) {
    const inlineButtons: ElementorNode[] = [];
    for (const btnChild of node.children) {
      inlineButtons.push(...mapNodeToElementorWidgets(btnChild, ctx, true, false));
    }
    const childIds = inlineButtons.map((w) => w.id);
    if (!isColumnRoot && (node.classList.length > 0 || node.idAttr) && childIds.length > 0) {
      const wrapperId = ctx.idRegistry.generateId(`wrap_${node.uid}`);
      ctx.reconstructedWrappers.push({
        wrapperId,
        tag: node.tag || 'div',
        id: node.idAttr || undefined,
        className: node.classList.join(' '),
        childIds,
      });
      ctx.nodeEffectiveIds.set(node.uid, [wrapperId]);
    } else {
      ctx.nodeEffectiveIds.set(node.uid, childIds);
    }
    return inlineButtons;
  }

  // 7. Video / YouTube / Vimeo / Google Maps Iframe
  if (tag === 'video' || tag === 'iframe') {
    const src = (
      node.attributes.src ||
      node.children.find((c) => c.tag === 'source')?.attributes.src ||
      ''
    ).trim();

    if (
      src.includes('google.com/maps') ||
      src.includes('maps.google') ||
      node.classList.some((c) => c.includes('map'))
    ) {
      const settings: Record<string, unknown> = {
        address: node.attributes.title || 'Tehran, Iran',
        zoom: { unit: 'px', size: 14 },
        height: { unit: 'px', size: Math.max(250, node.rect.height || 350) },
      };
      applyAdvancedWidgetSettings(node, settings);
      return [createWidget(ctx, 'google_maps', settings, node.uid)];
    }

    const isVimeo = src.includes('vimeo.com');
    const settings: Record<string, unknown> = {
      video_type: isVimeo ? 'vimeo' : 'youtube',
      youtube_url: isVimeo
        ? ''
        : src.startsWith('http')
        ? src
        : 'https://www.youtube.com/watch?v=XHOmBV4js_E',
      vimeo_url: isVimeo ? src : '',
      controls: 'yes',
    };
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'video', settings, node.uid)];
  }

  // 8. Social Icons Group -> social-icons
  if (isSocialLinksGroup(node)) {
    const anchors =
      node.tag === 'ul'
        ? node.children
            .map((li) => li.children.find((c) => c.tag === 'a'))
            .filter((a): a is ParsedDOMNode => Boolean(a))
        : node.children.filter((c) => c.tag === 'a');

    const socialList = anchors.map((a, idx) => {
      const href = (a.attributes.href || '#').toLowerCase();
      let iconVal = 'fas fa-globe';
      if (href.includes('twitter') || href.includes('x.com'))
        iconVal = 'fab fa-twitter';
      else if (href.includes('linkedin')) iconVal = 'fab fa-linkedin';
      else if (href.includes('instagram')) iconVal = 'fab fa-instagram';
      else if (href.includes('github')) iconVal = 'fab fa-github';
      else if (href.includes('telegram') || href.includes('t.me'))
        iconVal = 'fab fa-telegram';
      else if (href.includes('whatsapp') || href.includes('wa.me'))
        iconVal = 'fab fa-whatsapp';
      else if (href.includes('youtube')) iconVal = 'fab fa-youtube';

      return {
        _id: ctx.idRegistry.generateId(`soc_${idx}`),
        social_icon: {
          value: iconVal,
          library: iconVal.startsWith('fab') ? 'fa-brands' : 'fa-solid',
        },
        link: {
          url: a.attributes.href || '#',
          is_external: 'on',
          nofollow: '',
        },
      };
    });

    const settings: Record<string, unknown> = {
      social_icon_list: socialList,
      shape: 'rounded',
      align: node.styles.textAlign || 'right',
    };
    applyAdvancedWidgetSettings(node, settings);
    return [createWidget(ctx, 'social-icons', settings, node.uid)];
  }

  // 9. Simple Lists (ul / ol) -> icon-list
  if (isSimpleTextList(node)) {
    const liChildren = node.children.filter((c) => c.tag === 'li');
    const isHorizontalList =
      node.styles.display.includes('flex') &&
      !node.styles.flexDirection.startsWith('column');

    const items = liChildren
      .map((li, idx) => {
        const linkChild = li.children.find(
          (c) => c.tag === 'a' || c.tag === 'button'
        );
        const itemText = (linkChild ? linkChild.textContent : li.textContent).trim();
        if (!itemText) return null;

        return {
          _id: ctx.idRegistry.generateId(`item_${node.uid}_${idx}`),
          text: itemText,
          selected_icon: {
            value: isHorizontalList
              ? ''
              : tag === 'ol'
              ? 'fas fa-angle-left'
              : 'fas fa-check-circle',
            library: 'fa-solid',
          },
          link: {
            url: linkChild?.attributes.href || '',
            is_external: '',
            nofollow: '',
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (items.length > 0) {
      const settings: Record<string, unknown> = {
        icon_list: items,
        view: isHorizontalList ? 'inline' : 'traditional',
        space_between: {
          unit: 'px',
          size: Math.max(8, node.styles.gapPx || 12),
        },
        icon_color: '#19C58B',
        text_color: node.styles.color || '#172B25',
      };

      applyAlignmentSettings(node, settings, 'icon_align');
      applyTypographySettings(node, settings, 'icon_typography');
      applyAdvancedWidgetSettings(node, settings);
      return [createWidget(ctx, 'icon-list', settings, node.uid)];
    }
  }

  // 10. Forms (<form>) -> Native decomposition if Pro is off, or Pro form if Pro is on
  if (tag === 'form') {
    if (ctx.settings.hasElementorPro) {
      const inputs = node.children.filter((c) =>
        ['input', 'textarea', 'select'].includes(c.tag)
      );
      const formFields =
        inputs.length > 0
          ? inputs.map((inp, idx) => ({
              _id: ctx.idRegistry.generateId(`field_${idx}`),
              field_type: inp.tag === 'textarea' ? 'textarea' : 'text',
              field_label:
                inp.attributes.placeholder ||
                inp.attributes.name ||
                `فیلد ${idx + 1}`,
              placeholder: inp.attributes.placeholder || '',
              width: '100',
            }))
          : [
              {
                _id: ctx.idRegistry.generateId('field_email'),
                field_type: 'email',
                field_label: 'ایمیل',
                placeholder: 'وارد کردن ایمیل...',
                width: '100',
              },
            ];

      const settings: Record<string, unknown> = {
        form_name: 'فرم ارتباطی',
        form_fields: formFields,
        button_text: 'ارسال پیام',
      };
      applyAdvancedWidgetSettings(node, settings);
      return [createWidget(ctx, 'form', settings, node.uid)];
    }

    ctx.replacedWidgets.push({
      originalElement: `<form${node.idAttr ? ` id="${node.idAttr}"` : ''}>`,
      mappedTo: 'heading + icon-box + button (تفکیک بومی مراحل فرم)',
      reason:
        'Elementor Pro غیرفعال است؛ فیلدها و گزینه‌های فرم به ویجت‌های بومی قابل ویرایش + دکمه ثبت تبدیل شدند.',
    });
    ctx.placeholders.push({
      type: 'pro-fallback',
      element: 'form',
      placeholderValue: '[جایگاه فرم تعاملی - بازسازی‌شده با ویجت‌های بومی]',
      description:
        'مراحل و گزینه‌های فرم به ویجت‌های بومی تبدیل شدند تا ظاهر صفحه کاملاً حفظ شود و بدون خطا ایمپورت گردد.',
    });
    ctx.manualAdjustments.add(
      'جایگزینی بلوک فرم با شورت‌کد Contact Form 7 / WPForms یا فعال‌سازی Elementor Pro'
    );

    const formWidgets: ElementorNode[] = [];
    for (const child of node.children) {
      formWidgets.push(...mapNodeToElementorWidgets(child, ctx));
    }

    if (formWidgets.length === 0) {
      formWidgets.push(
        createWidget(
          ctx,
          'button',
          {
            text: 'ارسال درخواست مشاوره',
            link: { url: '#', is_external: '', nofollow: '' },
            align: 'center',
            background_color: '#1D4ED8',
            button_text_color: '#FFFFFF',
          },
          `${node.uid}_btn`
        )
      );
    }

    return formWidgets;
  }

  // 10b. Input / Textarea / Select field inside form -> styled text-editor input box
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (node.attributes.type === 'submit') {
      const btnText = node.attributes.value || 'ارسال درخواست';
      return [
        createWidget(
          ctx,
          'button',
          {
            text: btnText,
            link: { url: '#', is_external: '', nofollow: '' },
            align: 'center',
            background_color: node.styles.backgroundColor || '#1D4ED8',
            button_text_color: node.styles.color || '#FFFFFF',
          },
          `${node.uid}_sub`
        ),
      ];
    }
    const placeholder =
      node.attributes.placeholder ||
      node.attributes.value ||
      node.attributes.name ||
      'وارد کردن مقدار...';
    const inputSettings: Record<string, unknown> = {
      editor: `<p>${placeholder}</p>`,
      text_color: 'rgba(196, 197, 215, 0.65)',
      align: node.attributes.dir === 'ltr' ? 'left' : 'right',
    };
    applyTypographySettings(node, inputSettings, 'typography');
    applyAdvancedWidgetSettings(node, inputSettings);
    return [createWidget(ctx, 'text-editor', inputSettings, `${node.uid}_inp`)];
  }

  // 11. Empty decorative container -> skip unless explicit spacer
  if (
    node.children.length === 0 &&
    !node.textContent.trim() &&
    !extractCssUrl(node.styles.backgroundImage)
  ) {
    const classStr = node.classList.join(' ').toLowerCase();
    if (/\b(spacer|gap)\b/.test(classStr) && node.rect.height >= 8) {
      const settings: Record<string, unknown> = {
        space: {
          unit: 'px',
          size: Math.min(160, Math.round(node.rect.height)),
        },
      };
      return [createWidget(ctx, 'spacer', settings, node.uid)];
    }
    return [];
  }

  // 12. Paragraph / Rich Text / Blockquote / Inline Span-Split Text -> text-editor
  const onlyInlineFormattingChildren =
    (tag === 'p' || tag === 'span' || tag === 'blockquote') &&
    node.children.length > 0 &&
    node.children.every(
      (c) =>
        ['span', 'em', 'strong', 'b', 'i', 'small', 'mark', 'code', 'time', 'data'].includes(
          c.tag
        ) && !isButtonLikeLink(c)
    );

  if (
    tag === 'p' ||
    tag === 'blockquote' ||
    tag === 'span' ||
    (tag === 'a' &&
      !hasDescendantTag(
        node,
        new Set(['img', 'h1', 'h2', 'h3', 'h4', 'article'])
      )) ||
    node.children.length === 0 ||
    onlyInlineFormattingChildren
  ) {
    const cleanText = node.textContent.trim();
    if (!cleanText) return [];

    let editorHtml = `<p>${cleanText}</p>`;
    if (tag === 'a') {
      const href = node.attributes.href || '#';
      editorHtml = `<p><a href="${href}">${cleanText}</a></p>`;
    } else if (tag === 'blockquote') {
      editorHtml = `<blockquote>${cleanText}</blockquote>`;
    }

    const settings: Record<string, unknown> = {
      editor: editorHtml,
    };

    if (node.styles.color) {
      settings.text_color = node.styles.color;
    }

    applyAlignmentSettings(node, settings, 'align');
    applyTypographySettings(node, settings, 'typography');
    applyAdvancedWidgetSettings(node, settings);

    return [createWidget(ctx, 'text-editor', settings, node.uid)];
  }

  // 13. Composite generic container: recursively map its children into native widgets
  const results: ElementorNode[] = [];
  const effectiveChildDomIds: string[] = [];

  if (node.directText) {
    const directTextWidget = createWidget(
      ctx,
      'text-editor',
      {
        editor: `<p>${node.directText}</p>`,
        text_color: node.styles.color || '#334155',
        align: node.styles.textAlign || 'right',
      },
      `${node.uid}_direct_text`
    );
    results.push(directTextWidget);
    effectiveChildDomIds.push(directTextWidget.id);
  }

  for (const child of node.children) {
    const childWidgets = mapNodeToElementorWidgets(child, ctx, false, false);
    results.push(...childWidgets);
    const childEffIds =
      ctx.nodeEffectiveIds.get(child.uid) || childWidgets.map((w) => w.id);
    effectiveChildDomIds.push(...childEffIds);
  }

  const meaningfulClasses = node.classList.filter(
    (c) =>
      c !== 'container' &&
      !c.endsWith('-wrap') &&
      !c.endsWith('-layout') &&
      !c.startsWith('e-con')
  );

  if (
    !isColumnRoot &&
    (meaningfulClasses.length > 0 || node.idAttr) &&
    effectiveChildDomIds.length > 0
  ) {
    const wrapperId = ctx.idRegistry.generateId(`wrap_${node.uid}`);
    ctx.reconstructedWrappers.push({
      wrapperId,
      tag: node.tag || 'div',
      id: node.idAttr || undefined,
      className: meaningfulClasses.join(' '),
      childIds: effectiveChildDomIds,
    });
    ctx.nodeEffectiveIds.set(node.uid, [wrapperId]);
  } else {
    ctx.nodeEffectiveIds.set(node.uid, effectiveChildDomIds);
  }

  return results;
}
