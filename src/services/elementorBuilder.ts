// ===== IMPORTS & DEPENDENCIES =====
import {
  ComputedElementDimensionsSnapshot,
  ConverterSettings,
  ElementorNode,
  ElementorTemplateJSON,
  ExtractedSvgAsset,
  ParsedDOMNode,
  PlaceholderEntry,
  ReplacedWidgetEntry,
  WrapperReconstructionSpec,
} from '../types/elementor';
import { injectComputedStylesIntoElementorController } from './htmlParser';
import { ElementorIdRegistry } from './idGenerator';
import {
  buildElementorDimension,
  extractCssUrl,
  hasNonZeroEdges,
  parseLinearGradient,
} from './styleUtils';
import {
  applyEntranceAnimation,
  isButtonLikeLink,
  isLinkedImageCard,
  isSimpleTextList,
  MappingContext,
  mapNodeToElementorWidgets,
} from './widgetMapper';

// ===== TYPES & INTERFACES =====
export interface BuildPipelineOutput {
  templateJson: ElementorTemplateJSON;
  counts: {
    sections: number;
    innerSections: number;
    columns: number;
    containers: number;
    widgets: number;
    decorativeWidgets: number;
  };
  widgetBreakdown: Record<string, number>;
  replacedWidgets: ReplacedWidgetEntry[];
  placeholders: PlaceholderEntry[];
  manualAdjustments: string[];
  reconstructedWrappers: WrapperReconstructionSpec[];
  extractedSvgs: ExtractedSvgAsset[];
}

// ===== CONFIGURATION & CONSTANTS =====

// Semantic vertical content blocks or composite widgets that should NEVER be split into sub-columns
const VERTICAL_STACK_CLASSES = [
  'sh',
  'hero__content',
  'hero__visual',
  'hv',
  'cc',
  'capabilities__content',
  'capabilities__text',
  'capabilities__visual',
  'capabilities__list',
  'roadmap__content',
  'roadmap__track',
  'roadmap__rail',
  'roadmap__list',
  'cta-panel',
  'cta-panel__content',
  's-card',
  'b-item',
  'p-card',
  'p-notice',
  'process__step',
  'roadmap__card',
  'roadmap__item',
  'site-footer__brand',
  'site-footer__col',
  'gf-hero-copy',
  'gf-intro-copy',
  'gf-intro-head',
  'gf-stat-card',
  'gf-main',
  'gf-content',
  'gf-group',
  'gf-group-head',
  'gf-item',
  'gf-final-copy',
  'gf-related-copy',
  'gf-related-links',
  'gf-aside',
  'gf-aside-wrap',
];

const VERTICAL_STACK_SUFFIX_REGEX =
  /-(hero-copy|intro-copy|intro-head|stat-card|main|content|group|group-head|item|final-copy|related-copy|related-links|aside|aside-wrap|card|step|panel-copy)$/i;

// ===== UTILITY FUNCTIONS =====

function isContainerWrapper(node: ParsedDOMNode): boolean {
  return node.classList.some(
    (c) =>
      c === 'container' ||
      c === 'mx-auto' ||
      c.endsWith('-shell') ||
      (c.endsWith('-wrap') && !c.includes('aside')) ||
      c.startsWith('max-w-7xl') ||
      c.startsWith('max-w-6xl') ||
      c.startsWith('max-w-5xl') ||
      c.startsWith('max-w-4xl')
  );
}

function isVerticalContentStack(node: ParsedDOMNode): boolean {
  if (isLinkedImageCard(node)) return true;
  if (
    ['label', 'summary', 'details'].includes(node.tag) ||
    node.attributes['data-star-rating'] ||
    node.attributes['data-el-html-widget'] === 'true'
  ) {
    return true;
  }
  // If a node is explicitly a CSS Grid (e.g. grid-cols-*, *-grid, *-layout), it is a layout grid, not a vertical stack
  const isExplicitGrid =
    node.classList.includes('grid') ||
    node.classList.some(
      (c) =>
        c.includes('grid-cols-') ||
        c.endsWith('-grid') ||
        c.endsWith('-layout')
    );
  if (isExplicitGrid) return false;

  for (const cls of node.classList) {
    if (
      VERTICAL_STACK_CLASSES.includes(cls) ||
      VERTICAL_STACK_SUFFIX_REGEX.test(cls)
    ) {
      return true;
    }
  }
  return false;
}

function hasCardVisualBox(node: ParsedDOMNode): boolean {
  const { styles } = node;
  if (styles.backgroundColor) return true;
  if (styles.backgroundImage && styles.backgroundImage !== 'none') return true;
  if (styles.borderStyle !== 'none' && hasNonZeroEdges(styles.borderWidth)) {
    return true;
  }
  if (styles.boxShadow) return true;
  return node.classList.some(
    (c) =>
      [
        'p-card',
        's-card',
        'b-item',
        'cta-panel',
        'p-notice',
        'g-tile',
        'glass-panel',
        'glass-panel-elevated',
        'gf-final-box',
      ].includes(c) ||
      c.endsWith('-final-box') ||
      c.endsWith('-card') ||
      c.endsWith('-box')
  );
}

/**
 * Unwraps unstyled single-child structural wrappers (like <li class="services__item"> -> <article class="s-card">)
 * and stops IMMEDIATELY once it reaches a styled card node (like .p-card, .s-card, .cta-panel) so the card's
 * background, border, and radius are never lost!
 */
function unwrapSingleCardTarget(node: ParsedDOMNode): ParsedDOMNode {
  if (isLinkedImageCard(node) || node.isDecorative) return node;

  let current = node;
  const nonDecorChildren = current.children.filter((c) => !c.isDecorative);

  // Only unwrap if `current` does NOT already have its own card background/border
  if (
    !hasCardVisualBox(current) &&
    nonDecorChildren.length === 1 &&
    !current.directText &&
    ['article', 'div'].includes(nonDecorChildren[0].tag)
  ) {
    current = nonDecorChildren[0];
  }

  // If `current` is a card (like .p-card--custom) whose padding is on an inner .p-card__body child, inherit that padding
  const currentNonDecor = current.children.filter((c) => !c.isDecorative);
  if (
    !hasNonZeroEdges(current.styles.padding) &&
    currentNonDecor.length === 1 &&
    currentNonDecor[0].tag === 'div'
  ) {
    const inner = currentNonDecor[0];
    const bodyChild = inner.children.find((c) =>
      c.classList.some((cls) => cls.includes('body'))
    );
    if (bodyChild && hasNonZeroEdges(bodyChild.styles.padding)) {
      current = {
        ...current,
        styles: {
          ...current.styles,
          padding: bodyChild.styles.padding,
        },
      };
    }
  }

  return current;
}

function hasMeaningfulContent(node: ParsedDOMNode): boolean {
  if (node.isDecorative) return false;
  if (
    node.attributes['data-el-html-widget'] === 'true' ||
    Boolean(node.attributes['data-raw-svg'])
  ) {
    return true;
  }
  if (node.textContent.trim().length > 0) return true;
  if (node.tag === 'img' || Boolean(node.attributes['data-svg-src'])) return true;
  return node.children.some(hasMeaningfulContent);
}

/**
 * Groups children of a grid or flex container into visual horizontal rows based on their
 * rendered Desktop bounding box coordinates.
 */
function extractVisualColumnRows(node: ParsedDOMNode): ParsedDOMNode[][] | null {
  if (
    node.isDecorative ||
    /^h[1-6]$/.test(node.tag) ||
    node.tag === 'p' ||
    node.tag === 'a' ||
    node.tag === 'button' ||
    node.tag === 'label' ||
    node.tag === 'summary' ||
    node.tag === 'details' ||
    node.classList.includes('inline-flex') ||
    node.classList.includes('items-baseline') ||
    node.classList.some((c) => c.startsWith('aspect-')) ||
    isSimpleTextList(node) ||
    isVerticalContentStack(node)
  ) {
    return null;
  }

  const validChildren = node.children.filter(
    (c) =>
      !c.isDecorative &&
      c.styles.position !== 'absolute' &&
      !c.classList.includes('absolute') &&
      c.rect.width > 24 &&
      c.rect.height > 12 &&
      hasMeaningfulContent(c)
  );
  if (validChildren.length < 2) return null;

  if (validChildren.every((c) => isButtonLikeLink(c))) {
    return null;
  }

  // Do not split inline pill/tag/button/span groups (e.g. tech tags or filter tabs or price baseline) into layout columns
  if (
    validChildren.every((c) =>
      ['span', 'button', 'a', 'input', 'code', 'strong', 'small'].includes(c.tag)
    )
  ) {
    return null;
  }

  // Do not split an icon/avatar + text pair (where one child is a small icon/avatar box <= 72px wide) into layout columns
  if (
    validChildren.length === 2 &&
    validChildren.some(
      (c) =>
        c.rect.width <= 72 &&
        (c.rect.width <= 64 ||
          Boolean(c.attributes['data-fa-icon']) ||
          c.classList.some(
            (cls) =>
              cls.startsWith('w-8') ||
              cls.startsWith('w-9') ||
              cls.startsWith('w-10') ||
              cls.startsWith('w-11') ||
              cls.startsWith('w-12') ||
              cls.startsWith('w-14') ||
              cls.includes('icon') ||
              cls.includes('symbol') ||
              cls.includes('badge')
          ))
    )
  ) {
    return null;
  }

  const rows: ParsedDOMNode[][] = [];

  for (const child of validChildren) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      rows.push([child]);
      continue;
    }

    const belongsToSameRow = lastRow.every((existing) => {
      const topMax = Math.max(existing.rect.y, child.rect.y);
      const bottomMin = Math.min(
        existing.rect.y + existing.rect.height,
        child.rect.y + child.rect.height
      );
      const verticalOverlap = bottomMin - topMax;
      const minHeight = Math.min(existing.rect.height, child.rect.height);

      const leftMax = Math.max(existing.rect.x, child.rect.x);
      const rightMin = Math.min(
        existing.rect.x + existing.rect.width,
        child.rect.x + child.rect.width
      );
      const horizontalOverlap = rightMin - leftMax;

      return (
        verticalOverlap >= Math.min(12, minHeight * 0.25) &&
        horizontalOverlap <= 12
      );
    });

    if (belongsToSameRow && lastRow.length < 6) {
      lastRow.push(child);
    } else {
      rows.push([child]);
    }
  }

  const hasMultiColumnRow = rows.some((r) => r.length >= 2);
  if (!hasMultiColumnRow) return null;

  return rows;
}

function computeColumnPercentages(children: ParsedDOMNode[]): number[] {
  const count = children.length;
  if (count === 0) return [];
  if (count === 1) return [100];
  if (count === 3) return [33, 33, 33];
  if (count === 4) return [25, 25, 25, 25];
  if (count === 5) return [20, 20, 20, 20, 20];

  const widths = children.map((c) => Math.max(1, c.rect.width));
  const totalWidth = widths.reduce((acc, w) => acc + w, 0);

  if (count === 2) {
    if (totalWidth <= 2) return [50, 50];
    const firstRaw = (widths[0] / totalWidth) * 100;
    const validPairs: [number, number][] = [
      [50, 50],
      [40, 60],
      [60, 40],
      [33, 66],
      [66, 33],
      [30, 70],
      [70, 30],
      [25, 75],
      [75, 25],
      [20, 80],
      [80, 20],
    ];
    let bestPair: [number, number] = [50, 50];
    let bestDiff = Infinity;
    for (const pair of validPairs) {
      const diff = Math.abs(pair[0] - firstRaw);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPair = pair;
      }
    }
    return [...bestPair];
  }

  if (totalWidth <= count) {
    const base = Math.floor(100 / count);
    const sizes = Array(count).fill(base);
    sizes[count - 1] += 100 - base * count;
    return sizes;
  }

  const rawPercentages = widths.map((w) =>
    Math.max(10, Math.round((w / totalWidth) * 100))
  );
  const sum = rawPercentages.reduce((acc, p) => acc + p, 0);
  const diff = 100 - sum;
  rawPercentages[rawPercentages.length - 1] = Math.max(
    10,
    rawPercentages[rawPercentages.length - 1] + diff
  );

  const finalSum = rawPercentages.reduce((acc, p) => acc + p, 0);
  if (finalSum !== 100) {
    rawPercentages[0] += 100 - finalSum;
  }

  return rawPercentages;
}

/**
 * Applies Section/Column/Container background, border, shadow, margin, padding, css_classes, css_id, and entrance animation settings.
 */
function extractSectionOrContainerSettings(
  node: ParsedDOMNode,
  stripAutoCenterMargin = true,
  extraScopeClass = ''
): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  const { styles, tabletOverrides, mobileOverrides } = node;

  // Requirement 3: Preserve original HTML classes in css_classes and id in css_id
  const classParts = [...node.classList];
  if (extraScopeClass && !classParts.includes(extraScopeClass)) {
    classParts.push(extraScopeClass);
  }
  if (classParts.length > 0) {
    settings.css_classes = classParts.join(' ');
  }
  if (node.idAttr) {
    settings.css_id = node.idAttr;
  }

  // Requirement 2: Transfer real min-height to section/container settings
  if (styles.minHeightPx >= 120) {
    settings.height = 'min-height';
    settings.custom_height = { unit: 'px', size: styles.minHeightPx };
    settings.min_height = { unit: 'px', size: styles.minHeightPx };
  }

  applyEntranceAnimation(node, settings, false);

  // Special full-bleed photo tile support for Gilan Guide cards (.g-tile)
  const linkedCard = isLinkedImageCard(node);
  if (linkedCard) {
    settings.background_background = 'classic';
    settings.background_color = '#06271F';
    settings.background_image = {
      url: linkedCard.imageUrl,
      id: '',
    };
    settings.background_position = 'center center';
    settings.background_size = 'cover';
    settings.background_overlay_background = 'gradient';
    settings.background_overlay_color = 'rgba(4, 28, 22, 0.2)';
    settings.background_overlay_color_b = 'rgba(4, 28, 22, 0.92)';
    settings.background_overlay_opacity = { unit: 'px', size: 0.85 };
    settings.padding = buildElementorDimension(
      { top: 150, right: 24, bottom: 24, left: 24 },
      'px'
    );
    settings.border_radius = buildElementorDimension(
      { top: 14, right: 14, bottom: 14, left: 14 },
      'px'
    );
    return settings;
  }

  // Background
  const grad = parseLinearGradient(styles.backgroundImage);
  const bgUrl = extractCssUrl(styles.backgroundImage);

  if (grad) {
    settings.background_background = 'gradient';
    settings.background_color = grad.colorA;
    settings.background_color_b = grad.colorB;
    settings.background_gradient_angle = {
      unit: 'deg',
      size: grad.angle,
    };
  } else if (
    bgUrl &&
    (bgUrl.startsWith('http://') || bgUrl.startsWith('https://'))
  ) {
    settings.background_background = 'classic';
    settings.background_image = {
      url: bgUrl,
      id: '',
    };
    settings.background_position = 'center center';
    settings.background_size = 'cover';
    if (styles.backgroundColor) {
      settings.background_color = styles.backgroundColor;
    }
  } else if (styles.backgroundColor) {
    settings.background_background = 'classic';
    settings.background_color = styles.backgroundColor;
  }

  // Padding & Responsive Padding
  if (hasNonZeroEdges(styles.padding)) {
    settings.padding = buildElementorDimension(styles.padding, 'px');
  }
  if (tabletOverrides.padding && hasNonZeroEdges(tabletOverrides.padding)) {
    settings.padding_tablet = buildElementorDimension(
      tabletOverrides.padding,
      'px'
    );
  }
  if (mobileOverrides.padding && hasNonZeroEdges(mobileOverrides.padding)) {
    settings.padding_mobile = buildElementorDimension(
      mobileOverrides.padding,
      'px'
    );
  }

  // Margin: strip horizontal auto-centering margins from .container
  const isCenteredMargin =
    stripAutoCenterMargin &&
    (node.classList.includes('container') ||
      (styles.margin.left >= 24 &&
        Math.abs(styles.margin.left - styles.margin.right) <= 4));

  const cleanDesktopMargin = isCenteredMargin
    ? { ...styles.margin, left: 0, right: 0 }
    : styles.margin;

  if (
    hasNonZeroEdges(cleanDesktopMargin) &&
    cleanDesktopMargin.top > -120 &&
    cleanDesktopMargin.left > -120
  ) {
    settings.margin = buildElementorDimension(cleanDesktopMargin, 'px');
  }

  if (tabletOverrides.margin && !isCenteredMargin) {
    if (hasNonZeroEdges(tabletOverrides.margin)) {
      settings.margin_tablet = buildElementorDimension(
        tabletOverrides.margin,
        'px'
      );
    }
  }

  if (mobileOverrides.margin && !isCenteredMargin) {
    if (hasNonZeroEdges(mobileOverrides.margin)) {
      settings.margin_mobile = buildElementorDimension(
        mobileOverrides.margin,
        'px'
      );
    }
  }

  // Border & Radius
  if (styles.borderStyle !== 'none' && hasNonZeroEdges(styles.borderWidth)) {
    settings.border_border = styles.borderStyle;
    settings.border_width = buildElementorDimension(styles.borderWidth, 'px');
    if (styles.borderColor) {
      settings.border_color = styles.borderColor;
    }
  }
  if (hasNonZeroEdges(styles.borderRadius)) {
    settings.border_radius = buildElementorDimension(styles.borderRadius, 'px');
  }

  // Box Shadow
  if (styles.boxShadow) {
    settings.box_shadow_box_shadow_type = 'yes';
    settings.box_shadow_box_shadow = styles.boxShadow;
  }

  return settings;
}

