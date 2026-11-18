// ===== TYPES & INTERFACES =====

export type ElementorVersionTarget = 'unknown' | '3.23.1' | '3.24+';
export type ElementorTemplateType = 'page' | 'section';
export type ElementorAddonType =
  | 'essential-addons'
  | 'happy-addons'
  | 'royal-addons'
  | 'elements-kit';

export type MobilePatternId =
  | 'header-navigation'
  | 'hero-showcase'
  | 'split-story-section'
  | 'promo-banner-card'
  | 'product-grid-card'
  | 'category-tile-grid'
  | 'collection-editorial-grid'
  | 'trust-feature-bar'
  | 'faq-accordion'
  | 'site-footer';

export interface PatternStrategyOption {
  value: string;
  label: string;
}

export interface DetectedPatternItem {
  id: MobilePatternId;
  title: string;
  englishBadge: string;
  detected: boolean;
  instanceCount: number;
  matchedSelectors: string[];
  whereUsed: string[];
  elementorMapping: string;
  activeStrategy: string;
  strategyOptions: PatternStrategyOption[];
  mobileBehaviorSummary: string;
}

export interface ConverterSettings {
  elementorVersion: ElementorVersionTarget;
  enableFlexboxContainer: boolean;
  hasElementorPro: boolean;
  allowedAddons: ElementorAddonType[];
  templateTitle: string;
  templateType: ElementorTemplateType;
  includeHeaderFooter: boolean;
  scopePrefix: string;
  embedAssetsInPageJson?: boolean;
  exactHtmlMatch?: boolean;
  customFontFamily?: string;
  optimizeMobileLayout?: boolean;
  mobilePatternStrategies?: Partial<Record<MobilePatternId, string>>;
}

export interface ElementorDimension {
  unit: 'px' | 'em' | 'rem' | '%' | 'vw' | 'vh';
  top: string;
  right: string;
  bottom: string;
  left: string;
  isLinked: boolean;
}

export interface ElementorSizeUnit {
  unit: 'px' | 'em' | 'rem' | '%' | 'vw' | 'vh';
  size: number | string;
  sizes?: never[];
}

export interface ElementorMedia {
  url: string;
  id: number | string;
  alt?: string;
  source?: string;
}

export interface ElementorLink {
  url: string;
  is_external: boolean | string;
  nofollow: boolean | string;
  custom_attributes?: string;
}

export interface ElementorBoxShadow {
  horizontal: number;
  vertical: number;
  blur: number;
  spread: number;
  color: string;
}

export interface ElementorIcon {
  value: string;
  library: 'fa-solid' | 'fa-regular' | 'fa-brands' | 'svg';
}

export type NativeFreeWidgetType =
  | 'heading'
  | 'text-editor'
  | 'image'
  | 'button'
  | 'icon'
  | 'icon-box'
  | 'image-box'
  | 'icon-list'
  | 'divider'
  | 'spacer'
  | 'video'
  | 'google_maps'
  | 'image-gallery'
  | 'image-carousel'
  | 'counter'
  | 'progress'
  | 'star-rating'
  | 'testimonial'
  | 'tabs'
  | 'nested-tabs'
  | 'accordion'
  | 'nested-accordion'
  | 'toggle'
  | 'social-icons'
  | 'alert'
  | 'audio'
  | 'html'
  | 'shortcode'
  | 'menu-anchor'
  | 'text-path'
  | 'read-more'
  | 'sidebar';

export type ProWidgetType =
  | 'form'
  | 'login'
  | 'nav-menu'
  | 'mega-menu'
  | 'slides'
  | 'nested-carousel'
  | 'media-carousel'
  | 'testimonial-carousel'
  | 'reviews'
  | 'price-table'
  | 'price-list'
  | 'flip-box'
  | 'call-to-action'
  | 'animated-headline'
  | 'countdown'
  | 'blockquote'
  | 'share-buttons'
  | 'table-of-contents'
  | 'hotspot'
  | 'lottie'
  | 'code-highlight'
  | 'video-playlist'
  | 'progress-tracker'
  | 'gallery'
  | 'portfolio'
  | 'posts'
  | 'loop-grid'
  | 'loop-carousel'
  | 'off-canvas'
  | 'search'
  | 'search-form'
  | 'paypal-button'
  | 'stripe-button'
  | 'template'
  | 'sitemap'
  | 'author-box'
  | 'post-comments'
  | 'post-navigation'
  | 'post-info'
  | 'theme-site-logo'
  | 'theme-site-title'
  | 'theme-page-title'
  | 'theme-post-title'
  | 'theme-post-content'
  | 'theme-post-featured-image'
  | 'breadcrumbs'
  | 'archive-posts'
  | `facebook-${string}`
  | `wc-${string}`
  | `woocommerce-${string}`;