function expandNestedHorizontalRowNodes(
  rowNodes: ParsedDOMNode[]
): ParsedDOMNode[] {
  const expanded: ParsedDOMNode[] = [];
  for (const item of rowNodes) {
    const subRows = extractVisualColumnRows(item);
    const hasOwnCardBox = hasCardVisualBox(item);

    if (
      !hasOwnCardBox &&
      subRows &&
      subRows.length === 1 &&
      subRows[0].length >= 2 &&
      expanded.length + subRows[0].length <= 6
    ) {
      expanded.push(...subRows[0]);
    } else {
      expanded.push(item);
    }
  }
  return expanded;
}

function extractTopLevelSectionCandidates(
  roots: ParsedDOMNode[]
): { candidates: ParsedDOMNode[]; wrapperClasses: string[] } {
  const candidates: ParsedDOMNode[] = [];
  const wrapperClassSet = new Set<string>();

  const visit = (node: ParsedDOMNode) => {
    if (node.isDecorative) return;
    const isWrapperTag =
      node.tag === 'main' ||
      (node.tag === 'div' &&
        node.children.length >= 2 &&
        node.children.some((c) =>
          ['header', 'section', 'article', 'footer', 'nav'].includes(c.tag)
        ));

    if (isWrapperTag) {
      node.classList.forEach((cls) => wrapperClassSet.add(cls));
      node.children.forEach(visit);
    } else {
      candidates.push(node);
    }
  };

  roots.forEach(visit);
  return {
    candidates,
    wrapperClasses: Array.from(wrapperClassSet),
  };
}

/**
 * Determines the real container width inside a section (Requirement 1 & 2).
 */
function resolveSectionContainerWidth(
  sectionDom: ParsedDOMNode,
  layoutTarget: ParsedDOMNode
): { layoutMode: 'boxed' | 'full_width'; contentWidthPx: number } {
  const containerCandidate = isContainerWrapper(layoutTarget)
    ? layoutTarget
    : sectionDom.children.find((c) => isContainerWrapper(c));

  if (containerCandidate) {
    const measuredWidth =
      containerCandidate.styles.maxWidthPx > 320 &&
      containerCandidate.styles.maxWidthPx <= 1920
        ? containerCandidate.styles.maxWidthPx
        : containerCandidate.rect.width > 320 &&
          containerCandidate.rect.width < 1400
        ? containerCandidate.rect.width
        : 1280;
    return {
      layoutMode: 'boxed',
      contentWidthPx: Math.round(measuredWidth),
    };
  }

  if (sectionDom.rect.width >= 1400 && sectionDom.classList.includes('ticker')) {
    return {
      layoutMode: 'full_width',
      contentWidthPx: 1440,
    };
  }

  return {
    layoutMode: 'boxed',
    contentWidthPx: 1280,
  };
}

// ===== CORE BUSINESS LOGIC =====

export function buildElementorJsonFromDom(
  rootNodes: ParsedDOMNode[],
  bodyBackgroundColor: string,
  settings: ConverterSettings,
  initialPlaceholders: PlaceholderEntry[] = []
): BuildPipelineOutput {
  const idRegistry = new ElementorIdRegistry();
  const ctx: MappingContext = {
    settings,
    idRegistry,
    replacedWidgets: [],
    placeholders: [...initialPlaceholders],
    manualAdjustments: new Set<string>(),
    widgetBreakdown: {},
    decorativeWidgetsCount: 0,
    reconstructedWrappers: [],
    nodeEffectiveIds: new Map<string, string[]>(),
  };

  const safeSlug =
    (settings.scopePrefix || settings.templateTitle || 'page')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'page';

  const baseScopeClass = safeSlug.startsWith('elementor-')
    ? safeSlug
    : `elementor-${safeSlug}`;

  const { candidates: topBlocks, wrapperClasses } =
    extractTopLevelSectionCandidates(rootNodes);

  const pageScopeClasses = [baseScopeClass, ...wrapperClasses]
    .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
    .join(' ');

  // Only pass baseScopeClass to individual <section> elements so .gf-page stays strictly on the outer page root
  const scopeClass = baseScopeClass;

  const useContainers =
    settings.elementorVersion === '3.24+' && settings.enableFlexboxContainer;

  const counts = {
    sections: 0,
    innerSections: 0,
    columns: 0,
    containers: 0,
    widgets: 0,
    decorativeWidgets: 0,
  };

  // Build an Inner Section from a horizontal row of ParsedDOMNodes
  const buildInnerSectionFromRow = (
    rawRowNodes: ParsedDOMNode[],
    rowSeed: string,
    parentGapPx = 20,
    parentNode?: ParsedDOMNode
  ): ElementorNode => {
    counts.innerSections++;
    const rowNodes = expandNestedHorizontalRowNodes(rawRowNodes);
    const colPercentages = computeColumnPercentages(rowNodes);
    const columns: ElementorNode[] = rowNodes.map((rawColNode, idx) => {
      const colTarget = unwrapSingleCardTarget(rawColNode);
      return buildColumn(colTarget, colPercentages[idx], false, true);
    });

    const contentWidthPx =
      parentNode &&
      parentNode.styles.maxWidthPx > 320 &&
      parentNode.styles.maxWidthPx <= 1920
        ? Math.round(parentNode.styles.maxWidthPx)
        : 1240;

    const innerSettings: Record<string, unknown> = {
      layout: 'boxed',
      content_width: { unit: 'px', size: contentWidthPx },
      gap: parentGapPx >= 24 ? 'extended' : 'default',
    };

    if (parentNode) {
      if (hasNonZeroEdges(parentNode.styles.padding)) {
        innerSettings.padding = buildElementorDimension(
          parentNode.styles.padding,
          'px'
        );
      }
      if (parentNode.styles.minHeightPx >= 120) {
        innerSettings.height = 'min-height';
        innerSettings.custom_height = {
          unit: 'px',
          size: parentNode.styles.minHeightPx,
        };
        innerSettings.min_height = {
          unit: 'px',
          size: parentNode.styles.minHeightPx,
        };
      }
      if (parentNode.styles.alignItems === 'center') {
        innerSettings.content_position = 'middle';
      }
    }

    return {
      id: idRegistry.generateId(`insec_${rowSeed}`),
      elType: 'section',
      settings: innerSettings,
      elements: columns,
      isInner: true,
    };
  };

  // Populate a column's elements, decomposing nested grids into Inner Sections when allowed
  const populateColumnElements = (
    node: ParsedDOMNode,
    allowInnerSection: boolean,
    targetElements: ElementorNode[],
    isColumnRoot = false
  ): void => {
    const visualRows = extractVisualColumnRows(node);

    if (allowInnerSection && visualRows) {
      // First preserve any decorative children of `node` as spacer/divider widgets
      for (const decChild of node.children.filter((c) => c.isDecorative)) {
        const mappedDecor = mapNodeToElementorWidgets(decChild, ctx, false, false);
        counts.widgets += mappedDecor.length;
        targetElements.push(...mappedDecor);
      }

      visualRows.forEach((row, rIdx) => {
        if (row.length >= 2) {
          targetElements.push(
            buildInnerSectionFromRow(
              row,
              `${node.uid}_r${rIdx}`,
              node.styles.gapPx || 20,
              node
            )
          );
        } else if (row.length === 1) {
          populateColumnElements(row[0], allowInnerSection, targetElements, false);
        }
      });
      return;
    }

    const hasNestedGridDescendant =
      allowInnerSection &&
      node.children.length > 0 &&
      !isSimpleTextList(node) &&
      !isVerticalContentStack(node) &&
      node.children.some(
        (ch) =>
          !ch.isDecorative &&
          (extractVisualColumnRows(ch) !== null ||
            (ch.children.length > 0 &&
              !isVerticalContentStack(ch) &&
              ch.children.some((sub) => extractVisualColumnRows(sub) !== null)))
      );

    if (hasNestedGridDescendant) {
      if (node.tag === 'form' && !ctx.settings.hasElementorPro) {
        ctx.replacedWidgets.push({
          originalElement: `<form${node.idAttr ? ` id="${node.idAttr}"` : ''}>`,
          mappedTo: 'Inner Section + icon-box + button (تفکیک بومی مراحل فرم)',
          reason:
            'Elementor Pro غیرفعال است؛ فیلدها و شبکه‌های چندستونه فرم به سکشن داخلی و ویجت‌های بومی تبدیل شدند.',
        });
        ctx.placeholders.push({
          type: 'pro-fallback',
          element: 'form',
          placeholderValue: '[جایگاه فرم تعاملی - بازسازی‌شده با ویجت‌های بومی]',
          description:
            'مراحل و گزینه‌های فرم به ویجت‌های بومی تبدیل شدند تا ظاهر صفحه کاملاً حفظ شود.',
        });
        ctx.manualAdjustments.add(
          'جایگزینی بلوک فرم با شورت‌کد Contact Form 7 / WPForms یا فعال‌سازی Elementor Pro'
        );
      }
      for (const child of node.children) {
        populateColumnElements(child, allowInnerSection, targetElements, false);
      }
      return;
    }

    const mapped = mapNodeToElementorWidgets(node, ctx, false, isColumnRoot);
    counts.widgets += mapped.length;
    targetElements.push(...mapped);
  };

  // Build Column Node (Classic Mode)
  const buildColumn = (
    colNode: ParsedDOMNode,
    columnSizePercent: number,
    allowInnerSection: boolean,
    applyNodeBoxStyles = true,
    skipTargetClassesAndId = false
  ): ElementorNode => {
    counts.columns++;
    const targetNode = unwrapSingleCardTarget(colNode);
    const isLeafWidgetNode =
      targetNode.attributes['data-el-html-widget'] === 'true' ||
      targetNode.attributes['data-el-text-editor-widget'] === 'true';

    const colSettings: Record<string, unknown> =
      applyNodeBoxStyles && !isLeafWidgetNode
        ? extractSectionOrContainerSettings(targetNode, true)
        : {};

    // Filter out CSS Grid layout wrapper classes (e.g. *-layout, *-wrap, *-shell, container) from Elementor Column
    // so CSS Grid rules on layout wrappers never trap .elementor-widget-wrap in a single narrow grid track!
    const safeColClasses = skipTargetClassesAndId
      ? []
      : targetNode.classList.filter(
          (c) =>
            !c.endsWith('-layout') &&
            !c.endsWith('-wrap') &&
            !c.endsWith('-shell') &&
            c !== 'container' &&
            c !== 'mx-auto'
        );

    if (!isLeafWidgetNode && !skipTargetClassesAndId) {
      if (safeColClasses.length > 0) {
        colSettings.css_classes = safeColClasses.join(' ');
      } else {
        delete colSettings.css_classes;
      }
      if (targetNode.idAttr && !colSettings.css_id) {
        colSettings.css_id = targetNode.idAttr;
      }
    } else {
      delete colSettings.css_classes;
      delete colSettings.css_id;
    }

    colSettings._column_size = columnSizePercent;
    colSettings._inline_size = null;

    if (!isLeafWidgetNode && targetNode.styles.gapPx > 0) {
      colSettings.space_between_widgets = targetNode.styles.gapPx;
    }

    const colElements: ElementorNode[] = [];
    populateColumnElements(targetNode, allowInnerSection, colElements, true);

    return {
      id: idRegistry.generateId(`col_${targetNode.uid}`),
      elType: 'column',
      settings: colSettings,
      elements: colElements,
      isInner: !allowInnerSection,
    };
  };

  // Build Section Node (Classic Mode: Section -> Column -> Widget)
  const buildClassicSection = (
    sectionDom: ParsedDOMNode,
    isInner: boolean
  ): ElementorNode => {
    if (isInner) {
      counts.innerSections++;
    } else {
      counts.sections++;
    }

    const sectionSettings = extractSectionOrContainerSettings(
      sectionDom,
      true,
      !isInner ? scopeClass : ''
    );

    // Separate direct decorative children (like .hero__bg, .hero__particles, .capabilities__aurora, .benefits__beam)
    // from structural content children (like .container) so decorative layers don't block .container unwrapping!
    const directDecorChildren = sectionDom.children.filter((c) => c.isDecorative);
    const nonDecorChildren = sectionDom.children.filter((c) => !c.isDecorative);

    let layoutTarget = sectionDom;
    if (
      !isInner &&
      nonDecorChildren.length === 1 &&
      nonDecorChildren[0].tag === 'div' &&
      !sectionDom.directText
    ) {
      layoutTarget = nonDecorChildren[0];
    }

    const { layoutMode, contentWidthPx } = resolveSectionContainerWidth(
      sectionDom,
      layoutTarget
    );
    sectionSettings.layout = layoutMode;
    sectionSettings.content_width = { unit: 'px', size: contentWidthPx };

    // Collect decorative children from the container wrapper before potentially unwrapping deeper
    const containerDecorChildren: ParsedDOMNode[] =
      layoutTarget !== sectionDom
        ? [...layoutTarget.children.filter((c) => c.isDecorative)]
        : [];

    // If layoutTarget (.container / .*-wrap) has a single child that is either a styled panel (.cta-panel, .*-final-box)
    // OR a multi-column layout grid (.*-layout, .*-grid), unwrap to that child so the Section directly hosts its columns/styles!
    const layoutNonDecor = layoutTarget.children.filter((c) => !c.isDecorative);
    if (
      isContainerWrapper(layoutTarget) &&
      layoutNonDecor.length === 1 &&
      !layoutTarget.directText &&
      ['div', 'article'].includes(layoutNonDecor[0].tag) &&
      (hasCardVisualBox(layoutNonDecor[0]) ||
        extractVisualColumnRows(layoutNonDecor[0]) !== null ||
        layoutNonDecor[0].classList.some(
          (c) => c.endsWith('-layout') || c.endsWith('-grid')
        ))
    ) {
      layoutTarget = layoutNonDecor[0];
      containerDecorChildren.push(
        ...layoutTarget.children.filter((c) => c.isDecorative)
      );
    }

    // Inherit vertical padding, min-height, and vertical alignment from layoutTarget (e.g. .gf-hero-layout / .ga-hero-layout)
    if (layoutTarget !== sectionDom) {
      if (
        !hasNonZeroEdges(sectionDom.styles.padding) &&
        hasNonZeroEdges(layoutTarget.styles.padding)
      ) {
        sectionSettings.padding = buildElementorDimension(
          layoutTarget.styles.padding,
          'px'
        );
        if (
          layoutTarget.tabletOverrides.padding &&
          hasNonZeroEdges(layoutTarget.tabletOverrides.padding)
        ) {
          sectionSettings.padding_tablet = buildElementorDimension(
            layoutTarget.tabletOverrides.padding,
            'px'
          );
        }
        if (
          layoutTarget.mobileOverrides.padding &&
          hasNonZeroEdges(layoutTarget.mobileOverrides.padding)
        ) {
          sectionSettings.padding_mobile = buildElementorDimension(
            layoutTarget.mobileOverrides.padding,
            'px'
          );
        }
      }
      if (
        !sectionSettings.min_height &&
        layoutTarget.styles.minHeightPx >= 120
      ) {
        sectionSettings.height = 'min-height';
        sectionSettings.custom_height = {
          unit: 'px',
          size: layoutTarget.styles.minHeightPx,
        };
        sectionSettings.min_height = {
          unit: 'px',
          size: layoutTarget.styles.minHeightPx,
        };
      }
      if (layoutTarget.styles.alignItems === 'center') {
        sectionSettings.content_position = 'middle';
      } else if (
        layoutTarget.styles.alignItems === 'end' ||
        layoutTarget.styles.alignItems === 'flex-end'
      ) {
        sectionSettings.content_position = 'bottom';
      }
    }

    if (sectionDom.styles.gapPx > 0 || layoutTarget.styles.gapPx > 0) {
      sectionSettings.gap = 'extended';
    }

    const columns: ElementorNode[] = [];
    const visualRows = extractVisualColumnRows(layoutTarget);

    if (visualRows && visualRows.length === 1 && visualRows[0].length >= 2) {
      const row = expandNestedHorizontalRowNodes(visualRows[0]);
      const colPercentages = computeColumnPercentages(row);
      row.forEach((child, idx) => {
        columns.push(buildColumn(child, colPercentages[idx], !isInner, true, false));
      });
    } else {
      const isSameAsSection = layoutTarget === sectionDom;
      const isDistinctStyledPanel =
        !isSameAsSection && hasCardVisualBox(layoutTarget);
      columns.push(
        buildColumn(
          layoutTarget,
          100,
          !isInner,
          isDistinctStyledPanel,
          isSameAsSection
        )
      );
    }

    // Requirement 5: Reconstruct section-level decorative layers (aurora, particles, beam, blueprint, circuit)
    // as native spacer/divider widgets with _css_classes inside the first column so extra.css applies to them!
    const allSectionDecorNodes = [
      ...directDecorChildren,
      ...containerDecorChildren,
    ];
    if (allSectionDecorNodes.length > 0 && columns.length > 0) {
      for (const decorNode of allSectionDecorNodes) {
        const decorWidgets = mapNodeToElementorWidgets(decorNode, ctx);
        counts.widgets += decorWidgets.length;
        columns[0].elements.push(...decorWidgets);
      }
    }

    return {
      id: idRegistry.generateId(`sec_${sectionDom.uid}`),
      elType: 'section',
      settings: sectionSettings,
      elements: columns,
      isInner,
    };
  };

  // Build Flexbox Container Node (When version === '3.24+' and enableFlexboxContainer === true)
  const buildContainerNode = (
    domNode: ParsedDOMNode,
    isInner: boolean
  ): ElementorNode => {
    counts.containers++;
    const targetNode = isInner ? unwrapSingleCardTarget(domNode) : domNode;
    const containerSettings = extractSectionOrContainerSettings(
      targetNode,
      true,
      !isInner ? scopeClass : ''
    );

    const directDecorChildren = targetNode.children.filter((c) => c.isDecorative);
    const nonDecorChildren = targetNode.children.filter((c) => !c.isDecorative);

    let layoutTarget = targetNode;
    if (
      !isInner &&
      nonDecorChildren.length === 1 &&
      nonDecorChildren[0].tag === 'div' &&
      !targetNode.directText
    ) {
      const inner = nonDecorChildren[0];
      if (!inner.classList.includes('container')) {
        const innerSettings = extractSectionOrContainerSettings(inner, true);
        Object.entries(innerSettings).forEach(([k, v]) => {
          if (containerSettings[k] === undefined) {
            containerSettings[k] = v;
          }
        });
      }
      layoutTarget = inner;
    }

    const layoutNonDecor = layoutTarget.children.filter((c) => !c.isDecorative);
    if (
      isContainerWrapper(layoutTarget) &&
      layoutNonDecor.length === 1 &&
      hasCardVisualBox(layoutNonDecor[0])
    ) {
      layoutTarget = layoutNonDecor[0];
      const panelSettings = extractSectionOrContainerSettings(layoutTarget, true);
      Object.entries(panelSettings).forEach(([k, v]) => {
        containerSettings[k] = v;
      });
    }

    const { contentWidthPx } = resolveSectionContainerWidth(
      targetNode,
      layoutTarget
    );
    const visualRows = extractVisualColumnRows(layoutTarget);
    const isSingleRowMultiCol =
      visualRows !== null && visualRows.length === 1 && visualRows[0].length >= 2;

    containerSettings.content_width = isInner ? 'full' : 'boxed';
    containerSettings.boxed_width = { unit: 'px', size: contentWidthPx };
    containerSettings.flex_direction = isSingleRowMultiCol ? 'row' : 'column';

    const gapVal = layoutTarget.styles.gapPx || 20;
    containerSettings.flex_gap = {
      unit: 'px',
      size: gapVal,
      column: String(gapVal),
      row: String(gapVal),
      isLinked: true,
    };

    const childrenElements: ElementorNode[] = [];

    if (visualRows) {
      if (isSingleRowMultiCol) {
        const row = expandNestedHorizontalRowNodes(visualRows[0]);
        const percentages = computeColumnPercentages(row);
        row.forEach((child, idx) => {
          const childCon = buildContainerNode(child, true);
          childCon.settings.width = { unit: '%', size: percentages[idx] };
          childrenElements.push(childCon);
        });
      } else {
        visualRows.forEach((rawRow, rIdx) => {
          if (rawRow.length >= 2) {
            const row = expandNestedHorizontalRowNodes(rawRow);
            counts.containers++;
            const percentages = computeColumnPercentages(row);
            const rowChildren = row.map((child, cIdx) => {
              const childCon = buildContainerNode(child, true);
              childCon.settings.width = { unit: '%', size: percentages[cIdx] };
              return childCon;
            });
            childrenElements.push({
              id: idRegistry.generateId(`rowcon_${layoutTarget.uid}_${rIdx}`),
              elType: 'container',
              settings: {
                content_width: 'full',
                flex_direction: 'row',
                flex_gap: {
                  unit: 'px',
                  size: gapVal,
                  column: String(gapVal),
                  row: String(gapVal),
                  isLinked: true,
                },
              },
              elements: rowChildren,
              isInner: true,
            });
          } else if (rawRow.length === 1) {
            childrenElements.push(buildContainerNode(rawRow[0], true));
          }
        });
      }
    } else {
      const hasNestedGridDescendant =
        layoutTarget.children.length > 0 &&
        !isSimpleTextList(layoutTarget) &&
        !isVerticalContentStack(layoutTarget) &&
        layoutTarget.children.some(
          (ch) =>
            !ch.isDecorative &&
            (extractVisualColumnRows(ch) !== null ||
              (ch.children.length > 0 &&
                !isVerticalContentStack(ch) &&
                ch.children.some((sub) => extractVisualColumnRows(sub) !== null)))
        );

      if (hasNestedGridDescendant) {
        for (const child of layoutTarget.children) {
          if (
            !child.isDecorative &&
            (extractVisualColumnRows(child) !== null ||
              (!isVerticalContentStack(child) &&
                child.children.some(
                  (sub) => extractVisualColumnRows(sub) !== null
                )))
          ) {
            childrenElements.push(buildContainerNode(child, true));
          } else {
            const mapped = mapNodeToElementorWidgets(child, ctx);
            counts.widgets += mapped.length;
            childrenElements.push(...mapped);
          }
        }
      } else {
        const mapped = mapNodeToElementorWidgets(layoutTarget, ctx);
        counts.widgets += mapped.length;
        childrenElements.push(...mapped);
      }
    }

    for (const decorNode of directDecorChildren) {
      const decorWidgets = mapNodeToElementorWidgets(decorNode, ctx);
      counts.widgets += decorWidgets.length;
      childrenElements.push(...decorWidgets);
    }

    return {
      id: idRegistry.generateId(`con_${targetNode.uid}`),
      elType: 'container',
      settings: containerSettings,
      elements: childrenElements,
      isInner,
    };
  };

  const contentElements: ElementorNode[] = [];

  for (const block of topBlocks) {
    if (useContainers) {
      const builtCon = buildContainerNode(block, false);
      if (builtCon.elements.length > 0) {
        contentElements.push(builtCon);
      }
    } else {
      const builtSec = buildClassicSection(block, false);
      const hasAnyWidget = (n: ElementorNode): boolean =>
        n.elType === 'widget' || (n.elements || []).some(hasAnyWidget);
      if (hasAnyWidget(builtSec)) {
        contentElements.push(builtSec);
      }
    }
  }

  if (contentElements.length === 0) {
    if (useContainers) {
      counts.containers++;
      counts.widgets++;
      contentElements.push({
        id: idRegistry.generateId('fallback_con'),
        elType: 'container',
        settings: { content_width: 'boxed', flex_direction: 'column' },
        elements: [
          {
            id: idRegistry.generateId('fallback_widget'),
            elType: 'widget',
            widgetType: 'heading',
            settings: {
              title: '[محتوای قالب را ویرایش کنید]',
              header_size: 'h2',
            },
            elements: [],
          },
        ],
        isInner: false,
      });
    } else {
      counts.sections++;
      counts.columns++;
      counts.widgets++;
      contentElements.push({
        id: idRegistry.generateId('fallback_sec'),
        elType: 'section',
        settings: { layout: 'boxed' },
        elements: [
          {
            id: idRegistry.generateId('fallback_col'),
            elType: 'column',
            settings: { _column_size: 100, _inline_size: null },
            elements: [
              {
                id: idRegistry.generateId('fallback_widget'),
                elType: 'widget',
                widgetType: 'heading',
                settings: {
                  title: '[محتوای قالب را ویرایش کنید]',
                  header_size: 'h2',
                },
                elements: [],
              },
            ],
            isInner: false,
          },
        ],
        isInner: false,
      });
    }
  }

  counts.decorativeWidgets = ctx.decorativeWidgetsCount;

  const templateJson: ElementorTemplateJSON = {
    title: settings.templateTitle.trim() || 'قالب تبدیل‌شده به Elementor',
    type: settings.templateType,
    version: '0.4',
    page_settings: {
      hide_title: 'yes',
      template: 'elementor_canvas',
      background_background: 'classic',
      background_color: bodyBackgroundColor || '#FFFFFF',
      css_classes: pageScopeClasses,
    },
    content: contentElements,
  };

  return {
    templateJson,
    counts,
    widgetBreakdown: ctx.widgetBreakdown,
    replacedWidgets: ctx.replacedWidgets,
    placeholders: ctx.placeholders,
    manualAdjustments: Array.from(ctx.manualAdjustments),
    reconstructedWrappers: ctx.reconstructedWrappers,
    extractedSvgs: [],
  };
}

/**
 * 1:1 Exact HTML Match Builder (`exactHtmlMatch: true`):
 * Converts every top-level section of the input HTML into an Elementor Section (`layout: "full_width"`, `gap: "no"`)
 * with a zero-interference `.el-exact-section` wrapper containing the 100% unmodified HTML DOM (`outerHTML`),
 * preserving every tag, attribute, inline SVG, CSS Grid/Flexbox, padding, animation, and JS selector verbatim.
 */
export function buildExactMatchElementorJson(
  rawHtml: string,
  bodyBackgroundColor: string,
  settings: ConverterSettings,
  initialPlaceholders: PlaceholderEntry[] = [],
  assetMap: Map<string, string> = new Map(),
  computedDimensionsMap?: Map<string, ComputedElementDimensionsSnapshot>
): BuildPipelineOutput {
  const idRegistry = new ElementorIdRegistry();
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const safeSlug =
    (settings.scopePrefix || settings.templateTitle || 'page')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'page';
  const baseScopeClass = safeSlug.startsWith('elementor-')
    ? safeSlug
    : `elementor-${safeSlug}`;

  const zeroDim = {
    unit: 'px' as const,
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    isLinked: true,
  };

  // Resolve any local ZIP assets or data-src / data-fallback attributes on <img> elements
  doc.querySelectorAll('img').forEach((imgEl) => {
    const rawSrc = (imgEl.getAttribute('src') || '').trim();
    const dataSrc = (
      imgEl.getAttribute('data-src') ||
      imgEl.getAttribute('data-lazy-src') ||
      imgEl.getAttribute('data-fallback') ||
      ''
    ).trim();

    const is1x1Gif =
      rawSrc.startsWith('data:image/gif;base64,R0lGOD') ||
      rawSrc.startsWith('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1"');

    let effectiveSrc = (!rawSrc || is1x1Gif) && dataSrc ? dataSrc : rawSrc;

    if (effectiveSrc && assetMap.size > 0) {
      const normalizedKey = effectiveSrc.replace(/^\.?\//, '');
      const fileNameOnly = normalizedKey.split('/').pop() || '';
      const mapped =
        assetMap.get(effectiveSrc) ||
        assetMap.get(normalizedKey) ||
        assetMap.get(fileNameOnly);
      if (mapped) {
        effectiveSrc = mapped;
      }
    }

    if (effectiveSrc && effectiveSrc !== rawSrc) {
      imgEl.setAttribute('src', effectiveSrc);
    }
  });

  // Collect external <link rel="stylesheet"> from <head> (e.g. Google Fonts, FontAwesome, Material Icons)
  const externalFontLinks: string[] = [];
  doc.querySelectorAll('head link[rel="stylesheet"]').forEach((linkEl) => {
    const href = (linkEl.getAttribute('href') || '').trim();
    if (
      href &&
      (href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//'))
    ) {
      externalFontLinks.push(linkEl.outerHTML);
    }
  });

  // Remove <style> tags and executable <script> tags from body (they are extracted into extra.css and extra.js),
  // while keeping <script type="application/ld+json"> for SEO schema (e.g. [data-gf-schema]).
  doc.body.querySelectorAll('style').forEach((s) => s.remove());
  doc.body.querySelectorAll('script').forEach((s) => {
    const t = (s.getAttribute('type') || '').toLowerCase();
    if (t !== 'application/ld+json' && t !== 'application/json') {
      s.remove();
    }
  });

  // Remove editor-only *-system containers that only held <style>/<script>, and floating .rail
  doc.body
    .querySelectorAll('[class*="-system"], .rail, .cursor-aura, .scroll-progress')
    .forEach((el) => el.remove());

  if (!settings.includeHeaderFooter) {
    doc.body
      .querySelectorAll(
        'body > header, main > header, [class*="-page"] > header, body > div > header, .site-header, .ga-header, .gf-header, .gc-header, body > nav, .skip-link, [class*="-skip"]'
      )
      .forEach((el) => el.remove());

    doc.body
      .querySelectorAll(
        'body > footer, main > footer, [class*="-page"] > footer, body > div > footer, .site-footer, .ga-footer, .gf-footer, .gc-footer'
      )
      .forEach((el) => el.remove());
  }

  // Extract inline <svg> elements into standalone local .svg files (assets/svg/*.svg)
  const extractedSvgs = extractAndReplaceSvgsAsLocalFiles(
    doc,
    computedDimensionsMap
  );

  // Collect root wrapper classes (e.g. gf-page, ga-page, gc-page, gs-page, e-con, e-con-full)
  const rootScopeSet = new Set<string>([baseScopeClass, 'e-con', 'e-con-full']);
  Array.from(doc.body.classList).forEach((c) => {
    if (c && c !== 'elementor-page') rootScopeSet.add(c);
  });

  // Unwrap outer page wrappers (<div class="gf-page">, <main class="ga-main">, etc.) to extract top-level sections
  const unwrapCandidates = (elements: Element[]): Element[] => {
    const result: Element[] = [];
    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const clsList = Array.from(el.classList);

      // Record any *-page or wrapper classes on the root scope
      clsList.forEach((c) => {
        if (c.endsWith('-page') || c === 'e-con' || c === 'e-con-full') {
          rootScopeSet.add(c);
        }
      });

      const isPageRootWrapper =
        clsList.some((c) => c.endsWith('-page')) ||
        tag === 'main' ||
        (tag === 'div' &&
          elements.length === 1 &&
          el.children.length > 1 &&
          Array.from(el.children).some((ch) =>
            ['HEADER', 'MAIN', 'SECTION', 'FOOTER', 'ARTICLE'].includes(
              ch.tagName.toUpperCase()
            )
          ));

      if (isPageRootWrapper && el.children.length > 0) {
        const wrapperId = el.getAttribute('id') || '';
        const innerChildren = unwrapCandidates(Array.from(el.children));
        if (wrapperId && innerChildren.length > 0 && !innerChildren[0].id) {
          innerChildren[0].setAttribute('id', wrapperId);
        }
        result.push(...innerChildren);
      } else {
        result.push(el);
      }
    }
    return result;
  };

  let topLevelElements = unwrapCandidates(Array.from(doc.body.children));

  // Merge standalone skip-link (e.g. .ga-skip) into the first section so it doesn't create an empty visual row
  if (
    topLevelElements.length > 1 &&
    (topLevelElements[0].classList.contains('ga-skip') ||
      topLevelElements[0].classList.contains('skip-link') ||
      Array.from(topLevelElements[0].classList).some((c) => c.endsWith('-skip')))
  ) {
    const skipEl = topLevelElements.shift()!;
    topLevelElements[0].insertBefore(skipEl, topLevelElements[0].firstChild);
  }

  if (topLevelElements.length === 0 && doc.body.innerHTML.trim()) {
    const wrapperDiv = doc.createElement('div');
    wrapperDiv.innerHTML = doc.body.innerHTML;
    topLevelElements = [wrapperDiv];
  }

  const contentElements: ElementorNode[] = [];
  const widgetBreakdown: Record<string, number> = {
    html: 0,
    heading: 0,
    button: 0,
    'text-editor': 0,
    image: 0,
  };
  let totalWidgetsCount = 0;
  let decorativeWidgetsCount = 0;

  topLevelElements.forEach((blockEl, index) => {
    const tag = blockEl.tagName.toLowerCase();
    const clsList = Array.from(blockEl.classList);

    // Count inner semantic widgets for accurate reporting
    const headingsCount = blockEl.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, .elementor-widget-heading'
    ).length;
    const buttonsCount = blockEl.querySelectorAll(
      'a.elementor-button, button, .elementor-widget-button'
    ).length;
    const paragraphsCount = blockEl.querySelectorAll(
      '.elementor-widget-text-editor, p'
    ).length;
    const mediaCount = blockEl.querySelectorAll('img, svg').length;

    widgetBreakdown.html = (widgetBreakdown.html || 0) + 1;
    if (headingsCount > 0) {
      widgetBreakdown.heading = (widgetBreakdown.heading || 0) + headingsCount;
    }
    if (buttonsCount > 0) {
      widgetBreakdown.button = (widgetBreakdown.button || 0) + buttonsCount;
    }
    if (paragraphsCount > 0) {
      widgetBreakdown['text-editor'] =
        (widgetBreakdown['text-editor'] || 0) + paragraphsCount;
    }
    if (mediaCount > 0) {
      widgetBreakdown.image = (widgetBreakdown.image || 0) + mediaCount;
      decorativeWidgetsCount += blockEl.querySelectorAll('svg, img.el-svg-img').length;
    }
    totalWidgetsCount++;

    // Detect if this block is a sticky header or sticky controls bar
    const isStickyHeader =
      tag === 'header' ||
      clsList.some((c) => c === 'ga-header' || c === 'site-header' || c.endsWith('-header'));
    const isStickyControls = clsList.some(
      (c) => c === 'gf-controls' || c.endsWith('-controls') || c.endsWith('-toolbar')
    );

    const sectionClasses = [
      baseScopeClass,
      'el-exact-section',
      isStickyHeader ? 'el-exact-sticky-header' : '',
      isStickyControls ? 'el-exact-sticky-controls' : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Build readable section title for Elementor Navigator
    const firstHeading = blockEl
      .querySelector('h1, h2, h3, .elementor-heading-title')
      ?.textContent?.trim()
      ?.slice(0, 36);
    const primaryClass =
      clsList.find(
        (c) =>
          !['e-con', 'e-con-full', 'e-con-boxed', 'gf-zone', 'gf-dark', 'ga-dark'].includes(c)
      ) || tag;
    const sectionTitle = firstHeading
      ? `${primaryClass} — ${firstHeading}`
      : `بخش ${index + 1} (${primaryClass})`;

    const cleanedBlockOuterHtml = stripInternalMeasureAttributes(blockEl.outerHTML);
    const blockHtml =
      index === 0 && externalFontLinks.length > 0
        ? `${externalFontLinks.join('\n')}\n${cleanedBlockOuterHtml}`
        : cleanedBlockOuterHtml;

    const sectionSettings: Record<string, unknown> = {
      _title: sectionTitle,
      layout: 'full_width',
      gap: 'no',
      padding: zeroDim,
      margin: zeroDim,
      css_classes: sectionClasses,
    };

    injectComputedStylesIntoElementorController(
      blockEl,
      'container',
      sectionSettings,
      computedDimensionsMap
    );

    const sectionNode: ElementorNode = {
      id: idRegistry.generateId(`exact_sec_${index}`),
      elType: 'section',
      settings: sectionSettings,
      elements: [
        {
          id: idRegistry.generateId(`exact_col_${index}`),
          elType: 'column',
          settings: {
            _column_size: 100,
            _inline_size: null,
            padding: zeroDim,
            margin: zeroDim,
            css_classes: 'el-exact-column',
          },
          elements: [
            {
              id: idRegistry.generateId(`exact_html_${index}`),
              elType: 'widget',
              widgetType: 'html',
              settings: {
                html: blockHtml,
                _css_classes: 'el-exact-html-carrier',
              },
              elements: [],
            },
          ],
          isInner: false,
        },
      ],
      isInner: false,
    };

    contentElements.push(sectionNode);
  });

  const pageScopeClasses = Array.from(rootScopeSet).join(' ');

  const templateJson: ElementorTemplateJSON = {
    title: settings.templateTitle.trim() || 'قالب تبدیل‌شده به Elementor',
    type: settings.templateType,
    version: '0.4',
    page_settings: {
      hide_title: 'yes',
      template: 'elementor_canvas',
      background_background: 'classic',
      background_color: bodyBackgroundColor || '#FFFFFF',
      css_classes: pageScopeClasses,
    },
    content: contentElements,
  };

  return {
    templateJson,
    counts: {
      sections: contentElements.length,
      innerSections: 0,
      columns: contentElements.length,
      containers: 0,
      widgets: totalWidgetsCount,
      decorativeWidgets: decorativeWidgetsCount,
    },
    widgetBreakdown,
    replacedWidgets: [],
    placeholders: initialPlaceholders,
    manualAdjustments: [],
    reconstructedWrappers: [],
    extractedSvgs,
  };
}

/**
 * Removes internal pre-conversion measurement attributes (`data-el-measure-id`)
 * from serialized HTML strings so `page.json` remains clean while keeping local SVG fallback attributes.
 */
function stripInternalMeasureAttributes(html: string): string {
  if (!html) return html;
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\sdata-el-measure-id="[^"]*"/g, '')
    .replace(/\sdata-svg-asset-id="[^"]*"/g, '');
}