export type ElementorWidgetType = NativeFreeWidgetType | ProWidgetType;

export interface ElementorNode {
  id: string;
  elType: 'section' | 'column' | 'widget' | 'container';
  widgetType?: string;
  settings: Record<string, unknown>;
  elements: ElementorNode[];
  isInner?: boolean;
}

export interface ElementorTemplateJSON {
  title: string;
  type: ElementorTemplateType;
  version: '0.4';
  page_settings: Record<string, unknown>;
  content: ElementorNode[];
}

export interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComputedBoxStyle {
  display: string;
  position: string;
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: string;
  lineHeightPx: number;
  letterSpacingPx: number;
  textAlign: 'left' | 'center' | 'right' | 'justify' | '';
  padding: BoxEdges;
  margin: BoxEdges;
  borderWidth: BoxEdges;
  borderStyle: string;
  borderColor: string;
  borderRadius: BoxEdges;
  boxShadow: ElementorBoxShadow | null;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  flexWrap?: string;
  gapPx: number;
  columnGapPx?: number;
  rowGapPx?: number;
  gridTemplateColumns: string;
  widthPx: number;
  heightPx: number;
  minHeightPx: number;
  maxWidthPx: number;
}

export interface ResponsiveStyleOverrides {
  fontSizePx?: number;
  lineHeightPx?: number;
  padding?: BoxEdges;
  margin?: BoxEdges;
  textAlign?: 'left' | 'center' | 'right' | 'justify' | '';
  flexDirection?: string;
  gapPx?: number;
  widthPercent?: number;
}

export interface ParsedDOMNode {
  uid: string;
  tag: string;
  idAttr: string;
  classList: string[];
  textContent: string;
  directText: string;
  innerHTMLClean: string;
  attributes: Record<string, string>;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles: ComputedBoxStyle;
  tabletOverrides: ResponsiveStyleOverrides;
  mobileOverrides: ResponsiveStyleOverrides;
  children: ParsedDOMNode[];
  isDecorative?: boolean;
}

export interface ValidationIssue {
  id: string;
  severity: 'success' | 'warning' | 'error';
  ruleNumber: number;
  title: string;
  message: string;
  details?: string;
}

export interface ReplacedWidgetEntry {
  originalElement: string;
  mappedTo: string;
  reason: string;
}

export interface PlaceholderEntry {
  type: 'image' | 'link' | 'text' | 'pro-fallback' | 'svg';
  element: string;
  placeholderValue: string;
  description: string;
}

export interface ExcludedSectionEntry {
  tag: string;
  identifier: string;
  reason: string;
}

export interface WrapperReconstructionSpec {
  wrapperId: string;
  tag: string;
  id?: string;
  className: string;
  childIds: string[];
}

export interface ExtractedSvgAsset {
  id: string;
  fileName: string;
  relativePath: string;
  svgContent: string;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  viewBox: string;
  contextLabel: string;
}

export interface ComputedElementDimensionsSnapshot {
  measureId: string;
  tag: string;
  desktop: ComputedBoxStyle;
  tablet: ResponsiveStyleOverrides & { widthPx: number; heightPx: number };
  mobile: ResponsiveStyleOverrides & { widthPx: number; heightPx: number };
  hasExplicitWidth: boolean;
  hasExplicitHeight: boolean;
  resolvedSvgString?: string;
}

export interface HybridBreakdownReport {
  nativeItems: string[];
  extraCssItems: string[];
  extraJsItems: string[];
  manualActionItems: string[];
  fontFaceFiles: string[];
}

export interface ConversionReport {
  counts: {
    sections: number;
    innerSections: number;
    columns: number;
    containers: number;
    widgets: number;
    decorativeWidgets: number;
    extractedCssRules: number;
    extractedJsBlocks: number;
    extractedSvgFiles?: number;
  };
  widgetBreakdown: Record<string, number>;
  fontsDetected: string[];
  excludedSections: ExcludedSectionEntry[];
  replacedWidgets: ReplacedWidgetEntry[];
  placeholders: PlaceholderEntry[];
  manualAdjustments: string[];
  hybridBreakdown: HybridBreakdownReport;
  detectedPatterns?: DetectedPatternItem[];
  validationIssues: ValidationIssue[];
  canDownload: boolean;
  pipelineTimingsMs: {
    parseAndStyles: number;
    layoutAndMapping: number;
    buildAndValidate: number;
    total: number;
  };
}

export interface ConversionResult {
  json: ElementorTemplateJSON;
  jsonString: string;
  extraCss: string;
  extraJs: string;
  extractedSvgs: ExtractedSvgAsset[];
  report: ConversionReport;
  sanitizedPreviewHtml: string;
  sourceFileName: string;
}