/**
 * Prepares an inline `<svg>` string so it renders the exact original icon geometry inside Elementor's
 * `.elementor-icon` / `.elementor-button-icon`, inherits `currentColor` on `:hover`, and is never filled solid
 * by Elementor's `.elementor-icon svg { fill: currentColor }` rule!
 */
function prepareInlineCurrentColorSvg(svgXml: string): string {
  let s = svgXml.replace(/<\?xml[^>]*\?>\s*/i, '').trim();
  if (!s.startsWith('<svg')) return s;

  const isMultiColor =
    /linearGradient|radialGradient|fill=["']url\(|stroke=["']url\(/i.test(s) ||
    (/\bfill=["'](?!none|currentColor)[#a-z0-9]/i.test(s) &&
      /\bstroke=["'](?!none|currentColor)[#a-z0-9]/i.test(s));

  if (isMultiColor) {
    return s.replace(
      /^<svg\b/i,
      '<svg data-el-exact-svg="1" data-el-multicolor-svg="1"'
    );
  }

  const isStrokeIcon =
    /\bfill=["']none["']/i.test(s) || /\bstroke=["'](?!none)/i.test(s);

  if (isStrokeIcon) {
    s = s
      .replace(/\bstroke=["']#[0-9a-fA-F]{3,8}["']/gi, 'stroke="currentColor"')
      .replace(
        /\bstroke=["']rgba?\([^"']+\)["']/gi,
        'stroke="currentColor"'
      );
    return s.replace(
      /^<svg\b/i,
      '<svg data-el-exact-svg="1" fill="none" stroke="currentColor" style="fill:none !important;stroke:currentColor !important;"'
    );
  }

  s = s
    .replace(/\bfill=["']#[0-9a-fA-F]{3,8}["']/gi, 'fill="currentColor"')
    .replace(/\bfill=["']rgba?\([^"']+\)["']/gi, 'fill="currentColor"');
  return s.replace(
    /^<svg\b/i,
    '<svg data-el-exact-svg="1" fill="currentColor" style="fill:currentColor !important;"'
  );
}

/**
 * Determines whether an inline `<svg>` is an animated, background, decorative, or large complex graphic
 * that must remain a live `<svg>` element in the DOM so CSS `@keyframes`, `<animate>`, gradients, filters,
 * and JS animations continue working 100% natively in WordPress Elementor.
 */
function isAnimatedOrComplexBackgroundSvg(
  svgEl: SVGElement,
  widthPx: number,
  heightPx: number,
  vbW: number,
  vbH: number,
  snap?: ComputedElementDimensionsSnapshot
): boolean {
  // 1. Explicit SVG animation, pattern, or foreignObject definitions
  if (
    svgEl.querySelector(
      'animate, animateTransform, animateMotion, set, style, pattern, foreignObject'
    ) ||
    svgEl.hasAttribute('data-circuit')
  ) {
    return true;
  }

  // 2. Large SVG illustrations, waves, hero visuals, or section backgrounds (> 64px)
  if (widthPx > 64 || heightPx > 64 || vbW > 64 || vbH > 64) {
    return true;
  }

  // 3. Absolutely or fixedly positioned background/decorative SVGs
  if (
    snap &&
    (snap.desktop.position === 'absolute' || snap.desktop.position === 'fixed')
  ) {
    return true;
  }

  // 4. Child shapes with classes, IDs, or inline styles (targeted by CSS @keyframes or JS)
  if (
    svgEl.querySelector(
      'path[class], path[id], path[style], circle[class], circle[id], circle[style], rect[class], rect[id], rect[style], g[class], g[id], g[style], line[class], polyline[class], polygon[class], ellipse[class]'
    )
  ) {
    return true;
  }

  // 5. Class or ID on the SVG or its immediate ancestors indicating a background/animated/decorative layer
  const bgOrAnimRegex =
    /(bg|background|wave|blob|mesh|grid|glow|aurora|orb|decor|canvas|particle|pattern|shape|illus|visual|scene|chart|graph|diagram|float|pulse|spin|anim)/i;
  let curr: Element | null = svgEl;
  let depth = 0;
  while (curr && depth < 3) {
    const clsAndId = `${curr.getAttribute('class') || ''} ${
      curr.getAttribute('id') || ''
    }`;
    if (bgOrAnimRegex.test(clsAndId)) {
      return true;
    }
    curr = curr.parentElement;
    depth++;
  }

  return false;
}

/**
 * Extracts every inline `<svg>` in the document into a standalone, valid `.svg` file (`assets/svg/*.svg`)
 * with baked computed stroke/fill/dimensions for local download in the ZIP package.
 * Small static icon SVGs (`<= 64x64`) are replaced in the DOM with `<img src="assets/svg/..." class="... el-svg-img" />`
 * (with an automatic inline `onerror` fallback to `data-svg-fallback`), while animated/background/large SVGs
 * remain live `<svg>` elements in the DOM so 100% of their animations, gradients, and filters run natively!
 */
function extractAndReplaceSvgsAsLocalFiles(
  doc: Document,
  computedDimensionsMap?: Map<string, ComputedElementDimensionsSnapshot>
): ExtractedSvgAsset[] {
  const extractedAssets: ExtractedSvgAsset[] = [];
  const hashToAsset = new Map<string, ExtractedSvgAsset>();

  // Expand any <svg><use href="#..."></use></svg> from <symbol> definitions in the document
  doc.querySelectorAll('svg use').forEach((useEl) => {
    const href =
      useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
    if (href.startsWith('#')) {
      const symbolId = href.slice(1);
      const symbolEl = doc.getElementById(symbolId);
      const parentSvg = useEl.closest('svg');
      if (symbolEl && parentSvg) {
        const spriteParentSvg = symbolEl.closest('svg');
        const attrsToCopy = [
          'viewBox',
          'fill',
          'stroke',
          'stroke-width',
          'stroke-linecap',
          'stroke-linejoin',
        ];
        attrsToCopy.forEach((attrName) => {
          if (!parentSvg.getAttribute(attrName)) {
            const val =
              symbolEl.getAttribute(attrName) ||
              spriteParentSvg?.getAttribute(attrName);
            if (val) {
              parentSvg.setAttribute(attrName, val);
            }
          }
        });
        parentSvg.innerHTML = symbolEl.innerHTML;
      }
    }
  });

  const allSvgs = Array.from(doc.querySelectorAll('svg:not(.sprite)'));
  allSvgs.forEach((svgEl) => {
    // Keep empty runtime canvas SVGs (e.g. [data-circuit]) if they have no child shapes at all
    if (svgEl.hasAttribute('data-circuit') && svgEl.children.length === 0) {
      return;
    }

    const measureId = svgEl.getAttribute('data-el-measure-id') || '';
    const snap = measureId ? computedDimensionsMap?.get(measureId) : undefined;

    const viewBox = svgEl.getAttribute('viewBox') || '0 0 24 24';
    const vbParts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const vbW =
      vbParts.length === 4 && !Number.isNaN(vbParts[2]) && vbParts[2] > 0
        ? vbParts[2]
        : 24;
    const vbH =
      vbParts.length === 4 && !Number.isNaN(vbParts[3]) && vbParts[3] > 0
        ? vbParts[3]
        : 24;

    const attrW = parseFloat(svgEl.getAttribute('width') || '0');
    const attrH = parseFloat(svgEl.getAttribute('height') || '0');

    const widthPx =
      snap && snap.desktop.widthPx >= 8
        ? Math.round(snap.desktop.widthPx)
        : attrW > 0
        ? Math.round(attrW)
        : Math.round(vbW);
    const heightPx =
      snap && snap.desktop.heightPx >= 8
        ? Math.round(snap.desktop.heightPx)
        : attrH > 0
        ? Math.round(attrH)
        : Math.round(vbH);

    // Build standalone SVG XML string (preferring the live computed serialization from the sandbox)
    let svgXml = snap?.resolvedSvgString || '';
    if (!svgXml) {
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.removeAttribute('data-el-measure-id');
      clone.removeAttribute('class');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('viewBox', viewBox);
      clone.setAttribute('width', String(widthPx));
      clone.setAttribute('height', String(heightPx));
      if (!clone.getAttribute('fill')) clone.setAttribute('fill', 'none');
      if (!clone.getAttribute('stroke')) clone.setAttribute('stroke', '#3556d4');
      if (!clone.getAttribute('stroke-width')) {
        clone.setAttribute('stroke-width', '1.9');
      }
      if (!clone.getAttribute('stroke-linecap')) {
        clone.setAttribute('stroke-linecap', 'round');
      }
      if (!clone.getAttribute('stroke-linejoin')) {
        clone.setAttribute('stroke-linejoin', 'round');
      }
      svgXml = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
    }

    // Deduplicate identical SVG files by content signature
    const contentKey = svgXml.replace(/\s+/g, ' ').trim();
    let asset = hashToAsset.get(contentKey);

    if (!asset) {
      const parentEl = svgEl.parentElement;
      const grandParentEl = parentEl?.parentElement;
      const rawContext =
        Array.from(svgEl.classList).find((c) => !c.startsWith('el-')) ||
        (parentEl &&
          Array.from(parentEl.classList).find(
            (c) =>
              !c.startsWith('elementor-') &&
              !c.startsWith('e-') &&
              !c.startsWith('el-')
          )) ||
        (grandParentEl &&
          Array.from(grandParentEl.classList).find(
            (c) =>
              !c.startsWith('elementor-') &&
              !c.startsWith('e-') &&
              !c.startsWith('el-')
          )) ||
        parentEl?.tagName.toLowerCase() ||
        'icon';

      const cleanSlug =
        rawContext
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 28) || 'icon';

      const idx = extractedAssets.length + 1;
      const fileName = `svg-${idx}-${cleanSlug}.svg`;
      const relativePath = `assets/svg/${fileName}`;
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;

      asset = {
        id: `svg_asset_${idx}`,
        fileName,
        relativePath,
        svgContent: svgXml,
        dataUrl,
        widthPx,
        heightPx,
        viewBox,
        contextLabel: rawContext,
      };
      hashToAsset.set(contentKey, asset);
      extractedAssets.push(asset);
    }

    // Keep animated, background, decorative, or .wf-stage SVGs as live <svg> elements in the DOM
    // so CSS @keyframes, <animate>, gradients, filters, and JS animations work 100% natively!
    if (
      svgEl.closest('.wf-stage') ||
      isAnimatedOrComplexBackgroundSvg(
        svgEl as unknown as SVGElement,
        widthPx,
        heightPx,
        vbW,
        vbH,
        snap
      )
    ) {
      svgEl.setAttribute('data-svg-asset-id', asset.id);
      svgEl.setAttribute('data-svg-fallback', asset.dataUrl);
      return;
    }

    // Replace small static icon <svg> with <img src="assets/svg/..." class="... el-svg-img" />
    const imgReplacement = doc.createElement('img');
    imgReplacement.setAttribute('src', asset.relativePath);
    imgReplacement.setAttribute('width', String(asset.widthPx));
    imgReplacement.setAttribute('height', String(asset.heightPx));
    imgReplacement.setAttribute('alt', svgEl.getAttribute('aria-label') || '');
    imgReplacement.setAttribute('decoding', 'async');
    imgReplacement.setAttribute('data-local-svg-asset', asset.relativePath);
    imgReplacement.setAttribute('data-svg-asset-id', asset.id);
    imgReplacement.setAttribute('data-svg-fallback', asset.dataUrl);
    imgReplacement.setAttribute(
      'onerror',
      'if(this.dataset.svgFallback&&this.src!==this.dataset.svgFallback){this.src=this.dataset.svgFallback;}'
    );
    if (measureId) {
      imgReplacement.setAttribute('data-el-measure-id', measureId);
    }

    const existingClasses = (svgEl.getAttribute('class') || '').trim();
    imgReplacement.setAttribute(
      'class',
      existingClasses ? `${existingClasses} el-svg-img` : 'el-svg-img'
    );
    const existingStyle = svgEl.getAttribute('style');
    if (existingStyle) {
      imgReplacement.setAttribute('style', existingStyle);
    }
    if (svgEl.getAttribute('aria-hidden')) {
      imgReplacement.setAttribute(
        'aria-hidden',
        svgEl.getAttribute('aria-hidden')!
      );
    }

    svgEl.replaceWith(imgReplacement);
  });

  return extractedAssets;
}

const ELEMENTOR_BOILERPLATE_CLASSES = new Set([
  'e-con',
  'e-con-full',
  'e-con-boxed',
  'e-flex',
  'e-parent',
  'e-child',
  'elementor-element',
  'elementor-widget',
  'elementor-widget-container',
  'elementor-button-wrapper',
  'elementor-widget-heading',
  'elementor-widget-button',
  'elementor-widget-text-editor',
  'elementor-widget-image',
  'elementor-widget-html',
  'elementor-widget-divider',
  'elementor-widget-spacer',
  'elementor-widget-icon-box',
  'elementor-widget-icon-list',
]);

const ALLOWED_CONTAINER_HTML_TAGS = new Set([
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
]);

const MATERIAL_TO_FA_MAP: Record<string, string> = {
  trending_up: 'fas fa-chart-line',
  visibility: 'fas fa-eye',
  bolt: 'fas fa-bolt',
  verified_user: 'fas fa-user-shield',
  search_insights: 'fas fa-search-plus',
  draw: 'fas fa-pen-nib',
  terminal: 'fas fa-terminal',
  rocket: 'fas fa-rocket',
  price_check: 'fas fa-tags',
  check: 'fas fa-check',
  check_circle: 'fas fa-check-circle',
  workspace_premium: 'fas fa-gem',
  calculate: 'fas fa-calculator',
  send: 'fas fa-paper-plane',
  expand_more: 'fas fa-chevron-down',
  alternate_email: 'fas fa-at',
  share: 'fas fa-share-alt',
  location_on: 'fas fa-map-marker-alt',
  call: 'fas fa-phone-alt',
  arrow_back: 'fas fa-arrow-left',
  arrow_forward: 'fas fa-arrow-right',
  auto_awesome: 'fas fa-magic',
  play_circle: 'fas fa-play-circle',
  lock: 'fas fa-lock',
};

function getCleanAuthorClasses(el: Element): string[] {
  return Array.from(el.classList).filter(
    (cls) =>
      Boolean(cls) &&
      !ELEMENTOR_BOILERPLATE_CLASSES.has(cls) &&
      !/^elementor-element-[a-f0-9]+$/i.test(cls)
  );
}

function getIconPositionInButton(
  btnEl: Element,
  iconEl: Element
): 'before' | 'after' {
  const clone = btnEl.cloneNode(true) as Element;
  const walker = document.createTreeWalker(
    btnEl,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let sawText = false;
  let sawIcon = false;
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current === iconEl || iconEl.contains(current)) {
      sawIcon = true;
      if (sawText) return 'after';
    } else if (
      current.nodeType === Node.TEXT_NODE &&
      (current.textContent || '').trim().length > 0
    ) {
      sawText = true;
      if (sawIcon) return 'before';
    }
    current = walker.nextNode();
  }
  void clone;
  return 'before';
}

/**
 * Infers the closest FontAwesome 5 icon (`{ value, library }`) for any `<svg>`, `<img class="el-svg-img">`,
 * `<i>`, or `.material-symbols-outlined` element using class names, context labels, sibling headings, and SVG shape heuristics.
 */
function inferFontAwesomeIconFromSvgOrElement(
  iconEl: Element,
  wrapperEl?: Element
): { value: string; library: string } {
  const targetEls = wrapperEl && wrapperEl !== iconEl ? [iconEl, wrapperEl] : [iconEl];

  // 1. Check explicit FontAwesome classes (`e-fas-*`, `fa-*`)
  for (const tEl of targetEls) {
    for (const cls of Array.from(tEl.classList)) {
      const eMatch = cls.match(/^e-(fas|far|fab)-(.+)$/i);
      if (eMatch) {
        const prefix = eMatch[1].toLowerCase();
        const name = eMatch[2].toLowerCase();
        const lib =
          prefix === 'far'
            ? 'fa-regular'
            : prefix === 'fab'
            ? 'fa-brands'
            : 'fa-solid';
        return { value: `${prefix} fa-${name}`, library: lib };
      }
    }
    const clsList = Array.from(tEl.classList);
    const faName = clsList.find(
      (c) =>
        c.startsWith('fa-') &&
        !['fa-solid', 'fa-regular', 'fa-brands', 'fa-fw', 'fa-lg'].includes(c)
    );
    if (faName) {
      const prefix =
        clsList.find((c) => ['fas', 'far', 'fab'].includes(c)) || 'fas';
      const lib =
        prefix === 'far'
          ? 'fa-regular'
          : prefix === 'fab'
          ? 'fa-brands'
          : 'fa-solid';
      return { value: `${prefix} ${faName}`, library: lib };
    }
  }

  // 2. Check Material Symbol name
  const matKey = (
    iconEl.getAttribute('data-icon') ||
    (iconEl.classList.contains('material-symbols-outlined')
      ? iconEl.textContent
      : '') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (matKey && MATERIAL_TO_FA_MAP[matKey]) {
    return { value: MATERIAL_TO_FA_MAP[matKey], library: 'fa-solid' };
  }

  // 3. Inspect decoded SVG markup + surrounding context (classes, aria-label, card heading text)
  let rawSvgMarkup = iconEl.outerHTML || '';
  const fallbackDataUrl = iconEl.getAttribute('data-svg-fallback') || '';
  if (fallbackDataUrl.startsWith('data:image/svg+xml;utf8,')) {
    try {
      rawSvgMarkup +=
        ' ' +
        decodeURIComponent(
          fallbackDataUrl.slice('data:image/svg+xml;utf8,'.length)
        );
    } catch {
      // ignore decode error
    }
  }

  const parentCard = (wrapperEl || iconEl).parentElement;
  const siblingHeadingText =
    parentCard
      ?.querySelector('h1, h2, h3, h4, h5, h6, strong, .card-title')
      ?.textContent?.trim() || '';
  const buttonContext = (wrapperEl || iconEl).closest('a, button');
  const combinedContext = [
    iconEl.getAttribute('class') || '',
    iconEl.getAttribute('data-local-svg-asset') || '',
    iconEl.getAttribute('alt') || '',
    wrapperEl?.getAttribute('class') || '',
    wrapperEl?.getAttribute('aria-label') || '',
    wrapperEl?.getAttribute('title') || '',
    siblingHeadingText,
    buttonContext ? buttonContext.textContent || '' : '',
    rawSvgMarkup,
  ]
    .join(' ')
    .toLowerCase();

  // Button arrow / action icons
  if (buttonContext) {
    if (
      /arrow-left|chevron-left|M19\s+12H5|12\s+19\s+5\s+12|M15\s+18l-6-6/i.test(
        combinedContext
      ) ||
      (buttonContext.textContent || '').trim().length > 0
    ) {
      if (/copy|کپی/i.test(combinedContext)) {
        return { value: 'far fa-copy', library: 'fa-regular' };
      }
      if (/refresh|sync|reload|تولید|مجدد/i.test(combinedContext)) {
        return { value: 'fas fa-sync-alt', library: 'fa-solid' };
      }
      return { value: 'fas fa-arrow-left', library: 'fa-solid' };
    }
  }

  if (/copy|کپی|rect[^>]*x="9"\s+y="9"/i.test(combinedContext)) {
    return { value: 'far fa-copy', library: 'fa-regular' };
  }
  if (
    /refresh|sync|rotate|23\s+4\s+23\s+10|M21\s+12a9\s+9/i.test(combinedContext)
  ) {
    return { value: 'fas fa-sync-alt', library: 'fa-solid' };
  }
  if (
    /کوتاه‌کننده|لینک|link|url|chain|10\s+13a5\s+5|M15\s+7h3a5\s+5/i.test(
      combinedContext
    )
  ) {
    return { value: 'fas fa-link', library: 'fa-solid' };
  }
  if (
    /پسورد|رمز|قفل|امنیت|lock|password|M7\s+11V7a5\s+5/i.test(combinedContext)
  ) {
    return { value: 'fas fa-lock', library: 'fa-solid' };
  }
  if (
    /لورم|ایپسوم|متن|فایل|سند|file|doc|14\s+2H6a2\s+2/i.test(combinedContext)
  ) {
    return { value: 'fas fa-file-alt', library: 'fa-solid' };
  }
  if (
    /رایگان|هدیه|gift|20\s+12v10H4V12|M20\s+12v10/i.test(combinedContext)
  ) {
    return { value: 'fas fa-gift', library: 'fa-solid' };
  }
  if (
    /سریع|شتاب|فوری|bolt|zap|lightning|13\s+2\s+3\s+14\s+12\s+14/i.test(
      combinedContext
    )
  ) {
    return { value: 'fas fa-bolt', library: 'fa-solid' };
  }
  if (
    /ساده|کاربردی|تنظیم|slider|tune|options|<line[^>]+><line[^>]+><line/i.test(
      combinedContext
    )
  ) {
    return { value: 'fas fa-sliders-h', library: 'fa-solid' };
  }
  if (
    /مجموعه|جادو|درخشش|sparkle|magic|star|12\s+3l1\.9|M12\s+2l/i.test(
      combinedContext
    )
  ) {
    return { value: 'fas fa-magic', library: 'fa-solid' };
  }
  if (/check|tick|تایید|تأیید|20\s+6\s+9\s+17\s+4\s+12/i.test(combinedContext)) {
    return { value: 'fas fa-check', library: 'fa-solid' };
  }
  if (/shield|سپر|محافظ/i.test(combinedContext)) {
    return { value: 'fas fa-shield-alt', library: 'fa-solid' };
  }
  if (/search|جستجو/i.test(combinedContext)) {
    return { value: 'fas fa-search', library: 'fa-solid' };
  }
  if (/arrow-left|M19\s+12H5/i.test(combinedContext)) {
    return { value: 'fas fa-arrow-left', library: 'fa-solid' };
  }

  return { value: 'fas fa-cube', library: 'fa-solid' };
}

function isActualFontIconElement(el: Element): boolean {
  if (
    el.classList.contains('material-symbols-outlined') ||
    el.classList.contains('material-icons') ||
    el.hasAttribute('data-icon')
  ) {
    return true;
  }
  if (el.tagName.toLowerCase() === 'i') {
    const cls = el.getAttribute('class') || '';
    return /\b(fa|fas|far|fab|fal|fad|fa-[a-z0-9-]+|bi|bi-[a-z0-9-]+|ri-[a-z0-9-]+|bx|bx-[a-z0-9-]+|ti-[a-z0-9-]+|icofont-[a-z0-9-]+|ion-[a-z0-9-]+|lucide-[a-z0-9-]+)\b/i.test(
      cls
    );
  }
  return false;
}

function attachOriginalSvgClasses(
  svgMarkup: string,
  sourceEl: Element
): string {
  const cleanClasses = getCleanAuthorClasses(sourceEl).filter(
    (c) => c !== 'el-svg-img'
  );
  if (cleanClasses.length === 0 || !svgMarkup.trim().startsWith('<svg')) {
    return svgMarkup;
  }
  const classStr = cleanClasses.join(' ');
  if (/\bclass=["']([^"']*)["']/i.test(svgMarkup)) {
    return svgMarkup.replace(
      /\bclass=["']([^"']*)["']/i,
      (_m, existing) => `class="${existing} ${classStr}"`
    );
  }
  return svgMarkup.replace(/^<svg\b/i, `<svg class="${classStr}"`);
}

function extractFaIconFromButtonOrElement(
  el: Element,
  svgAssetById?: Map<string, ExtractedSvgAsset>
): {
  selectedIcon?: { value: string; library: string };
  rawIconSvg?: string;
  iconPosition?: 'before' | 'after';
  svgAssetId?: string;
} {
  // 0. Check extracted local SVG <img class="... el-svg-img"> inside button (supports multi-icon buttons like #theme-toggle)
  const svgImgs = Array.from(
    el.querySelectorAll('img[data-local-svg-asset], img.el-svg-img')
  );
  if (svgImgs.length > 0) {
    const firstImg = svgImgs[0];
    const iconPosition = getIconPositionInButton(el, firstImg);
    const firstAssetId = (
      firstImg.getAttribute('data-svg-asset-id') || ''
    ).trim();
    const firstAsset = firstAssetId
      ? svgAssetById?.get(firstAssetId)
      : undefined;
    const combinedMarkup = svgImgs
      .map((imgNode) => {
        const aid = (imgNode.getAttribute('data-svg-asset-id') || '').trim();
        const asset = aid ? svgAssetById?.get(aid) : undefined;
        const raw = asset
          ? prepareInlineCurrentColorSvg(asset.svgContent)
          : stripInternalMeasureAttributes(imgNode.outerHTML);
        return attachOriginalSvgClasses(raw, imgNode);
      })
      .join('');
    const selectedIcon = inferFontAwesomeIconFromSvgOrElement(firstImg, el);
    return {
      selectedIcon,
      rawIconSvg: combinedMarkup,
      iconPosition,
      svgAssetId: svgImgs.length === 1 ? firstAsset?.id : undefined,
    };
  }

  // 1. Check .e-font-icon-svg or inline svg inside button
  const svgIcons = Array.from(
    el.querySelectorAll('svg.e-font-icon-svg, .elementor-button-icon svg, svg')
  );
  if (svgIcons.length > 0) {
    const firstSvg = svgIcons[0];
    const firstAssetId = (
      firstSvg.getAttribute('data-svg-asset-id') || ''
    ).trim();
    const firstAsset = firstAssetId
      ? svgAssetById?.get(firstAssetId)
      : undefined;
    const combinedSvg = svgIcons
      .map((sNode) => {
        const aid = (sNode.getAttribute('data-svg-asset-id') || '').trim();
        const asset = aid ? svgAssetById?.get(aid) : undefined;
        const raw = asset
          ? prepareInlineCurrentColorSvg(asset.svgContent)
          : prepareInlineCurrentColorSvg(
              stripInternalMeasureAttributes(sNode.outerHTML)
            );
        return attachOriginalSvgClasses(raw, sNode);
      })
      .join('');
    const iconPosition = getIconPositionInButton(el, firstSvg);
    const selectedIcon = inferFontAwesomeIconFromSvgOrElement(firstSvg, el);
    return {
      selectedIcon,
      rawIconSvg: combinedSvg,
      iconPosition,
      svgAssetId: svgIcons.length === 1 ? firstAsset?.id : undefined,
    };
  }

  // 2. Check <i class="fas fa-..."> (strictly real icon classes, never plain <i></i> bars/dots)
  const iEl = Array.from(el.querySelectorAll('i')).find((node) =>
    isActualFontIconElement(node)
  );
  if (iEl) {
    const iconPosition = getIconPositionInButton(el, iEl);
    const selectedIcon = inferFontAwesomeIconFromSvgOrElement(iEl, el);
    return {
      selectedIcon,
      rawIconSvg: stripInternalMeasureAttributes(iEl.outerHTML),
      iconPosition,
    };
  }

  // 3. Check Material Symbols <span class="material-symbols-outlined">
  const matEl = el.querySelector('.material-symbols-outlined, [data-icon]');
  if (matEl) {
    const iconPosition = getIconPositionInButton(el, matEl);
    const selectedIcon = inferFontAwesomeIconFromSvgOrElement(matEl, el);
    return {
      selectedIcon,
      rawIconSvg: stripInternalMeasureAttributes(matEl.outerHTML),
      iconPosition,
    };
  }

  return {};
}

function extractCleanButtonText(btnEl: Element): string {
  const explicitTextEl = btnEl.querySelector('.elementor-button-text');
  if (explicitTextEl) {
    return (explicitTextEl.textContent || '').replace(/\s+/g, ' ').trim();
  }
  const clone = btnEl.cloneNode(true) as Element;
  clone
    .querySelectorAll(
      '.sr-only, .visually-hidden, [class*="-sr-only"], [hidden], .material-symbols-outlined, [data-icon], svg, img.el-svg-img, img[data-local-svg-asset], i[class*="fa-"], .elementor-button-icon'
    )
    .forEach((iconNode) => iconNode.remove());
  if (clone.querySelector('b, strong, em')) {
    clone.querySelectorAll('span').forEach((sp) => {
      if (sp.classList.length === 0) {
        sp.replaceWith(...Array.from(sp.childNodes));
      }
    });
    return stripInternalMeasureAttributes(clone.innerHTML)
      .replace(/\s+/g, ' ')
      .trim();
  }
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function extractCustomDomAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  const ignoredDataAttrs = new Set([
    'data-el-measure-id',
    'data-svg-asset-id',
    'data-svg-fallback',
    'data-local-svg-asset',
    'data-id',
    'data-element_type',
    'data-widget_type',
  ]);
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    const name = attr.name.toLowerCase();
    if (name.startsWith('data-') && !ignoredDataAttrs.has(name)) {
      attrs[name] = attr.value;
    } else if (
      name === 'hidden' ||
      name === 'aria-current' ||
      name === 'aria-selected' ||
      name === 'aria-expanded' ||
      name === 'aria-controls' ||
      name === 'aria-labelledby' ||
      name === 'aria-label' ||
      name === 'title' ||
      name === 'role' ||
      name === 'style' ||
      name === 'dir' ||
      name === 'lang'
    ) {
      attrs[name] = attr.value;
    }
  }
  return attrs;
}

function extractPurePlainText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone
    .querySelectorAll(
      'script, style, svg, img.el-svg-img, img[data-local-svg-asset], .sr-only, .visually-hidden, [class*="-sr-only"], [hidden]'
    )
    .forEach((n) => n.remove());
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Checks whether `el` is an icon wrapper box (e.g. `<div class="tool-icon"><img class="el-svg-img"></div>`,
 * `<div class="why-icon"><svg>...</svg></div>`, `<span class="icon-box">...</span>`) that holds a single icon
 * and zero text content, so it can be converted directly into a Native Elementor `icon-box` Widget inside its card container!
 */
function extractIconBoxTargetChild(
  el: Element,
  computedDimensionsMap?: Map<string, ComputedElementDimensionsSnapshot>
): Element | null {
  const tag = el.tagName.toLowerCase();
  if (
    tag === 'img' &&
    (el.hasAttribute('data-local-svg-asset') ||
      el.classList.contains('el-svg-img'))
  ) {
    return el;
  }
  if (isActualFontIconElement(el)) {
    return el;
  }
  if (tag === 'svg') {
    if (el.classList.contains('sprite')) return null;
    const mId = el.getAttribute('data-el-measure-id') || '';
    const snap = mId ? computedDimensionsMap?.get(mId) : undefined;
    const w = snap?.desktop.widthPx || parseFloat(el.getAttribute('width') || '24') || 24;
    const h = snap?.desktop.heightPx || parseFloat(el.getAttribute('height') || '24') || 24;
    if (
      !isAnimatedOrComplexBackgroundSvg(
        el as unknown as SVGElement,
        w,
        h,
        w,
        h,
        snap
      )
    ) {
      return el;
    }
    return null;
  }

  // Wrapper element (`div`, `span`, `figure`) with zero text and a single icon child
  if (!['div', 'span', 'figure'].includes(tag)) return null;
  const visibleText = (el.textContent || '').replace(/\s+/g, '').trim();
  if (visibleText.length > 0) return null;
  if (el.children.length !== 1) return null;

  const onlyChild = el.children[0];
  return extractIconBoxTargetChild(onlyChild, computedDimensionsMap);
}

interface FaqAccordionParts {
  questionEl: Element;
  answerEls: Element[];
  isOpen: boolean;
}

/**
 * Detects whether `el` is an FAQ / Accordion / Toggle item (`<details><summary>`, `.gf-item`, `.faq-item`,
 * `.accordion-item`, `.qa-item`, or a question+answer pair inside an FAQ list) so it is converted directly into
 * a Native Elementor `accordion` Widget (`widgetType: "accordion"`).
 */
function extractFaqAccordionItemParts(el: Element): FaqAccordionParts | null {
  const tag = el.tagName.toLowerCase();

  // 1. Standard HTML5 <details> + <summary>
  if (tag === 'details') {
    const summaryEl =
      el.querySelector(':scope > summary') || el.querySelector('summary');
    if (!summaryEl) return null;
    const answerEls = Array.from(el.children).filter((c) => c !== summaryEl);
    return {
      questionEl: summaryEl,
      answerEls,
      isOpen: el.hasAttribute('open'),
    };
  }

  // 2. Explicit FAQ / Accordion Item container (.gf-item, .faq-item, .accordion-item, .qa-item, [data-faq-item])
  const clsList = Array.from(el.classList);
  const isExplicitFaqItem =
    clsList.some((c) =>
      /^(gf-item|faq-item|faq__item|accordion-item|accordion__item|qa-item|faq-card|faq-row)$/i.test(
        c
      )
    ) ||
    el.hasAttribute('data-faq-item') ||
    el.hasAttribute('data-accordion-item');

  const parentEl = el.parentElement;
  const isChildOfFaqList =
    Boolean(parentEl) &&
    Array.from(parentEl!.classList).some((c) =>
      /^(faq-list|faq-items|faq-box|faq-grid|accordion|accordion-list|gf-items)$/i.test(
        c
      )
    );

  if (!isExplicitFaqItem && !isChildOfFaqList) {
    return null;
  }

  const questionEl =
    el.querySelector(
      ':scope > .gf-question, :scope > [class*="question"], :scope > [class*="header"], :scope > [class*="trigger"], :scope > button, :scope > summary, :scope > h2, :scope > h3, :scope > h4, :scope > h5'
    ) || (el.children.length === 2 ? el.children[0] : null);

  if (!questionEl) return null;

  const answerEls = Array.from(el.children).filter((c) => c !== questionEl);
  if (answerEls.length === 0) return null;

  const isOpen =
    el.hasAttribute('open') ||
    clsList.includes('open') ||
    clsList.includes('is-open') ||
    clsList.includes('active') ||
    clsList.includes('gf-open') ||
    el.getAttribute('data-open') === 'true' ||
    questionEl.getAttribute('aria-expanded') === 'true';

  return {
    questionEl,
    answerEls,
    isOpen,
  };
}

/**
 * 1:1 Exact-DOM Native Widgets Builder (`exactHtmlMatch: false`):
 * Preserves 100% of the HTML DOM hierarchy, CSS classes, IDs, CSS Grid/Flexbox layouts, animations, and JS selectors
 * by converting structural containers (`div`, `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`)
 * into 1:1 Elementor Flexbox Containers (`elType: "container"`, `content_width: "full"`) and decomposing every
 * leaf element into separate editable Native Elementor Widgets:
 * - Titles / Headings -> `heading` (with 100% pure plain text in `title`, zero HTML code)
 * - Card Icons & SVG Icons -> `icon-box` inside their card container
 * - Buttons & Links -> `button` (with exact HTML classes and computed styles)
 * - Paragraphs & Lists -> `text-editor`
 */
export function buildNativeWidgetsExactDomElementorJson(
  rawHtml: string,
  bodyBackgroundColor: string,
  settings: ConverterSettings,
  initialPlaceholders: PlaceholderEntry[] = [],
  assetMap: Map<string, string> = new Map(),
  computedDimensionsMap?: Map<string, ComputedElementDimensionsSnapshot>
): BuildPipelineOutput {
  const idRegistry = new ElementorIdRegistry();
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const safeSlug =
    (settings.scopePrefix || settings.templateTitle || 'page')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'page';
  const baseScopeClass = safeSlug.startsWith('elementor-')
    ? safeSlug
    : `elementor-${safeSlug}`;

  // 1. Resolve local ZIP assets or data-src / data-fallback attributes on <img> elements
  doc.querySelectorAll('img').forEach((imgEl) => {
    const rawSrc = (imgEl.getAttribute('src') || '').trim();
    const dataSrc = (
      imgEl.getAttribute('data-src') ||
      imgEl.getAttribute('data-lazy-src') ||
      imgEl.getAttribute('data-fallback') ||
      ''
    ).trim();

    const is1x1Gif =
      rawSrc.startsWith('data:image/gif;base64,R0lGOD') ||
      rawSrc.startsWith(
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1"'
      );

    let effectiveSrc = (!rawSrc || is1x1Gif) && dataSrc ? dataSrc : rawSrc;

    if (effectiveSrc && assetMap.size > 0) {
      const normalizedKey = effectiveSrc.replace(/^\.?\//, '');
      const fileNameOnly = normalizedKey.split('/').pop() || '';
      const mapped =
        assetMap.get(effectiveSrc) ||
        assetMap.get(normalizedKey) ||
        assetMap.get(fileNameOnly);
      if (mapped) {
        effectiveSrc = mapped;
      }
    }

    if (effectiveSrc && effectiveSrc !== rawSrc) {
      imgEl.setAttribute('src', effectiveSrc);
    }
  });

  // 2. Remove <style> tags, executable <script> tags, and screen-reader-only / hidden elements from body
  doc.body.querySelectorAll('style').forEach((s) => s.remove());
  doc.body.querySelectorAll('script').forEach((s) => {
    const t = (s.getAttribute('type') || '').toLowerCase();
    if (t !== 'application/ld+json' && t !== 'application/json') {
      s.remove();
    }
  });
  doc.body
    .querySelectorAll(
      '.sr-only, .visually-hidden, [class*="-sr-only"], .menu-toggle, .mobile-nav, .nav-panel, .skip-link, .skip, .ga-skip, .p-card__fallback'
    )
    .forEach((srEl) => srEl.remove());

  // Remove empty system containers that only held <style>/<script>
  doc.body.querySelectorAll('[class*="-system"]').forEach((sysEl) => {
    if (!sysEl.textContent?.trim() && sysEl.children.length === 0) {
      sysEl.remove();
    }
  });

  if (!settings.includeHeaderFooter) {
    doc.body
      .querySelectorAll(
        'body > header, main > header, [class*="-page"] > header, body > div > header, .site-header, .ga-header, .gf-header, .gc-header, body > nav, .skip-link, [class*="-skip"]'
      )
      .forEach((el) => el.remove());

    doc.body
      .querySelectorAll(
        'body > footer, main > footer, [class*="-page"] > footer, body > div > footer, .site-footer, .ga-footer, .gf-footer, .gc-footer'
      )
      .forEach((el) => el.remove());
  }

  // 2.5. Pre-activate progressive-enhancement tabbed workbenches (#demo / #demo-tabs / .js-only)
  // so that in WordPress Elementor (both Editor & Frontend), the tabs are horizontal and only the first panel is open by default
  doc.body.querySelectorAll('#demo').forEach((demoEl) => {
    demoEl.classList.add('is-live');
    const demoTabs = demoEl.querySelector('#demo-tabs');
    if (demoTabs) {
      demoTabs.removeAttribute('hidden');
      const tabBtns = Array.from(demoTabs.querySelectorAll('.demo-tab'));
      tabBtns.forEach((btn, idx) => {
        btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      });
    }
    demoEl.querySelectorAll('.js-only[hidden]').forEach((jsEl) => {
      jsEl.removeAttribute('hidden');
    });
    const demoPanels = Array.from(demoEl.querySelectorAll('.demo-panel'));
    demoPanels.forEach((panelEl, idx) => {
      if (idx > 0) {
        panelEl.setAttribute('hidden', '');
      } else {
        panelEl.removeAttribute('hidden');
      }
    });
  });

  // 3. Extract inline <svg> elements into standalone local .svg files (assets/svg/*.svg)
  const extractedSvgs = extractAndReplaceSvgsAsLocalFiles(
    doc,
    computedDimensionsMap
  );
  const svgAssetById = new Map<string, ExtractedSvgAsset>(
    extractedSvgs.map((a) => [a.id, a])
  );

  // 4. Normalize mixed direct text nodes inside elements that also contain child elements (like badges `<span class="badge"><img class="el-svg-img"> ابزارها</span>`)
  // by wrapping direct non-empty text nodes in `<span class="el-inline-text">` so the parent becomes a clean Container with `icon-box` + `heading` widgets!
  doc.body.querySelectorAll('*').forEach((el) => {
    if (el.closest('.wf-stage')) return;
    const t = el.tagName.toLowerCase();
    if (
      [
        'script',
        'style',
        'svg',
        'a',
        'button',
        'details',
        'summary',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'blockquote',
        'code',
        'pre',
        'textarea',
        'option',
      ].includes(t)
    ) {
      return;
    }
    if (el.children.length === 0) return;
    // Do NOT split inline formatted text blocks (e.g. `<div class="mock-out">hamisys.ir/<b>s/8fK2q</b><br>Xk7#mQ2$vL9pR4tZ</div>`)
    const allChildrenInlineFormatting = Array.from(el.children).every((ch) =>
      ['b', 'strong', 'em', 'br', 'code', 'mark', 'small', 'sub', 'sup'].includes(
        ch.tagName.toLowerCase()
      ) && ch.classList.length === 0
    );
    if (allChildrenInlineFormatting) return;

    const childNodes = Array.from(el.childNodes);
    const hasNonEmptyTextNode = childNodes.some(
      (cn) =>
        cn.nodeType === Node.TEXT_NODE &&
        (cn.textContent || '').trim().length > 0
    );
    if (!hasNonEmptyTextNode) return;

    childNodes.forEach((cn) => {
      if (
        cn.nodeType === Node.TEXT_NODE &&
        (cn.textContent || '').trim().length > 0
      ) {
        const spanWrap = doc.createElement('span');
        spanWrap.textContent = (cn.textContent || '').replace(/\s+/g, ' ').trim();
        el.replaceChild(spanWrap, cn);
      }
    });
  });

  const counts = {
    sections: 0,
    innerSections: 0,
    columns: 0,
    containers: 0,
    widgets: 0,
    decorativeWidgets: 0,
  };
  const widgetBreakdown: Record<string, number> = {};
  const cleanCustomFont = (settings.customFontFamily || '').trim();

  const registerWidget = (
    widgetType: string,
    widgetSettings: Record<string, unknown>,
    seed: string
  ): ElementorNode => {
    counts.widgets++;
    widgetBreakdown[widgetType] = (widgetBreakdown[widgetType] || 0) + 1;
    const nodeId = idRegistry.generateId(seed);
    if (cleanCustomFont) {
      if (
        widgetType === 'heading' ||
        widgetType === 'text-editor' ||
        widgetType === 'button'
      ) {
        widgetSettings.typography_typography = 'custom';
        widgetSettings.typography_font_family = cleanCustomFont;
      } else if (widgetType === 'icon-box') {
        widgetSettings.title_typography_typography = 'custom';
        widgetSettings.title_typography_font_family = cleanCustomFont;
        widgetSettings.description_typography_typography = 'custom';
        widgetSettings.description_typography_font_family = cleanCustomFont;
      } else if (
        widgetType === 'accordion' ||
        widgetType === 'toggle' ||
        widgetType === 'tabs'
      ) {
        widgetSettings.title_typography_typography = 'custom';
        widgetSettings.title_typography_font_family = cleanCustomFont;
        widgetSettings.content_typography_typography = 'custom';
        widgetSettings.content_typography_font_family = cleanCustomFont;
      }
    }
    if (
      widgetSettings._custom_attrs &&
      typeof widgetSettings._custom_attrs === 'object' &&
      Object.keys(widgetSettings._custom_attrs as Record<string, unknown>)
        .length > 0
    ) {
      const existingCls = String(
        widgetSettings.css_classes || widgetSettings._css_classes || ''
      ).trim();
      const attrMarker = `el-attr-${nodeId}`;
      const nextCls = existingCls ? `${existingCls} ${attrMarker}` : attrMarker;
      widgetSettings.css_classes = nextCls;
      widgetSettings._css_classes = nextCls;
    }
    return {
      id: nodeId,
      elType: 'widget',
      widgetType,
      settings: widgetSettings,
      elements: [],
    };
  };

  let nodeCounter = 0;

  const applyWidgetIdentity = (
    el: Element,
    targetSettings: Record<string, unknown>,
    extraClasses: string[] = []
  ) => {
    const ariaCurrentVal = (el.getAttribute('aria-current') || '').toLowerCase();
    const ariaCurrentClasses =
      ariaCurrentVal === 'page' || ariaCurrentVal === 'true'
        ? ['el-aria-current-page']
        : [];
    const classes = [
      ...getCleanAuthorClasses(el),
      ...ariaCurrentClasses,
      ...extraClasses,
    ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);
    if (classes.length > 0) {
      const joined = classes.join(' ');
      targetSettings._css_classes = joined;
      targetSettings.css_classes = joined;
    }
    const idVal = (el.getAttribute('id') || '').trim();
    if (idVal) {
      targetSettings._element_id = idVal;
      targetSettings.css_id = idVal;
    }
    const customAttrs = extractCustomDomAttributes(el);
    if (Object.keys(customAttrs).length > 0) {
      targetSettings._custom_attrs = customAttrs;
    }
  };

  /**
   * Builds a Native Elementor `icon-box` Widget (`widgetType: "icon-box"`) from an icon wrapper (`<div class="tool-icon">`)
   * or a standalone icon element (`<img class="el-svg-img">`, `<svg>`, `<i>`), preserving exact HTML box styles
   * and embedding the exact original SVG icon directly in `page.json`!
   */
  const buildIconBoxWidgetFromElement = (
    wrapperEl: Element,
    iconEl: Element,
    seed: string
  ): ElementorNode => {
    const selectedIcon = inferFontAwesomeIconFromSvgOrElement(iconEl, wrapperEl);
    const svgAssetId = (
      iconEl.getAttribute('data-svg-asset-id') ||
      wrapperEl.getAttribute('data-svg-asset-id') ||
      ''
    ).trim();
    const svgAsset = svgAssetId ? svgAssetById.get(svgAssetId) : undefined;

    const rawIconSvg = svgAsset
      ? prepareInlineCurrentColorSvg(svgAsset.svgContent)
      : prepareInlineCurrentColorSvg(
          stripInternalMeasureAttributes(iconEl.outerHTML)
        );

    const settings: Record<string, unknown> = {
      selected_icon: selectedIcon,
      view: 'default',
      position: 'top',
      title_text: '',
      description_text: '',
      _raw_icon_svg: rawIconSvg,
    };

    const svgIconClass = svgAsset ? [`el-svg-icon-${svgAsset.id}`] : [];
    const extraIconClasses =
      wrapperEl !== iconEl
        ? [
            ...getCleanAuthorClasses(iconEl),
            'el-native-icon-box',
            ...svgIconClass,
          ]
        : ['el-native-icon-box', ...svgIconClass];
    applyWidgetIdentity(wrapperEl, settings, extraIconClasses);

    injectComputedStylesIntoElementorController(
      wrapperEl,
      'icon-box',
      settings,
      computedDimensionsMap
    );

    if (wrapperEl !== iconEl && computedDimensionsMap) {
      const iconMeasureId = (
        iconEl.getAttribute('data-el-measure-id') || ''
      ).trim();
      const iconSnap = iconMeasureId
        ? computedDimensionsMap.get(iconMeasureId)
        : undefined;
      if (iconSnap && iconSnap.desktop.widthPx > 0) {
        settings.icon_size = {
          unit: 'px',
          size: iconSnap.desktop.widthPx,
        };
      }
    }

    return registerWidget('icon-box', settings, `${seed}_icbox`);
  };

  /**
   * Builds a Native Elementor `accordion` Widget (`widgetType: "accordion"`) from a `<details><summary>` element
   * or a custom FAQ / Accordion item (`.gf-item`, `.faq-item`, `.accordion-item`), preserving exact question text,
   * answer HTML, icons, and computed styles.
   */
  const buildAccordionWidgetFromElement = (
    el: Element,
    parts: FaqAccordionParts,
    seed: string
  ): ElementorNode => {
    const headingTitleEl = parts.questionEl.querySelector(
      '.elementor-heading-title'
    );
    let titleText = '';
    if (headingTitleEl) {
      titleText = extractPurePlainText(headingTitleEl);
    } else {
      const qClone = parts.questionEl.cloneNode(true) as Element;
      qClone
        .querySelectorAll(
          '.sr-only, .visually-hidden, [class*="-sr-only"], [hidden], .material-symbols-outlined, [data-icon], svg, img.el-svg-img, img[data-local-svg-asset], i[class*="fa-"], .elementor-button-icon, [class*="icon"]'
        )
        .forEach((n) => n.remove());
      titleText = (qClone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const contentParts: string[] = [];
    for (const ansEl of parts.answerEls) {
      const innerContainer =
        ansEl.querySelector(':scope > .elementor-widget-container') || ansEl;
      const ansTag = innerContainer.tagName.toLowerCase();
      if (ansTag === 'p') {
        contentParts.push(
          `<p>${stripInternalMeasureAttributes(
            innerContainer.innerHTML.trim()
          )}</p>`
        );
      } else if (innerContainer.children.length > 0) {
        contentParts.push(
          stripInternalMeasureAttributes(innerContainer.innerHTML.trim())
        );
      } else {
        const plainAns = extractPurePlainText(innerContainer);
        if (plainAns) {
          contentParts.push(`<p>${plainAns}</p>`);
        }
      }
    }
    const contentHtml = contentParts.join('\n');

    const { selectedIcon, rawIconSvg, svgAssetId } =
      extractFaIconFromButtonOrElement(parts.questionEl, svgAssetById);

    const isGfItem = el.classList.contains('gf-item');
    const defaultSelectedIcon = isGfItem
      ? { value: 'fas fa-plus', library: 'fa-solid' }
      : selectedIcon || { value: 'fas fa-chevron-down', library: 'fa-solid' };
    const defaultActiveIcon = isGfItem
      ? { value: 'fas fa-times', library: 'fa-solid' }
      : { value: 'fas fa-chevron-up', library: 'fa-solid' };

    const itemClasses = getCleanAuthorClasses(el);
    const qTarget = headingTitleEl || parts.questionEl;
    const titleClasses = [
      ...getCleanAuthorClasses(parts.questionEl),
      ...(qTarget !== parts.questionEl ? getCleanAuthorClasses(qTarget) : []),
    ].filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

    const firstAns = parts.answerEls[0];
    const contentClasses = firstAns ? getCleanAuthorClasses(firstAns) : [];

    const tabId = idRegistry.generateId(`${seed}_tab`);
    const settings: Record<string, unknown> = {
      tabs: [
        {
          _id: tabId,
          tab_title: titleText,
          tab_content: contentHtml,
          _is_open: parts.isOpen,
          _source_tag: el.tagName.toLowerCase(),
          _item_classes: itemClasses.join(' '),
          _title_classes: titleClasses.join(' '),
          _content_classes: contentClasses.join(' '),
          _raw_icon_svg: rawIconSvg || '',
        },
      ],
      selected_icon: defaultSelectedIcon,
      selected_active_icon: defaultActiveIcon,
      title_html_tag: isGfItem ? 'h3' : 'div',
      icon_align: 'left',
    };

    if (rawIconSvg) {
      settings._raw_icon_svg = rawIconSvg;
    }

    const extraAccClasses = [
      'el-native-accordion',
      ...(svgAssetId ? [`el-svg-icon-${svgAssetId}`] : []),
    ];
    applyWidgetIdentity(el, settings, extraAccClasses);

    injectComputedStylesIntoElementorController(
      el,
      'accordion',
      settings,
      computedDimensionsMap
    );

    if (computedDimensionsMap) {
      const qMeasureId = (
        qTarget.getAttribute('data-el-measure-id') || ''
      ).trim();
      const qSnap = qMeasureId
        ? computedDimensionsMap.get(qMeasureId)
        : undefined;
      if (qSnap) {
        if (qSnap.desktop.color) {
          settings.title_color = qSnap.desktop.color;
          settings.tab_active_color = qSnap.desktop.color;
        }
        if (qSnap.desktop.fontSizePx > 0) {
          settings.title_typography_typography = 'custom';
          settings.title_typography_font_size = {
            unit: 'px',
            size: qSnap.desktop.fontSizePx,
          };
          settings.title_typography_font_weight = qSnap.desktop.fontWeight;
          settings.title_typography_line_height = {
            unit: 'px',
            size: qSnap.desktop.lineHeightPx,
          };
        }
      }

      if (firstAns) {
        const aMeasureId = (
          firstAns.getAttribute('data-el-measure-id') || ''
        ).trim();
        const aSnap = aMeasureId
          ? computedDimensionsMap.get(aMeasureId)
          : undefined;
        if (aSnap) {
          if (aSnap.desktop.color) {
            settings.content_color = aSnap.desktop.color;
          }
          if (aSnap.desktop.fontSizePx > 0) {
            settings.content_typography_typography = 'custom';
            settings.content_typography_font_size = {
              unit: 'px',
              size: aSnap.desktop.fontSizePx,
            };
            settings.content_typography_line_height = {
              unit: 'px',
              size: aSnap.desktop.lineHeightPx,
            };
          }
        }
      }
    }

    return registerWidget('accordion', settings, `${seed}_acc`);
  };

  const convertElement = (
    el: Element,
    isRootContainer: boolean
  ): ElementorNode | null => {
    nodeCounter++;
    const seed = `nd_${nodeCounter}`;
    const tag = el.tagName.toLowerCase();

    if (tag === 'style') return null;
    if (tag === 'script') {
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (t !== 'application/ld+json' && t !== 'application/json') {
        return null;
      }
      return registerWidget(
        'html',
        {
          html: stripInternalMeasureAttributes(el.outerHTML),
          _css_classes: 'el-native-html',
          css_classes: 'el-native-html',
        },
        `${seed}_schema`
      );
    }

    // CASE 1: Explicit `.elementor-widget` in source HTML (e.g. gilaclick-faq.html)
    if (el.classList.contains('elementor-widget')) {
      const containerEl =
        el.querySelector(':scope > .elementor-widget-container') || el;

      // 1A: Heading Widget (.elementor-widget-heading)
      if (el.classList.contains('elementor-widget-heading')) {
        const titleEl =
          containerEl.querySelector('.elementor-heading-title') ||
          containerEl.querySelector('h1, h2, h3, h4, h5, h6, p, div, span');
        const headerSize = titleEl
          ? titleEl.tagName.toLowerCase()
          : 'h2';
        const cleanTitleText = extractPurePlainText(titleEl || containerEl);

        const settings: Record<string, unknown> = {
          title: cleanTitleText,
          header_size: [
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'p',
            'div',
            'span',
          ].includes(headerSize)
            ? headerSize
            : 'h2',
        };

        if (
          titleEl &&
          titleEl.children.length === 1 &&
          titleEl.children[0].tagName.toLowerCase() === 'a'
        ) {
          const aChild = titleEl.children[0];
          const href = (aChild.getAttribute('href') || '').trim();
          if (href) {
            settings.link = {
              url: href,
              is_external:
                aChild.getAttribute('target') === '_blank' ? 'on' : '',
              nofollow: (aChild.getAttribute('rel') || '').includes('nofollow')
                ? 'on'
                : '',
            };
            settings.title = extractPurePlainText(aChild);
          }
        }

        const extraTitleClasses = titleEl
          ? getCleanAuthorClasses(titleEl).filter(
              (c) => c !== 'elementor-heading-title'
            )
          : [];
        applyWidgetIdentity(el, settings, extraTitleClasses);
        if (!settings._element_id && titleEl?.id) {
          settings._element_id = titleEl.id;
          settings.css_id = titleEl.id;
        }
        injectComputedStylesIntoElementorController(
          titleEl || el,
          'heading',
          settings,
          computedDimensionsMap
        );
        return registerWidget('heading', settings, `${seed}_hd`);
      }

      // 1B: Button Widget (.elementor-widget-button)
      if (el.classList.contains('elementor-widget-button')) {
        const btnEl =
          containerEl.querySelector(
            'a.elementor-button, button.elementor-button, a, button'
          ) || containerEl;
        const href = (btnEl.getAttribute('href') || '#').trim();
        const isExternal = btnEl.getAttribute('target') === '_blank';
        const nofollow = (btnEl.getAttribute('rel') || '').includes('nofollow');
        const btnText = extractCleanButtonText(btnEl);
        const { selectedIcon, rawIconSvg, iconPosition, svgAssetId } =
          extractFaIconFromButtonOrElement(btnEl, svgAssetById);

        const settings: Record<string, unknown> = {
          text: btnText,
          link: {
            url: href,
            is_external: isExternal ? 'on' : '',
            nofollow: nofollow ? 'on' : '',
          },
          size: 'sm',
        };

        if (selectedIcon) {
          settings.selected_icon = selectedIcon;
          settings.icon_align = iconPosition === 'after' ? 'left' : 'right';
        }
        if (rawIconSvg) {
          settings._raw_icon_svg = rawIconSvg;
        }
        if (iconPosition) {
          settings._icon_position = iconPosition;
        }

        applyWidgetIdentity(
          el,
          settings,
          svgAssetId ? [`el-svg-icon-${svgAssetId}`] : []
        );
        injectComputedStylesIntoElementorController(
          btnEl || el,
          'button',
          settings,
          computedDimensionsMap
        );
        return registerWidget('button', settings, `${seed}_btn`);
      }

      // 1C: Text Editor Widget (.elementor-widget-text-editor)
      if (el.classList.contains('elementor-widget-text-editor')) {
        const settings: Record<string, unknown> = {
          editor: stripInternalMeasureAttributes(containerEl.innerHTML.trim()),
        };
        applyWidgetIdentity(el, settings);
        injectComputedStylesIntoElementorController(
          el,
          'text-editor',
          settings,
          computedDimensionsMap
        );
        return registerWidget('text-editor', settings, `${seed}_txt`);
      }

      // 1D: Image Widget (.elementor-widget-image)
      if (el.classList.contains('elementor-widget-image')) {
        const imgEl = containerEl.querySelector('img');
        const src = (imgEl?.getAttribute('src') || '').trim();
        const isRemoteHttpImg =
          src.startsWith('http://') || src.startsWith('https://');
        if (!isRemoteHttpImg && imgEl) {
          return buildIconBoxWidgetFromElement(el, imgEl, seed);
        }
        const alt = (imgEl?.getAttribute('alt') || '').trim();
        const settings: Record<string, unknown> = {
          image: {
            url: src || 'https://placehold.co/600x400?text=Image',
            id: '',
            alt,
          },
          image_size: 'full',
        };
        applyWidgetIdentity(el, settings);
        injectComputedStylesIntoElementorController(
          imgEl || el,
          'image',
          settings,
          computedDimensionsMap
        );
        return registerWidget('image', settings, `${seed}_img`);
      }

      // 1E: HTML Widget (.elementor-widget-html or other explicit widget)
      const iconTarget = extractIconBoxTargetChild(
        containerEl,
        computedDimensionsMap
      );
      if (iconTarget) {
        return buildIconBoxWidgetFromElement(el, iconTarget, seed);
      }

      // If an explicit .elementor-widget-html only wraps standard semantic text/containers (without raw SVG, form, input, script, or hidden blocks),
      // unwrap it into native Elementor Container + Heading/Button widgets!
      const hasRawInteractiveOrSvgContent = Boolean(
        containerEl.querySelector(
          'svg, form, input, select, textarea, table, video, iframe, canvas, script, [hidden]'
        )
      );
      if (!hasRawInteractiveOrSvgContent && containerEl.children.length === 1) {
        const innerTarget = containerEl.children[0];
        getCleanAuthorClasses(el).forEach((cls) =>
          innerTarget.classList.add(cls)
        );
        if (el.id && !innerTarget.id) {
          innerTarget.id = el.id;
        }
        return convertElement(innerTarget, false);
      }

      const innerHtml = stripInternalMeasureAttributes(
        containerEl.innerHTML.trim()
      );
      if (!innerHtml) return null;
      if (containerEl.querySelector('svg, img.el-svg-img')) {
        counts.decorativeWidgets++;
      }
      const settings: Record<string, unknown> = {
        html: innerHtml,
      };
      applyWidgetIdentity(el, settings);
      injectComputedStylesIntoElementorController(
        el,
        'html',
        settings,
        computedDimensionsMap
      );
      return registerWidget('html', settings, `${seed}_html`);
    }

    // CASE 2: Icon Box Wrapper (`<div class="tool-icon"><svg>...</svg></div>`, `<div class="why-icon"><svg>...</svg></div>`, or standalone icon)
    const iconBoxTarget = extractIconBoxTargetChild(el, computedDimensionsMap);
    if (iconBoxTarget) {
      return buildIconBoxWidgetFromElement(el, iconBoxTarget, seed);
    }

    // CASE 2.5: FAQ / Accordion / Toggle Item (`<details><summary>`, `.gf-item`, `.faq-item`, `.accordion-item`) -> Native Elementor `accordion` Widget
    const faqAccordionParts = extractFaqAccordionItemParts(el);
    if (faqAccordionParts) {
      return buildAccordionWidgetFromElement(el, faqAccordionParts, seed);
    }

    // CASE 3: Standard HTML Headings (h1 - h6) -> ALWAYS Native Elementor Heading Widget (`widgetType: "heading"`) with ZERO HTML code in `title`
    if (/^h[1-6]$/.test(tag)) {
      // Check if the heading has multiple styled lines separated by <br> or styled child <span>s (e.g. `ابزارهای وبمستر؛ <br> <span class="accent">سریع، ساده، رایگان</span>`)
      const hasBrOrStyledChild =
        Boolean(el.querySelector('br')) ||
        Array.from(el.children).some(
          (ch) => getCleanAuthorClasses(ch).length > 0
        );

      if (hasBrOrStyledChild) {
        const segments: Array<{ text: string; childEl: Element | null }> = [];
        let currentText = '';
        const flushText = () => {
          const cleaned = currentText.replace(/\s+/g, ' ').trim();
          if (cleaned) {
            segments.push({ text: cleaned, childEl: null });
          }
          currentText = '';
        };

        Array.from(el.childNodes).forEach((cn) => {
          if (cn.nodeType === Node.TEXT_NODE) {
            currentText += cn.textContent || '';
          } else if (cn.nodeType === Node.ELEMENT_NODE) {
            const cEl = cn as Element;
            const cTag = cEl.tagName.toLowerCase();
            if (cTag === 'br') {
              flushText();
            } else if (getCleanAuthorClasses(cEl).length > 0) {
              flushText();
              const childTxt = extractPurePlainText(cEl);
              if (childTxt) {
                segments.push({ text: childTxt, childEl: cEl });
              }
            } else {
              currentText += ' ' + extractPurePlainText(cEl);
            }
          }
        });
        flushText();

        if (segments.length >= 2) {
          counts.containers++;
          const hostClasses = [
            ...getCleanAuthorClasses(el),
            `el-tag-${tag}`,
            'el-block-con',
          ];
          const hostSettings: Record<string, unknown> = {
            content_width: 'full',
            html_tag: 'div',
            css_classes: hostClasses.join(' '),
            _css_classes: hostClasses.join(' '),
          };
          if (el.id) {
            hostSettings.css_id = el.id;
            hostSettings._element_id = el.id;
          }
          const segWidgets = segments.map((seg, sIdx) => {
            const segTag = seg.childEl
              ? seg.childEl.tagName.toLowerCase()
              : tag;
            const segSettings: Record<string, unknown> = {
              title: seg.text,
              header_size: [
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'p',
                'div',
                'span',
              ].includes(segTag)
                ? segTag
                : tag,
            };
            const segClasses = seg.childEl
              ? [
                  ...getCleanAuthorClasses(seg.childEl),
                  'el-native-heading',
                ]
              : [...getCleanAuthorClasses(el), 'el-native-heading'];
            applyWidgetIdentity(seg.childEl || el, segSettings, segClasses);
            injectComputedStylesIntoElementorController(
              seg.childEl || el,
              'heading',
              segSettings,
              computedDimensionsMap
            );
            return registerWidget('heading', segSettings, `${seed}_hseg_${sIdx}`);
          });

          return {
            id: idRegistry.generateId(`hcon_${seed}`),
            elType: 'container',
            settings: hostSettings,
            elements: segWidgets,
            isInner: true,
          };
        }
      }

      const settings: Record<string, unknown> = {
        title: extractPurePlainText(el),
        header_size: tag,
      };
      if (
        el.children.length === 1 &&
        el.children[0].tagName.toLowerCase() === 'a'
      ) {
        const aChild = el.children[0];
        const href = (aChild.getAttribute('href') || '').trim();
        if (href) {
          settings.link = {
            url: href,
            is_external:
              aChild.getAttribute('target') === '_blank' ? 'on' : '',
            nofollow: (aChild.getAttribute('rel') || '').includes('nofollow')
              ? 'on'
              : '',
          };
          settings.title = extractPurePlainText(aChild);
        }
      }
      const childSpanClasses =
        el.children.length === 1
          ? getCleanAuthorClasses(el.children[0])
          : [];
      applyWidgetIdentity(el, settings, [
        ...childSpanClasses,
        'el-native-heading',
      ]);
      injectComputedStylesIntoElementorController(
        el,
        'heading',
        settings,
        computedDimensionsMap
      );
      return registerWidget('heading', settings, `${seed}_h`);
    }

    // CASE 4: Standard HTML Paragraph or Blockquote (p, blockquote) -> Native Elementor `text-editor` Widget
    if (tag === 'p' || tag === 'blockquote') {
      const editorContent =
        el.children.length > 0
          ? stripInternalMeasureAttributes(el.innerHTML.trim())
          : extractPurePlainText(el);
      const settings: Record<string, unknown> = {
        editor: editorContent,
      };
      applyWidgetIdentity(el, settings, ['el-native-text']);
      injectComputedStylesIntoElementorController(
        el,
        'text-editor',
        settings,
        computedDimensionsMap
      );
      return registerWidget('text-editor', settings, `${seed}_p`);
    }

    // CASE 5: Standard HTML Image (img, picture)
    if (tag === 'img' || tag === 'picture') {
      const rawSrc = (el.getAttribute('src') || '').trim();
      const isRemoteHttpUrl =
        rawSrc.startsWith('http://') || rawSrc.startsWith('https://');

      if (tag === 'picture' || !isRemoteHttpUrl) {
        const settings: Record<string, unknown> = {
          html: stripInternalMeasureAttributes(el.outerHTML),
          _css_classes: 'el-native-html',
          css_classes: 'el-native-html',
        };
        injectComputedStylesIntoElementorController(
          el,
          'html',
          settings,
          computedDimensionsMap
        );
        return registerWidget('html', settings, `${seed}_pichtml`);
      }

      const alt = (
        el.getAttribute('alt') ||
        el.getAttribute('data-alt') ||
        ''
      ).trim();
      const settings: Record<string, unknown> = {
        image: {
          url: rawSrc,
          id: '',
          alt,
        },
        image_size: 'full',
      };
      applyWidgetIdentity(el, settings, ['el-native-img']);
      injectComputedStylesIntoElementorController(
        el,
        'image',
        settings,
        computedDimensionsMap
      );
      return registerWidget('image', settings, `${seed}_img`);
    }

    // CASE 6: Horizontal Rule (hr) -> divider
    if (tag === 'hr') {
      const settings: Record<string, unknown> = {
        style: 'solid',
      };
      applyWidgetIdentity(el, settings);
      injectComputedStylesIntoElementorController(
        el,
        'divider',
        settings,
        computedDimensionsMap
      );
      return registerWidget('divider', settings, `${seed}_hr`);
    }

    // CASE 7: Buttons and Anchor Links (a, button) -> ALWAYS Native Elementor `button` Widget with exact HTML styles!
    if (tag === 'a' || tag === 'button') {
      const hasBlockCardChildren = Boolean(
        el.querySelector('h1, h2, h3, h4, h5, h6, article, section, p, ul, ol') ||
          el.querySelector('img:not(.el-svg-img)') ||
          (tag === 'a' &&
            (el.classList.contains('brand') ||
              Boolean(
                el.querySelector(
                  '.brand-mark, .brand-txt, strong + small, small + strong'
                )
              )))
      );

      if (!hasBlockCardChildren) {
        const href = (el.getAttribute('href') || '#').trim();
        const isExternal = el.getAttribute('target') === '_blank';
        const nofollow = (el.getAttribute('rel') || '').includes('nofollow');
        const btnText = extractCleanButtonText(el);
        const { selectedIcon, rawIconSvg, iconPosition, svgAssetId } =
          extractFaIconFromButtonOrElement(el, svgAssetById);

        const settings: Record<string, unknown> = {
          text: btnText,
          link: {
            url: href,
            is_external: isExternal ? 'on' : '',
            nofollow: nofollow ? 'on' : '',
          },
          size: 'sm',
        };
        if (selectedIcon) {
          settings.selected_icon = selectedIcon;
          settings.icon_align = iconPosition === 'after' ? 'left' : 'right';
        }
        if (rawIconSvg) {
          settings._raw_icon_svg = rawIconSvg;
        }
        if (iconPosition) {
          settings._icon_position = iconPosition;
        }
        const tagRoleClass = tag === 'button' ? 'el-tag-button' : 'el-tag-a';
        const btnExtraClasses = svgAssetId
          ? ['el-native-btn', tagRoleClass, `el-svg-icon-${svgAssetId}`]
          : ['el-native-btn', tagRoleClass];
        applyWidgetIdentity(el, settings, btnExtraClasses);
        injectComputedStylesIntoElementorController(
          el,
          'button',
          settings,
          computedDimensionsMap
        );
        return registerWidget('button', settings, `${seed}_btn`);
      }
    }

    // CASE 8: Simple Text Lists (ul, ol without nested cards/headings/images) -> text-editor
    if (tag === 'ul' || tag === 'ol') {
      const hasCardChildren = Boolean(
        el.querySelector(
          'h1, h2, h3, h4, h5, h6, article, section, img, form, svg, a, button'
        )
      );
      if (!hasCardChildren) {
        const settings: Record<string, unknown> = {
          editor: stripInternalMeasureAttributes(el.outerHTML),
        };
        applyWidgetIdentity(el, settings, ['el-native-list']);
        injectComputedStylesIntoElementorController(
          el,
          'text-editor',
          settings,
          computedDimensionsMap
        );
        return registerWidget('text-editor', settings, `${seed}_list`);
      }
    }

    // CASE 8.5: Form <label> wrapping an <input> / <select> (e.g. `<label class="check"><input type="checkbox" checked><span>...</span></label>`)
    if (tag === 'label' && el.querySelector('input, select, textarea')) {
      const settings: Record<string, unknown> = {
        html: stripInternalMeasureAttributes(el.outerHTML),
        _css_classes: 'el-native-html',
        css_classes: 'el-native-html',
      };
      injectComputedStylesIntoElementorController(
        el,
        'html',
        settings,
        computedDimensionsMap
      );
      return registerWidget('html', settings, `${seed}_labelinput`);
    }

    // CASE 9: Inline/Leaf Text Elements (span, small, strong, em, label, time, code)
    if (
      ['span', 'small', 'strong', 'em', 'label', 'time', 'code'].includes(tag)
    ) {
      // If this inline element has child elements (e.g. `<span class="badge"><img class="el-svg-img"><span>ابزارها</span></span>`),
      // let it fall through to CASE 12 so it becomes a Container holding its `icon-box` + `heading` children!
      const hasNestedWidgetChildren = Boolean(
        el.querySelector(
          'svg, img.el-svg-img, img[data-local-svg-asset], i, button, a, input, select, textarea'
        ) || el.children.length > 1
      );

      if (!hasNestedWidgetChildren) {
        const textVal = extractPurePlainText(el);
        if (!textVal) {
          counts.decorativeWidgets++;
          const settings: Record<string, unknown> = {
            html: stripInternalMeasureAttributes(el.outerHTML),
            _css_classes: 'el-native-html',
            css_classes: 'el-native-html',
          };
          injectComputedStylesIntoElementorController(
            el,
            'html',
            settings,
            computedDimensionsMap
          );
          return registerWidget('html', settings, `${seed}_spanhtml`);
        }

        const settings: Record<string, unknown> = {
          title: textVal,
          header_size: 'span',
        };
        const singleChildClasses =
          el.children.length === 1 &&
          (el.children[0].textContent || '').replace(/\s+/g, ' ').trim() ===
            textVal
            ? getCleanAuthorClasses(el.children[0])
            : [];
        applyWidgetIdentity(el, settings, [
          ...singleChildClasses,
          'el-native-heading',
          'el-native-inline',
        ]);
        injectComputedStylesIntoElementorController(
          el,
          'heading',
          settings,
          computedDimensionsMap
        );
        return registerWidget('heading', settings, `${seed}_span`);
      }
    }

    // CASE 10: Interactive / Media / Animated Background SVG / Workflow Stage / Form / Table Elements
    if (
      el.classList.contains('wf-stage') ||
      [
        'svg',
        'form',
        'table',
        'video',
        'iframe',
        'canvas',
        'input',
        'select',
        'textarea',
        'output',
        'pre',
      ].includes(tag)
    ) {
      if (tag === 'svg' || el.querySelector('svg, img.el-svg-img')) {
        counts.decorativeWidgets++;
      }
      const settings: Record<string, unknown> = {
        html: stripInternalMeasureAttributes(el.outerHTML),
        _css_classes: 'el-native-html',
        css_classes: 'el-native-html',
      };
      injectComputedStylesIntoElementorController(
        el,
        'html',
        settings,
        computedDimensionsMap
      );
      return registerWidget('html', settings, `${seed}_media`);
    }

    // CASE 10.5: Generic <div> or <span> whose children are exclusively unstyled inline formatting tags (`b`, `strong`, `em`, `br`, `code`, `mark`, `small`)
    // e.g. `<div class="mock-out">hamisys.ir/<b>s/8fK2q</b><br>Xk7#mQ2$vL9pR4tZ</div>` -> Native Elementor `text-editor` Widget
    if (
      (tag === 'div' || tag === 'span') &&
      el.children.length > 0 &&
      (el.textContent || '').trim().length > 0 &&
      Array.from(el.children).every(
        (ch) =>
          [
            'b',
            'strong',
            'em',
            'br',
            'code',
            'mark',
            'small',
            'sub',
            'sup',
          ].includes(ch.tagName.toLowerCase()) && ch.classList.length === 0
      )
    ) {
      const settings: Record<string, unknown> = {
        editor: stripInternalMeasureAttributes(el.innerHTML.trim()),
      };
      applyWidgetIdentity(el, settings, ['el-native-text']);
      injectComputedStylesIntoElementorController(
        el,
        'text-editor',
        settings,
        computedDimensionsMap
      );
      return registerWidget('text-editor', settings, `${seed}_inlinetxt`);
    }

    // CASE 11: Generic <div> with 0 element children
    if (el.children.length === 0) {
      const txt = extractPurePlainText(el);
      if (txt) {
        const settings: Record<string, unknown> = {
          title: txt,
          header_size: 'div',
        };
        applyWidgetIdentity(el, settings, ['el-native-heading']);
        injectComputedStylesIntoElementorController(
          el,
          'heading',
          settings,
          computedDimensionsMap
        );
        return registerWidget('heading', settings, `${seed}_divtxt`);
      }
      // Empty decorative div (e.g. animated gradient overlay, blur orb, aurora, particles, dashed connector line)
      counts.decorativeWidgets++;
      const settings: Record<string, unknown> = {
        html: stripInternalMeasureAttributes(el.outerHTML),
        _css_classes: 'el-native-html',
        css_classes: 'el-native-html',
      };
      injectComputedStylesIntoElementorController(
        el,
        'html',
        settings,
        computedDimensionsMap
      );
      return registerWidget('html', settings, `${seed}_decor`);
    }

    // Purely decorative / animated background container (e.g. .hero-bg, .cta-bg, .blobs, .particles holding multiple decorative layers/SVGs
    // with zero text content and no semantic/interactive children): keep the entire background subtree intact!
    const hasAnyVisibleText = (el.textContent || '').trim().length > 0;
    const hasSemanticOrInteractiveContent = Boolean(
      el.querySelector(
        'h1, h2, h3, h4, h5, h6, p, a, button, input, select, textarea, form, table, ul, ol, article, section, header, footer, nav, main, aside, img:not(.el-svg-img)'
      )
    );
    if (
      !isRootContainer &&
      !hasAnyVisibleText &&
      !hasSemanticOrInteractiveContent
    ) {
      counts.decorativeWidgets++;
      const settings: Record<string, unknown> = {
        html: stripInternalMeasureAttributes(el.outerHTML),
        _css_classes: 'el-native-html',
        css_classes: 'el-native-html',
      };
      injectComputedStylesIntoElementorController(
        el,
        'html',
        settings,
        computedDimensionsMap
      );
      return registerWidget('html', settings, `${seed}_bgdecor`);
    }

    // CASE 12: Structural Container (`div`, `span`, `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `a`, `label`)
    counts.containers++;
    if (!isRootContainer && ['section', 'header', 'footer'].includes(tag)) {
      counts.sections++;
    }

    const htmlTag = ALLOWED_CONTAINER_HTML_TAGS.has(tag) ? tag : 'div';
    const cleanClasses = getCleanAuthorClasses(el);
    if (
      ['ul', 'ol', 'li', 'a'].includes(tag) &&
      !cleanClasses.includes(`el-tag-${tag}`)
    ) {
      cleanClasses.push(`el-tag-${tag}`);
    }
    const mIdForCon = (el.getAttribute('data-el-measure-id') || '').trim();
    const elSnapForCon = mIdForCon
      ? computedDimensionsMap?.get(mIdForCon)
      : undefined;
    const computedDisplay = (elSnapForCon?.desktop.display || '').toLowerCase();
    const isComputedFlexOrGrid =
      computedDisplay.includes('flex') || computedDisplay.includes('grid');

    const hadOriginalEconOrFlexGrid =
      isComputedFlexOrGrid ||
      el.classList.contains('e-con') ||
      el.classList.contains('flex') ||
      el.classList.contains('inline-flex') ||
      el.classList.contains('grid') ||
      el.classList.contains('inline-grid');
    if (!hadOriginalEconOrFlexGrid && !cleanClasses.includes('el-block-con')) {
      cleanClasses.push('el-block-con');
    }
    if (isRootContainer && !cleanClasses.includes(baseScopeClass)) {
      cleanClasses.push(baseScopeClass);
    }

    const containerSettings: Record<string, unknown> = {
      content_width: 'full',
      html_tag: htmlTag,
    };

    if (cleanClasses.length > 0) {
      const joined = cleanClasses.join(' ');
      containerSettings.css_classes = joined;
      containerSettings._css_classes = joined;
    }

    const idVal = (el.getAttribute('id') || '').trim();
    if (idVal) {
      containerSettings.css_id = idVal;
      containerSettings._element_id = idVal;
    }

    const customConAttrs = extractCustomDomAttributes(el);
    if (Object.keys(customConAttrs).length > 0) {
      containerSettings._custom_attrs = customConAttrs;
    }

    if (tag === 'a') {
      const href = (el.getAttribute('href') || '#').trim();
      containerSettings.link = {
        url: href,
        is_external: el.getAttribute('target') === '_blank' ? 'on' : '',
        nofollow: (el.getAttribute('rel') || '').includes('nofollow')
          ? 'on'
          : '',
      };
    }

    injectComputedStylesIntoElementorController(
      el,
      'container',
      containerSettings,
      computedDimensionsMap
    );

    const childNodes: ElementorNode[] = [];
    for (const childEl of Array.from(el.children)) {
      const converted = convertElement(childEl, false);
      if (converted) {
        childNodes.push(converted);
      }
    }

    if (childNodes.length === 0) {
      const fallbackText = extractPurePlainText(el);
      if (!fallbackText) return null;
      return registerWidget(
        'heading',
        {
          title: fallbackText,
          header_size: 'div',
          _css_classes: [...cleanClasses, 'el-native-heading'].join(' '),
          css_classes: [...cleanClasses, 'el-native-heading'].join(' '),
        },
        `${seed}_fallback`
      );
    }

    const conNodeId = idRegistry.generateId(`con_${seed}`);
    if (
      containerSettings._custom_attrs &&
      typeof containerSettings._custom_attrs === 'object' &&
      Object.keys(containerSettings._custom_attrs as Record<string, unknown>)
        .length > 0
    ) {
      const existingCls = String(
        containerSettings.css_classes || containerSettings._css_classes || ''
      ).trim();
      const attrMarker = `el-attr-${conNodeId}`;
      const nextCls = existingCls ? `${existingCls} ${attrMarker}` : attrMarker;
      containerSettings.css_classes = nextCls;
      containerSettings._css_classes = nextCls;
    }

    return {
      id: conNodeId,
      elType: 'container',
      settings: containerSettings,
      elements: childNodes,
      isInner: !isRootContainer,
    };
  };

  const bodyChildren = Array.from(doc.body.children);
  const contentElements: ElementorNode[] = [];

  if (
    bodyChildren.length === 1 &&
    bodyChildren[0].tagName.toLowerCase() === 'div'
  ) {
    // Single root wrapper div (e.g. <div class="e-con e-con-full gf-page">):
    // Combine body classes onto the root container so there is exactly one root page container in the DOM
    const bodyClasses = getCleanAuthorClasses(doc.body).filter(
      (c) => c !== 'elementor-page'
    );
    bodyClasses.forEach((bc) => bodyChildren[0].classList.add(bc));
    const rootCon = convertElement(bodyChildren[0], true);
    if (rootCon) {
      contentElements.push(rootCon);
    }
  } else {
    // Multiple top-level body children (e.g. <header>, <main>, <footer>):
    // Wrap in a single root Flexbox Container carrying body classes + baseScopeClass so all scoped CSS & body styles work 1:1 in WordPress
    counts.containers++;
    const bodyClasses = getCleanAuthorClasses(doc.body).filter(
      (c) => c !== 'elementor-page'
    );
    const rootClasses = [baseScopeClass, 'el-block-con', ...bodyClasses].filter(
      (v, i, arr) => Boolean(v) && arr.indexOf(v) === i
    );
    const rootChildren: ElementorNode[] = [];
    for (const childEl of bodyChildren) {
      const converted = convertElement(childEl, false);
      if (converted) {
        rootChildren.push(converted);
      }
    }
    contentElements.push({
      id: idRegistry.generateId('root_page_con'),
      elType: 'container',
      settings: {
        _title: settings.templateTitle || 'Root Page Container',
        content_width: 'full',
        html_tag: 'div',
        css_classes: rootClasses.join(' '),
        _css_classes: rootClasses.join(' '),
      },
      elements: rootChildren,
      isInner: false,
    });
  }

  if (counts.sections === 0) {
    counts.sections = Math.max(1, counts.containers);
  }

  const pageSettingsObj: Record<string, unknown> = {
    hide_title: 'yes',
    template: 'elementor_canvas',
    background_background: 'classic',
    background_color: bodyBackgroundColor || '#FFFFFF',
    css_classes: baseScopeClass,
  };
  if (cleanCustomFont) {
    pageSettingsObj.default_generic_fonts = cleanCustomFont;
    pageSettingsObj.custom_font_family = cleanCustomFont;
  }

  const templateJson: ElementorTemplateJSON = {
    title: settings.templateTitle.trim() || 'قالب تبدیل‌شده به Elementor',
    type: settings.templateType,
    version: '0.4',
    page_settings: pageSettingsObj,
    content: contentElements,
  };

  return {
    templateJson,
    counts,
    widgetBreakdown,
    replacedWidgets: [],
    placeholders: initialPlaceholders,
    manualAdjustments: [],
    reconstructedWrappers: [],
    extractedSvgs,
  };
}



