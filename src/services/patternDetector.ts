// ===== IMPORTS & DEPENDENCIES =====
import {
  ConverterSettings,
  DetectedPatternItem,
  MobilePatternId,
} from '../types/elementor';

// ===== TYPES & INTERFACES =====
export interface PatternDetectionOutput {
  detectedPatterns: DetectedPatternItem[];
  mobileCssRules: string[];
}

// ===== UTILITY FUNCTIONS =====

const TAILWIND_UTILITY_PATTERNS: RegExp[] = [
  /^(sm|md|lg|xl|2xl|hover|focus|focus-within|active|group-hover|selection|placeholder):/i,
  /[\[\]/%]/,
  /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table|flow-root)$/i,
  /^(static|fixed|absolute|relative|sticky)$/i,
  /^(group|peer|container|prose|transform|filter|antialiased|subpixel-antialiased|italic|not-italic|uppercase|lowercase|capitalize|normal-case|underline|overline|line-through|no-underline|truncate|sr-only|not-sr-only|pointer-events-none|pointer-events-auto|select-none|select-text|select-all|no-scrollbar)$/i,
  /^-?(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|space-x|space-y|gap|gap-x|gap-y|inset|inset-x|inset-y|top|right|bottom|left|z|order|col-span|row-span|grid-cols|grid-rows|w|h|min-w|max-w|min-h|max-h|size|basis|grow|shrink|flex|aspect|leading|tracking|indent| line-clamp|rotate|scale|translate-x|translate-y|skew-x|skew-y|duration|delay|opacity|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|backdrop-blur|ring|ring-offset|outline|decoration|underline-offset)(-|$)/i,
  /^(bg|from|via|to|text|font|border|rounded|shadow|items|justify|content|self|place|overflow|object|cursor|transition|animate|whitespace|break|list|appearance|resize|scroll|snap|touch|will-change|fill|stroke)(-|$)/i,
  /^(washi-tape-|bg-grid-dots|graph-paper)/i,
];

function isTailwindUtilityClass(cls: string): boolean {
  return TAILWIND_UTILITY_PATTERNS.some((re) => re.test(cls));
}

function getPrimaryAuthorClasses(el: Element): string[] {
  return Array.from(el.classList).filter(
    (c) =>
      Boolean(c) &&
      !c.startsWith('elementor-') &&
      !c.startsWith('e-') &&
      !c.startsWith('el-') &&
      !isTailwindUtilityClass(c)
  );
}

function describeElementLocation(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const idStr = el.id ? `#${el.id}` : '';
  const dataPurpose = el.getAttribute('data-purpose');
  const purposeStr = dataPurpose ? `[data-purpose="${dataPurpose}"]` : '';
  const cls = getPrimaryAuthorClasses(el)[0];
  const clsStr = purposeStr || (cls ? `.${cls}` : '');
  const headingText = el
    .querySelector('h1, h2, h3, h4, .section-title, .story-title, .promo-title')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 34);
  return headingText
    ? `${tag}${idStr}${clsStr} («${headingText}»)`
    : `${tag}${idStr}${clsStr}`;
}

function isSplitStoryOrShowcaseBox(el: Element): boolean {
  const classes = getPrimaryAuthorClasses(el);
  const classStr = classes.join(' ').toLowerCase();

  // Explicit story / about / split showcase naming on the 2-column box itself
  if (
    /\b(story-box|story-grid|story-inner|about-box|about-grid|brand-story|feature-split|cta-split|split-box|showcase-box|intro-grid)\b/i.test(
      classStr
    )
  ) {
    return true;
  }

  if (
    el.children.length === 2 &&
    Boolean(
      el.closest(
        '.story-section, #brand-story, .about-section, [id*="story"], [class*="story-section"], [data-purpose="brand-story"]'
      )
    )
  ) {
    return true;
  }

  // Never classify an item inside a multi-card promo/product/category grid as a split story box
  const parent = el.parentElement;
  if (parent) {
    const parentCls = getPrimaryAuthorClasses(parent).join(' ').toLowerCase();
    const siblingSameTagCount = Array.from(parent.children).filter(
      (ch) => ch.tagName === el.tagName
    ).length;
    if (
      siblingSameTagCount >= 2 &&
      /\b(promo-grid|banners-grid|cards-grid|wc-products-grid|category-grid|collections-grid|blog-grid|trust-bar)\b/i.test(
        parentCls
      )
    ) {
      return false;
    }
  }

  if (el.children.length !== 2) return false;
  const c0 = el.children[0];
  const c1 = el.children[1];

  const c0TextLen = (c0.textContent || '').replace(/\s+/g, ' ').trim().length;
  const c1TextLen = (c1.textContent || '').replace(/\s+/g, ' ').trim().length;

  const c0HasNarrative =
    Boolean(c0.querySelector('h1, h2, h3')) &&
    (c0TextLen > 140 ||
      c0.querySelectorAll('p, blockquote, .story-quote').length >= 2);
  const c1OnlyVisual =
    c1TextLen < 20 && Boolean(c1.querySelector('svg, img, picture, figure'));

  const c1HasNarrative =
    Boolean(c1.querySelector('h1, h2, h3')) &&
    (c1TextLen > 140 ||
      c1.querySelectorAll('p, blockquote, .story-quote').length >= 2);
  const c0OnlyVisual =
    c0TextLen < 20 && Boolean(c0.querySelector('svg, img, picture, figure'));

  return (c0HasNarrative && c1OnlyVisual) || (c1HasNarrative && c0OnlyVisual);
}

function isHorizontalPromoBannerCard(el: Element): boolean {
  if (isSplitStoryOrShowcaseBox(el)) return false;

  const classes = getPrimaryAuthorClasses(el);
  const classStr = classes.join(' ').toLowerCase();
  if (/\b(promo-card|banner-card|callout-card|offer-card)\b/i.test(classStr)) {
    return true;
  }

  if (
    el.parentElement &&
    el.closest('[data-purpose="promo-banners"]') &&
    el.parentElement.parentElement?.getAttribute('data-purpose') ===
      'promo-banners'
  ) {
    return true;
  }

  // Avoid matching trust items, product cards, or headers
  if (
    /\b(trust-item|wc-product-card|product-card|category-tile|collection-card|blog-card|header-main|footer-bottom)\b/i.test(
      classStr
    )
  ) {
    return false;
  }

  if (el.children.length !== 2) return false;
  const parent = el.parentElement;
  const siblingCardsCount = parent
    ? Array.from(parent.children).filter((ch) => ch.children.length === 2).length
    : 0;
  if (siblingCardsCount < 2) return false;

  const c0 = el.children[0];
  const c1 = el.children[1];
  const c0TextLen = (c0.textContent || '').replace(/\s+/g, ' ').trim().length;
  const c0HasShortCallout =
    c0TextLen > 10 &&
    c0TextLen <= 160 &&
    Boolean(c0.querySelector('h2, h3, h4')) &&
    c0.querySelectorAll('p').length <= 1;
  const c1OnlyArt =
    !c1.querySelector('h1, h2, h3, h4, p') &&
    Boolean(c1.querySelector('svg, img'));

  return c0HasShortCallout && c1OnlyArt;
}

// ===== CORE BUSINESS LOGIC =====

/**
 * Analyzes any HTML document to detect structural & semantic UI patterns,
 * reports where each pattern is used and how it maps to Native Elementor Widgets,
 * and generates targeted `@media (max-width: 768px)` CSS rules according to per-pattern strategy settings.
 */
export function detectTemplatePatternsAndGenerateMobileCss(
  rawHtml: string,
  scopeClass: string,
  settings: ConverterSettings
): PatternDetectionOutput {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml || '<!DOCTYPE html><html><body></body></html>', 'text/html');
  const sp = `.${scopeClass}.${scopeClass}.${scopeClass}`;
  const strategies = settings.mobilePatternStrategies || {};
  const globalMobileEnabled = settings.optimizeMobileLayout !== false;

  const getStrategy = (id: MobilePatternId, defaultVal: string): string => {
    if (!globalMobileEnabled) return 'disabled';
    return strategies[id] || defaultVal;
  };

  // -------------------------------------------------------------------------
  // 1. HEADER, LOGO & ANNOUNCEMENT BAR (header-navigation)
  // -------------------------------------------------------------------------
  const headerSelectors = new Set<string>();
  const headerWhere: string[] = [];
  let headerCount = 0;

  doc
    .querySelectorAll(
      'header, .site-header, .top-bar, .header-main, .brand-logo, .site-logo, [data-purpose="main-header"]'
    )
    .forEach((el) => {
      headerCount++;
      getPrimaryAuthorClasses(el).forEach((c) => headerSelectors.add(`.${c}`));
      if (el.getAttribute('data-purpose')) {
        headerSelectors.add(`[data-purpose="${el.getAttribute('data-purpose')}"]`);
      }
      if (
        el.tagName.toLowerCase() === 'header' ||
        el.classList.contains('top-bar') ||
        el.classList.contains('site-header')
      ) {
        headerWhere.push(describeElementLocation(el));
      }
    });

  const headerStrategy = getStrategy('header-navigation', 'compact-row');

  // -------------------------------------------------------------------------
  // 2. HERO SHOWCASE SECTION (hero-showcase)
  // -------------------------------------------------------------------------
  const heroSelectors = new Set<string>();
  const heroWhere: string[] = [];
  let heroCount = 0;

  doc
    .querySelectorAll(
      '.hero-section, .hero, section[class*="hero"], [data-purpose*="hero"], .hero-inner, .hero-content, .hero-illustration-stage'
    )
    .forEach((el) => {
      getPrimaryAuthorClasses(el).forEach((c) => heroSelectors.add(`.${c}`));
      if (el.getAttribute('data-purpose')) {
        heroSelectors.add(`[data-purpose="${el.getAttribute('data-purpose')}"]`);
      }
      if (
        el.tagName.toLowerCase() === 'section' ||
        el.classList.contains('hero-section') ||
        el.classList.contains('hero')
      ) {
        heroCount++;
        heroWhere.push(describeElementLocation(el));
      }
    });

  const heroStrategy = getStrategy('hero-showcase', 'balanced-stack');

  // -------------------------------------------------------------------------
  // 3. SPLIT STORY / BRAND SHOWCASE SECTION (split-story-section)
  // -------------------------------------------------------------------------
  const splitStoryBoxes = new Set<string>();
  const splitStoryTextCols = new Set<string>();
  const splitStoryVisualCols = new Set<string>();
  const splitStorySelectors = new Set<string>();
  const splitStoryWhere: string[] = [];
  let splitStoryCount = 0;

  doc
    .querySelectorAll(
      'section[class], section[data-purpose], div[class], article[class]'
    )
    .forEach((el) => {
      if (
        el.classList.contains('story-section') ||
        el.id === 'brand-story' ||
        el.classList.contains('about-section') ||
        el.getAttribute('data-purpose') === 'brand-story'
      ) {
        getPrimaryAuthorClasses(el).forEach((c) =>
          splitStorySelectors.add(`.${c}`)
        );
        if (el.getAttribute('data-purpose')) {
          splitStorySelectors.add(
            `[data-purpose="${el.getAttribute('data-purpose')}"]`
          );
        }
      }
      if (isSplitStoryOrShowcaseBox(el)) {
        splitStoryCount++;
        const primary = getPrimaryAuthorClasses(el)[0];
        if (primary) {
          splitStoryBoxes.add(`.${primary}`);
          splitStorySelectors.add(`.${primary}`);
        }
        const parentSec = el.closest('section') || el;
        const loc = describeElementLocation(parentSec);
        if (!splitStoryWhere.includes(loc)) {
          splitStoryWhere.push(loc);
        }
        if (el.children.length === 2) {
          const c0 = el.children[0];
          const c1 = el.children[1];
          const c0Cls = getPrimaryAuthorClasses(c0)[0];
          const c1Cls = getPrimaryAuthorClasses(c1)[0];
          const c0HasVisual =
            !c0.querySelector('h1, h2, h3, p') &&
            Boolean(c0.querySelector('svg, img'));
          if (c0HasVisual) {
            if (c0Cls) {
              splitStoryVisualCols.add(`.${c0Cls}`);
              splitStorySelectors.add(`.${c0Cls}`);
            }
            if (c1Cls) {
              splitStoryTextCols.add(`.${c1Cls}`);
              splitStorySelectors.add(`.${c1Cls}`);
            }
          } else {
            if (c0Cls) {
              splitStoryTextCols.add(`.${c0Cls}`);
              splitStorySelectors.add(`.${c0Cls}`);
            }
            if (c1Cls) {
              splitStoryVisualCols.add(`.${c1Cls}`);
              splitStorySelectors.add(`.${c1Cls}`);
            }
          }
        }
      }
    });

  ['.story-title', '.story-quote', '.story-link'].forEach((s) => {
    if (doc.querySelector(s)) splitStorySelectors.add(s);
  });

  const splitStoryStrategy = getStrategy(
    'split-story-section',
    'vertical-centered'
  );

  // -------------------------------------------------------------------------
  // 4. HORIZONTAL PROMO BANNER CARDS (promo-banner-card)
  // -------------------------------------------------------------------------
  const promoGrids = new Set<string>();
  const promoCards = new Set<string>();
  const promoTextCols = new Set<string>();
  const promoArtCols = new Set<string>();
  const promoSelectors = new Set<string>();
  const promoWhere: string[] = [];
  let promoCount = 0;

  doc
    .querySelectorAll('div[class], article[class], a[class]')
    .forEach((el) => {
      if (isHorizontalPromoBannerCard(el)) {
        promoCount++;
        const primary = getPrimaryAuthorClasses(el)[0];
        if (primary) {
          promoCards.add(`.${primary}`);
          promoSelectors.add(`.${primary}`);
        }
        if (el.closest('[data-purpose="promo-banners"]')) {
          promoSelectors.add('[data-purpose="promo-banners"]');
        }
        if (el.parentElement) {
          const gridCls = getPrimaryAuthorClasses(el.parentElement)[0];
          if (gridCls) {
            promoGrids.add(`.${gridCls}`);
            promoSelectors.add(`.${gridCls}`);
          }
        }
        promoWhere.push(describeElementLocation(el));
        if (el.children.length === 2) {
          const c0Cls = getPrimaryAuthorClasses(el.children[0])[0];
          const c1Cls = getPrimaryAuthorClasses(el.children[1])[0];
          if (c0Cls) {
            promoTextCols.add(`.${c0Cls}`);
            promoSelectors.add(`.${c0Cls}`);
          }
          if (c1Cls) {
            promoArtCols.add(`.${c1Cls}`);
            promoSelectors.add(`.${c1Cls}`);
          }
        }
      }
    });

  ['.speech-bubble-tag', '.promo-title', '.promo-sub', '.promo-link'].forEach(
    (s) => {
      if (doc.querySelector(s)) promoSelectors.add(s);
    }
  );

  const promoStrategy = getStrategy('promo-banner-card', 'horizontal-balanced');

  // -------------------------------------------------------------------------
  // 5. WOOCOMMERCE / SHOP PRODUCT CARDS (product-grid-card)
  // -------------------------------------------------------------------------
  const productGrids = new Set<string>();
  const productCards = new Set<string>();
  const productSelectors = new Set<string>();
  const productWhere: string[] = [];
  let productCount = 0;

  doc
    .querySelectorAll(
      '.wc-product-card, [class*="product-card"], [class*="shop-card"], [data-purpose="new-arrivals"] .grid > div.group'
    )
    .forEach((el) => {
      productCount++;
      const primary = getPrimaryAuthorClasses(el)[0];
      if (primary) {
        productCards.add(`.${primary}`);
        productSelectors.add(`.${primary}`);
      }
      if (el.closest('[data-purpose="new-arrivals"]')) {
        productSelectors.add('[data-purpose="new-arrivals"]');
      }
      if (el.parentElement) {
        const gCls = getPrimaryAuthorClasses(el.parentElement)[0];
        if (gCls) {
          productGrids.add(`.${gCls}`);
          productSelectors.add(`.${gCls}`);
        }
      }
      const parentSec = el.closest('section');
      if (parentSec) {
        const loc = describeElementLocation(parentSec);
        if (!productWhere.includes(loc)) productWhere.push(loc);
      }
    });

  [
    '.wc-product-thumb',
    '.wc-badge',
    '.wc-wishlist-btn',
    '.wc-product-title',
    '.wc-price-row',
    '.wc-price-current',
    '.wc-currency',
    '.wc-add-to-cart',
  ].forEach((s) => {
    if (doc.querySelector(s)) productSelectors.add(s);
  });

  const productStrategy = getStrategy('product-grid-card', 'grid-2col');

  // -------------------------------------------------------------------------
  // 6. CATEGORY TILES GRID (category-tile-grid)
  // -------------------------------------------------------------------------
  const categorySelectors = new Set<string>();
  const categoryWhere: string[] = [];
  let categoryCount = 0;

  doc
    .querySelectorAll(
      '.category-tile, [class*="category-card"], [class*="cat-tile"], [data-purpose="categories-section"] a.group'
    )
    .forEach((el) => {
      categoryCount++;
      getPrimaryAuthorClasses(el).forEach((c) => categorySelectors.add(`.${c}`));
      if (el.closest('[data-purpose="categories-section"]')) {
        categorySelectors.add('[data-purpose="categories-section"]');
      }
      if (el.parentElement) {
        getPrimaryAuthorClasses(el.parentElement).forEach((c) =>
          categorySelectors.add(`.${c}`)
        );
      }
      const parentSec = el.closest('section');
      if (parentSec) {
        const loc = describeElementLocation(parentSec);
        if (!categoryWhere.includes(loc)) categoryWhere.push(loc);
      }
    });

  ['.category-art-box', '.category-name', '.category-count'].forEach((s) => {
    if (doc.querySelector(s)) categorySelectors.add(s);
  });

  const categoryStrategy = getStrategy('category-tile-grid', 'grid-2col');

  // -------------------------------------------------------------------------
  // 7. COLLECTIONS & EDITORIAL BLOG CARDS (collection-editorial-grid)
  // -------------------------------------------------------------------------
  const collectionSelectors = new Set<string>();
  const collectionWhere: string[] = [];
  let collectionCount = 0;

  doc
    .querySelectorAll(
      '.collection-card, .blog-card, [class*="post-card"], [data-purpose="featured-collections"] .grid > div.group'
    )
    .forEach((el) => {
      collectionCount++;
      getPrimaryAuthorClasses(el).forEach((c) =>
        collectionSelectors.add(`.${c}`)
      );
      if (el.closest('[data-purpose="featured-collections"]')) {
        collectionSelectors.add('[data-purpose="featured-collections"]');
      }
      if (el.parentElement) {
        getPrimaryAuthorClasses(el.parentElement).forEach((c) =>
          collectionSelectors.add(`.${c}`)
        );
      }
      const parentSec = el.closest('section');
      if (parentSec) {
        const loc = describeElementLocation(parentSec);
        if (!collectionWhere.includes(loc)) collectionWhere.push(loc);
      }
    });

  ['.collection-art', '.collection-cta', '.blog-thumb', '.blog-body'].forEach(
    (s) => {
      if (doc.querySelector(s)) collectionSelectors.add(s);
    }
  );

  const collectionStrategy = getStrategy(
    'collection-editorial-grid',
    'single-col-card'
  );

  // -------------------------------------------------------------------------
  // 8. CUSTOMER TRUST & FEATURE ICON BAR (trust-feature-bar)
  // -------------------------------------------------------------------------
  const trustItems = new Set<string>();
  const trustIcons = new Set<string>();
  const trustSelectors = new Set<string>();
  const trustWhere: string[] = [];
  let trustCount = 0;

  doc.querySelectorAll('div[class], li[class], article[class]').forEach((el) => {
    const primary = getPrimaryAuthorClasses(el)[0] || '';
    const isFooterTrustCard =
      Boolean(el.closest('footer[data-purpose="main-footer"]')) &&
      el.classList.contains('flex') &&
      el.classList.contains('items-center') &&
      el.children.length === 2 &&
      Boolean(el.children[0].querySelector('svg')) &&
      Boolean(el.children[1].querySelector('h4'));

    if (
      isFooterTrustCard ||
      (el.children.length === 2 &&
        /^(trust-item|feature-item|benefit-item|perk-item|guarantee-item)$/i.test(
          primary
        ))
    ) {
      trustCount++;
      if (primary) {
        trustItems.add(`.${primary}`);
        trustSelectors.add(`.${primary}`);
      }
      if (isFooterTrustCard) {
        trustSelectors.add('[data-purpose="main-footer"] .grid > div');
      }
      if (el.parentElement) {
        const barCls = getPrimaryAuthorClasses(el.parentElement)[0];
        if (barCls) trustSelectors.add(`.${barCls}`);
      }
      const iconCls = getPrimaryAuthorClasses(el.children[0])[0];
      if (iconCls) {
        trustIcons.add(`.${iconCls}`);
        trustSelectors.add(`.${iconCls}`);
      }
      const parentSec = el.closest('section, footer') || el.parentElement || el;
      const loc = describeElementLocation(parentSec);
      if (!trustWhere.includes(loc)) trustWhere.push(loc);
    }
  });

  const trustStrategy = getStrategy('trust-feature-bar', 'horizontal-rows');

  // -------------------------------------------------------------------------
  // 9. FAQ ACCORDION & TOGGLE ITEMS (faq-accordion)
  // -------------------------------------------------------------------------
  const faqSelectors = new Set<string>();
  const faqWhere: string[] = [];
  let faqCount = 0;

  doc
    .querySelectorAll(
      '.faq-item, .gf-item, .accordion-item, details, [data-purpose="faq-section"] .space-y-3 > div'
    )
    .forEach((el) => {
      faqCount++;
      getPrimaryAuthorClasses(el).forEach((c) => faqSelectors.add(`.${c}`));
      if (el.tagName.toLowerCase() === 'details') faqSelectors.add('details');
      if (el.closest('[data-purpose="faq-section"]')) {
        faqSelectors.add('[data-purpose="faq-section"]');
      }
      const parentSec = el.closest('section') || el.parentElement;
      if (parentSec) {
        const loc = describeElementLocation(parentSec);
        if (!faqWhere.includes(loc)) faqWhere.push(loc);
      }
    });

  const faqStrategy = getStrategy('faq-accordion', 'compact-accordion');

  // -------------------------------------------------------------------------
  // 10. MULTI-COLUMN SITE FOOTER (site-footer)
  // -------------------------------------------------------------------------
  const footerSelectors = new Set<string>();
  const footerWhere: string[] = [];
  let footerCount = 0;

  doc
    .querySelectorAll('footer, .site-footer, .footer-grid, .footer-bottom')
    .forEach((el) => {
      getPrimaryAuthorClasses(el).forEach((c) => footerSelectors.add(`.${c}`));
      if (
        el.tagName.toLowerCase() === 'footer' ||
        el.classList.contains('site-footer')
      ) {
        footerCount++;
        footerWhere.push(describeElementLocation(el));
      }
    });

  const footerStrategy = getStrategy('site-footer', 'clean-stack');

  // =========================================================================
  // BUILD DETECTED PATTERNS CATALOG FOR UI INSPECTOR ("چی کجا استفاده بشه")
  // =========================================================================
  const detectedPatterns: DetectedPatternItem[] = [
    {
      id: 'header-navigation',
      title: 'هدر، لوگو و نوار اعلان (Header & Brand Logo)',
      englishBadge: 'Header & Logo',
      detected: headerCount > 0,
      instanceCount: headerCount,
      matchedSelectors: Array.from(headerSelectors),
      whereUsed: headerWhere.slice(0, 3),
      elementorMapping:
        'Container (Header Grid) ← Container (a.brand-logo + SVG Emblem + Heading) + Native Button (.action-btn + .badge-count)',
      activeStrategy: headerStrategy,
      strategyOptions: [
        {
          value: 'compact-row',
          label: 'افقی ۳ ستونه استاندارد + قفل لوگو ۴۸px (پیشنهادی)',
        },
        {
          value: 'stacked-center',
          label: 'عمودی مرکزچین (لوگو بالا + دکمه‌ها پایین)',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        headerStrategy === 'compact-row'
          ? 'چیدمان Grid سه ستونه (auto minmax(0,1fr) auto)، قفل لوگوی SVG روی 48×48px با aspect-ratio: 1/1، دکمه‌های اکشن 34×34px و حذف ارتفاع کاذب دسکتاپ.'
          : headerStrategy === 'stacked-center'
          ? 'چیدمان عمودی و مرکزچین لوگو و دکمه‌های اکشن هدر در موبایل.'
          : 'قوانین بازنویسی موبایل برای هدر غیرفعال است.',
    },
    {
      id: 'hero-showcase',
      title: 'سکشن هیرو و ویترین اصلی (Hero Showcase)',
      englishBadge: 'Hero Section',
      detected: heroCount > 0,
      instanceCount: heroCount,
      matchedSelectors: Array.from(heroSelectors),
      whereUsed: heroWhere.slice(0, 3),
      elementorMapping:
        'Container (.hero-section) ← HTML/SVG Stage (.hero-illustration-stage) + Container (.hero-content: H1 Heading + Text Editor + Native Buttons)',
      activeStrategy: heroStrategy,
      strategyOptions: [
        {
          value: 'balanced-stack',
          label: 'مقیاس‌پذیری تصویر + تیتر ۲۲px و دکمه‌های متوازن (پیشنهادی)',
        },
        {
          value: 'compact-hero',
          label: 'فشرده‌سازی حداکثری پدینگ و دکمه‌های تمام‌عرض',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        heroStrategy === 'balanced-stack'
          ? 'حفظ نسبت ابعاد تصویرسازی اصلی، کاهش پدینگ باکس متن به 16px، تنظیم تیتر روی 22px و چیدمان منعطف دکمه‌های CTA.'
          : heroStrategy === 'compact-hero'
          ? 'فشرده‌سازی پدینگ سکشن هیرو و تمام‌عرض کردن دکمه‌های فراخوان (100% width) در موبایل.'
          : 'قوانین بازنویسی موبایل برای سکشن هیرو غیرفعال است.',
    },
    {
      id: 'split-story-section',
      title: 'سکشن داستان برند و معرفی دوطرفه (story-section)',
      englishBadge: 'Split Story / About',
      detected: splitStoryCount > 0 || splitStorySelectors.size > 0,
      instanceCount: Math.max(splitStoryCount, splitStoryWhere.length),
      matchedSelectors: Array.from(splitStorySelectors),
      whereUsed: splitStoryWhere.slice(0, 4),
      elementorMapping:
        'Container (.story-box) ← Container (.story-content: Eyebrow + H2 Heading + Quote Text Editor + Body Text + Link Button) + HTML/SVG (.story-illustration)',
      activeStrategy: splitStoryStrategy,
      strategyOptions: [
        {
          value: 'vertical-centered',
          label: 'تک‌ستونه عمودی + نقل‌قول خوانا + تصویر ۱۵۰px وسط‌چین (پیشنهادی)',
        },
        {
          value: 'compact-row',
          label: 'افقی ۲ ستونه فشرده (متن راست + تصویر ۱۰۰px چپ)',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        splitStoryStrategy === 'vertical-centered'
          ? 'جداسازی هوشمند از promo-card؛ تبدیل .story-box به چیدمان عمودی (column)، وسط‌چین کردن تیتر و لینک، حفظ استایل باکس نقل‌قول (.story-quote) و قفل کردن لوگوی .story-illustration روی 150×150px در مرکز.'
          : splitStoryStrategy === 'compact-row'
          ? 'چیدمان افقی فشرده متن داستان برند در کنار تصویرسازی ۱۰۰ پیکسلی.'
          : 'قوانین بازنویسی موبایل برای سکشن داستان برند غیرفعال است.',
    },
    {
      id: 'promo-banner-card',
      title: 'کارت‌های بنر تبلیغاتی دوتایی (promo-card)',
      englishBadge: 'Promo Callout Cards',
      detected: promoCount > 0,
      instanceCount: promoCount,
      matchedSelectors: Array.from(promoSelectors),
      whereUsed: promoWhere.slice(0, 4),
      elementorMapping:
        'Container (.promo-card) ← Container (.promo-text-col: Tag Span + H2 Heading + Text + Pill Button) + SVG Art (.promo-art-col)',
      activeStrategy: promoStrategy,
      strategyOptions: [
        {
          value: 'horizontal-balanced',
          label: 'افقی ۲ ستونه متوازن + قفل تصویر ۱۰۴×۹۴ (پیشنهادی)',
        },
        {
          value: 'vertical-stack',
          label: 'عمودی تک‌ستونه وسط‌چین در موبایل',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        promoStrategy === 'horizontal-balanced'
          ? 'حفظ چیدمان افقی (flex-direction: row) داخل هر کارت، قفل نسبت ابعاد تصویر (.promo-art-col) روی 140/125 (104×94px) و جلوگیری از شکستن دکمه .promo-link.'
          : promoStrategy === 'vertical-stack'
          ? 'تبدیل کارت‌های بنر به چیدمان عمودی وسط‌چین (متن بالا و تصویر پایین) در موبایل.'
          : 'قوانین بازنویسی موبایل برای کارت‌های بنر غیرفعال است.',
    },
    {
      id: 'product-grid-card',
      title: 'شبکه و کارت‌های محصول فروشگاهی (wc-product-card)',
      englishBadge: 'WooCommerce Product Grid',
      detected: productCount > 0,
      instanceCount: productCount,
      matchedSelectors: Array.from(productSelectors),
      whereUsed: productWhere.slice(0, 4),
      elementorMapping:
        'Container (.wc-product-card) ← Container (.wc-product-thumb: Badge + Wishlist Button + SVG) + H3 Heading + Price Text Editor (.wc-currency) + Add-to-Cart Button',
      activeStrategy: productStrategy,
      strategyOptions: [
        {
          value: 'grid-2col',
          label: 'گرید ۲ ستونه استاندارد موبایل + دکمه تک‌خطی (پیشنهادی)',
        },
        {
          value: 'grid-1col',
          label: 'نمایش تک‌ستونه بزرگ کارت‌های محصول در موبایل',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        productStrategy === 'grid-2col'
          ? 'شبکه ۲ ستونه (repeat(2, minmax(0,1fr)))، تصویر ۱:۱ با حاشیه امن ۲۶px برای بج تخفیف، محدودسازی عنوان به ۲ خط، حفظ واحد پول و دکمه خرید ۱۱px تک‌خطی.'
          : productStrategy === 'grid-1col'
          ? 'نمایش تک‌ستونه (1fr) کارت‌های محصول با ابعاد بزرگ‌تر در موبایل.'
          : 'قوانین بازنویسی موبایل برای کارت‌های محصول غیرفعال است.',
    },
    {
      id: 'category-tile-grid',
      title: 'شبکه دسته‌بندی‌های تصویری (category-grid)',
      englishBadge: 'Category Tiles',
      detected: categoryCount > 0,
      instanceCount: categoryCount,
      matchedSelectors: Array.from(categorySelectors),
      whereUsed: categoryWhere.slice(0, 3),
      elementorMapping:
        'Container (a.category-tile) ← Square Art Container (.category-art-box) + H3 Heading (.category-name) + Span (.category-count)',
      activeStrategy: categoryStrategy,
      strategyOptions: [
        {
          value: 'grid-2col',
          label: 'گرید ۲ ستونه متوازن با کادر مربعی ۱:۱ (پیشنهادی)',
        },
        {
          value: 'grid-3col',
          label: 'گرید ۳ ستونه فشرده در موبایل',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        categoryStrategy === 'grid-2col'
          ? 'چیدمان ۲ ستونه متوازن با قفل aspect-ratio: 1/1 روی باکس تصویر دسته‌بندی.'
          : categoryStrategy === 'grid-3col'
          ? 'چیدمان ۳ ستونه فشرده با آیکن‌های کوچک‌تر در موبایل.'
          : 'قوانین بازنویسی موبایل برای دسته‌بندی‌ها غیرفعال است.',
    },
    {
      id: 'collection-editorial-grid',
      title: 'کارت‌های کالکشن و مجله وبلاگ (collection & blog)',
      englishBadge: 'Collections & Blog',
      detected: collectionCount > 0,
      instanceCount: collectionCount,
      matchedSelectors: Array.from(collectionSelectors),
      whereUsed: collectionWhere.slice(0, 3),
      elementorMapping:
        'Container (.collection-card / .blog-card) ← Art/Thumb Container + H3 Heading + Excerpt Text Editor + CTA Badge/Button (.collection-cta)',
      activeStrategy: collectionStrategy,
      strategyOptions: [
        {
          value: 'single-col-card',
          label: 'تک‌ستونه متوازن + حفظ رنگ هاور CTA (پیشنهادی)',
        },
        {
          value: 'compact-grid',
          label: 'گرید ۲ ستونه فشرده در موبایل',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        collectionStrategy === 'single-col-card'
          ? 'تک‌ستونه شدن کارت‌های کالکشن و وبلاگ، وسط‌چین شدن تصویر کالکشن (120×100px) و تضمین رنگ سفید متن روی هاور .collection-cta.'
          : collectionStrategy === 'compact-grid'
          ? 'نمایش ۲ ستونه فشرده کارت‌های کالکشن در موبایل.'
          : 'قوانین بازنویسی موبایل برای کالکشن و وبلاگ غیرفعال است.',
    },
    {
      id: 'trust-feature-bar',
      title: 'نوار اعتماد و ویژگی‌های آیکن‌دار (trust-section)',
      englishBadge: 'Trust Feature Bar',
      detected: trustCount > 0,
      instanceCount: trustCount,
      matchedSelectors: Array.from(trustSelectors),
      whereUsed: trustWhere.slice(0, 3),
      elementorMapping:
        'Container (.trust-bar) ← Container (.trust-item) ← Icon Container (.trust-icon 46×46) + Text Container (H4 Heading + Subtitle)',
      activeStrategy: trustStrategy,
      strategyOptions: [
        {
          value: 'horizontal-rows',
          label: 'ردیف‌های افقی آیکن ۴۶×۴۶ + متن تراز (پیشنهادی)',
        },
        {
          value: 'grid-2col',
          label: 'شبکه ۲ ستونه فشرده (آیکن بالا + متن وسط‌چین)',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        trustStrategy === 'horizontal-rows'
          ? 'چیدمان ردیفی (flex-direction: row) با قفل کادر آیکن روی 46×46px (aspect-ratio: 1/1) و قرارگیری تیتر و توضیح زیر هم.'
          : trustStrategy === 'grid-2col'
          ? 'چیدمان ۲ ستونه وسط‌چین با آیکن در بالا و عنوان در پایین.'
          : 'قوانین بازنویسی موبایل برای نوار اعتماد غیرفعال است.',
    },
    {
      id: 'faq-accordion',
      title: 'پرسش‌های متداول و آکاردئون (faq-section)',
      englishBadge: 'Native Accordion',
      detected: faqCount > 0,
      instanceCount: faqCount,
      matchedSelectors: Array.from(faqSelectors),
      whereUsed: faqWhere.slice(0, 3),
      elementorMapping:
        'Native Elementor Accordion Widget (widgetType: "accordion") با تایتل، محتوای پاسخ و آیکن باز/بسته شدن',
      activeStrategy: faqStrategy,
      strategyOptions: [
        {
          value: 'compact-accordion',
          label: 'پدینگ و تایپوگرافی بهینه موبایل (پیشنهادی)',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        faqStrategy === 'compact-accordion'
          ? 'تبدیل به ویجت بومی Accordion المنتور با پدینگ 14px 16px، فونت سوال 13.5px و دکمه آیکن 24×24px.'
          : 'قوانین بازنویسی موبایل برای آکاردئون غیرفعال است.',
    },
    {
      id: 'site-footer',
      title: 'فوتر چندستونه و نمادهای اعتماد (site-footer)',
      englishBadge: 'Site Footer',
      detected: footerCount > 0,
      instanceCount: footerCount,
      matchedSelectors: Array.from(footerSelectors),
      whereUsed: footerWhere.slice(0, 3),
      elementorMapping:
        'Container (footer.site-footer) ← Grid Container (.footer-grid) + Brand Container + Link Lists + Trust Badges',
      activeStrategy: footerStrategy,
      strategyOptions: [
        {
          value: 'clean-stack',
          label: 'تک‌ستونه مرتب + نمادهای اعتماد افقی (پیشنهادی)',
        },
        {
          value: 'grid-2col-links',
          label: 'چیدمان ۲ ستونه لینک‌های فوتر در موبایل',
        },
        { value: 'disabled', label: 'غیرفعال (استفاده از CSS خام قالب)' },
      ],
      mobileBehaviorSummary:
        footerStrategy === 'clean-stack'
          ? 'تک‌ستونه شدن فوتر با فاصله متوازن، حفظ تراز لوگو و شبکه‌های اجتماعی، و وسط‌چین شدن کپی‌رایت.'
          : footerStrategy === 'grid-2col-links'
          ? 'نمایش ۲ ستونه ستون‌های لینک فوتر در موبایل.'
          : 'قوانین بازنویسی موبایل برای فوتر غیرفعال است.',
    },
  ];

  // =========================================================================
  // GENERATE @media (max-width: 768px) CSS RULES PER ACTIVE STRATEGY
  // =========================================================================
  if (!globalMobileEnabled) {
    return { detectedPatterns, mobileCssRules: [] };
  }

  const rules: string[] = [`@media (max-width: 768px) {`];

  // Global container mobile breathing space & overflow safety
  rules.push(
    `  ${sp} .e-container, ${sp} .container { padding-left: 16px !important; padding-right: 16px !important; }`,
    `  ${sp} .section-header { margin-bottom: 26px !important; }`,
    `  ${sp} .section-title { font-size: 20px !important; line-height: 1.4 !important; }`,
    `  ${sp} .section-subtitle { font-size: 12.5px !important; }`,
    `  ${sp} .elementor-floating-bar { bottom: 10px !important; left: 10px !important; right: 10px !important; justify-content: space-between !important; padding: 7px 12px !important; font-size: 11px !important; }`
  );

  // 1. HEADER & LOGO RULES
  if (headerStrategy === 'compact-row') {
    rules.push(
      `  ${sp} .top-bar, ${sp} .top-bar-inner { display: flex !important; flex-direction: row !important; --flex-direction: row !important; flex-wrap: wrap !important; align-items: center !important; justify-content: center !important; gap: 6px !important; padding: 6px 12px !important; font-size: 11.5px !important; line-height: 1.55 !important; text-align: center !important; }`,
      `  ${sp} .top-bar-badge { white-space: nowrap !important; flex-shrink: 0 !important; width: auto !important; }`,
      `  ${sp} .site-header { min-height: 0 !important; height: auto !important; }`,
      `  ${sp} .header-main { display: grid !important; --display: grid !important; grid-template-columns: auto minmax(0, 1fr) auto !important; align-items: center !important; gap: 8px !important; padding: 10px 0 !important; }`,
      `  ${sp} .header-right { display: flex !important; align-items: center !important; justify-content: flex-start !important; }`,
      `  ${sp} .brand-logo { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important; gap: 2px !important; min-width: 0 !important; width: 100% !important; }`,
      `  ${sp} .brand-logo-emblem { width: 48px !important; height: 48px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; margin: 0 auto !important; }`,
      `  ${sp} .brand-logo-text { font-size: 15.5px !important; line-height: 1.2 !important; white-space: nowrap !important; }`,
      `  ${sp} .brand-logo-sub { font-size: 9.5px !important; line-height: 1.3 !important; white-space: nowrap !important; }`,
      `  ${sp} .header-actions { display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: flex-end !important; gap: 6px !important; flex-shrink: 0 !important; }`,
      `  ${sp} .action-btn { width: 34px !important; height: 34px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; }`,
      `  ${sp} .action-btn svg, ${sp} .action-btn .elementor-button-icon { width: 16px !important; height: 16px !important; }`,
      `  ${sp} .cart-btn { height: 36px !important; padding: 0 10px !important; font-size: 12px !important; }`
    );
  } else if (headerStrategy === 'stacked-center') {
    rules.push(
      `  ${sp} .site-header { min-height: 0 !important; height: auto !important; }`,
      `  ${sp} .header-main { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 10px !important; padding: 12px 0 !important; }`,
      `  ${sp} .brand-logo { display: flex !important; flex-direction: column !important; align-items: center !important; text-align: center !important; }`,
      `  ${sp} .brand-logo-emblem { width: 52px !important; height: 52px !important; aspect-ratio: 1 / 1 !important; }`,
      `  ${sp} .header-actions { display: flex !important; flex-direction: row !important; justify-content: center !important; gap: 8px !important; }`
    );
  }

  // 2. HERO SHOWCASE RULES
  if (heroStrategy === 'balanced-stack') {
    rules.push(
      `  ${sp} .hero-section { padding: 28px 0 38px !important; }`,
      `  ${sp} .hero-illustration-stage { padding: 4px !important; margin-bottom: 14px !important; }`,
      `  ${sp} .hero-content { padding: 16px 18px !important; border-radius: 18px !important; width: 100% !important; }`,
      `  ${sp} .hero-title { font-size: 22px !important; line-height: 1.4 !important; margin-bottom: 8px !important; }`,
      `  ${sp} .hero-desc { font-size: 13.5px !important; line-height: 1.75 !important; margin-bottom: 16px !important; }`,
      `  ${sp} .hero-ctas { display: flex !important; flex-direction: row !important; --flex-direction: row !important; flex-wrap: wrap !important; justify-content: center !important; gap: 10px !important; }`,
      `  ${sp} .hero-ctas .btn { padding: 10px 18px !important; font-size: 13px !important; }`
    );
  } else if (heroStrategy === 'compact-hero') {
    rules.push(
      `  ${sp} .hero-section { padding: 20px 0 28px !important; }`,
      `  ${sp} .hero-content { padding: 14px !important; width: 100% !important; }`,
      `  ${sp} .hero-title { font-size: 20px !important; }`,
      `  ${sp} .hero-ctas { display: flex !important; flex-direction: column !important; --flex-direction: column !important; gap: 8px !important; width: 100% !important; }`,
      `  ${sp} .hero-ctas .btn { width: 100% !important; justify-content: center !important; }`
    );
  }

  // 3. SPLIT STORY / BRAND SHOWCASE SECTION RULES (Fixes .story-section & any dynamic split showcase!)
  const allSplitBoxSelectors = Array.from(
    new Set(['.story-box', ...Array.from(splitStoryBoxes)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allSplitTextSelectors = Array.from(
    new Set(['.story-content', ...Array.from(splitStoryTextCols)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allSplitVisualSelectors = Array.from(
    new Set(['.story-illustration', ...Array.from(splitStoryVisualCols)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allSplitVisualMediaSelectors = Array.from(
    new Set(['.story-illustration', ...Array.from(splitStoryVisualCols)])
  )
    .flatMap((s) => [`${sp} ${s} svg`, `${sp} ${s} img`])
    .join(', ');

  if (splitStoryStrategy === 'vertical-centered') {
    rules.push(
      `  ${sp} .story-section { padding: 34px 0 !important; }`,
      `  ${allSplitBoxSelectors} { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; grid-template-columns: 1fr !important; align-items: center !important; justify-content: center !important; text-align: center !important; padding: 24px 18px !important; gap: 20px !important; border-radius: 22px !important; width: 100% !important; }`,
      `  ${allSplitTextSelectors} { width: 100% !important; min-width: 0 !important; flex: 1 1 auto !important; display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; }`,
      `  ${sp} .story-content .section-eyebrow { margin-left: auto !important; margin-right: auto !important; margin-bottom: 10px !important; align-self: center !important; width: auto !important; }`,
      `  ${sp} .story-title { font-size: 20px !important; line-height: 1.4 !important; margin-bottom: 12px !important; text-align: center !important; width: 100% !important; }`,
      `  ${sp} .story-quote { font-size: 13.5px !important; line-height: 1.8 !important; padding: 14px 16px !important; margin-bottom: 14px !important; width: 100% !important; text-align: right !important; border-radius: 14px !important; border-right: 3px solid var(--accent-pink, #F36FA8) !important; }`,
      `  ${sp} .story-content p:not(.story-quote), ${sp} .story-content .el-native-text:not(.story-quote) { font-size: 13px !important; line-height: 1.8 !important; margin-bottom: 16px !important; text-align: center !important; width: 100% !important; }`,
      `  ${sp} .story-link { display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; margin: 0 auto !important; align-self: center !important; width: auto !important; }`,
      `  ${allSplitVisualSelectors} { width: 150px !important; height: 150px !important; max-width: 150px !important; aspect-ratio: 1 / 1 !important; margin: 2px auto 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }`,
      `  ${allSplitVisualMediaSelectors} { width: 100% !important; height: 100% !important; max-width: 150px !important; max-height: 150px !important; aspect-ratio: 1 / 1 !important; object-fit: contain !important; display: block !important; margin: 0 auto !important; }`
    );
  } else if (splitStoryStrategy === 'compact-row') {
    rules.push(
      `  ${sp} .story-section { padding: 32px 0 !important; }`,
      `  ${allSplitBoxSelectors} { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: space-between !important; padding: 20px 16px !important; gap: 14px !important; text-align: right !important; }`,
      `  ${allSplitTextSelectors} { flex: 1 1 0% !important; min-width: 0 !important; text-align: right !important; }`,
      `  ${sp} .story-title { font-size: 18px !important; margin-bottom: 8px !important; }`,
      `  ${sp} .story-quote { font-size: 12.5px !important; padding: 10px 12px !important; margin-bottom: 10px !important; }`,
      `  ${allSplitVisualSelectors} { width: 104px !important; height: 104px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; }`,
      `  ${allSplitVisualMediaSelectors} { width: 100% !important; height: 100% !important; max-width: 104px !important; max-height: 104px !important; }`
    );
  }

  // 4. PROMO BANNER CARDS RULES
  const allPromoGridSelectors = Array.from(
    new Set(['.promo-grid', ...Array.from(promoGrids)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allPromoCardSelectors = Array.from(
    new Set(['.promo-card', ...Array.from(promoCards)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allPromoTextSelectors = Array.from(
    new Set(['.promo-text-col', ...Array.from(promoTextCols)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allPromoArtSelectors = Array.from(
    new Set(['.promo-art-col', ...Array.from(promoArtCols)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');

  if (promoStrategy === 'horizontal-balanced') {
    rules.push(
      `  ${allPromoGridSelectors} { grid-template-columns: 1fr !important; gap: 16px !important; }`,
      `  ${allPromoCardSelectors} { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: space-between !important; padding: 18px 16px !important; gap: 12px !important; }`,
      `  ${allPromoTextSelectors} { flex: 1 1 0% !important; min-width: 0 !important; width: auto !important; display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: flex-start !important; }`,
      `  ${sp} .speech-bubble-tag { display: inline-block !important; width: auto !important; max-width: 100% !important; white-space: nowrap !important; padding: 4px 12px !important; font-size: 11px !important; margin-bottom: 10px !important; }`,
      `  ${sp} .promo-title { font-size: 17.5px !important; line-height: 1.45 !important; margin-bottom: 6px !important; }`,
      `  ${sp} .promo-sub { font-size: 12.5px !important; line-height: 1.65 !important; margin-bottom: 14px !important; }`,
      `  ${sp} .promo-link { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: auto !important; white-space: nowrap !important; padding: 7px 15px !important; font-size: 12px !important; border-radius: 999px !important; }`,
      `  ${allPromoArtSelectors} { width: 104px !important; height: 94px !important; aspect-ratio: 140 / 125 !important; flex-shrink: 0 !important; }`,
      `  ${sp} .promo-art-col svg { width: 100% !important; height: 100% !important; max-width: 104px !important; max-height: 94px !important; aspect-ratio: 140 / 125 !important; }`
    );
  } else if (promoStrategy === 'vertical-stack') {
    rules.push(
      `  ${allPromoGridSelectors} { grid-template-columns: 1fr !important; gap: 16px !important; }`,
      `  ${allPromoCardSelectors} { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; padding: 20px 16px !important; gap: 14px !important; }`,
      `  ${allPromoTextSelectors} { width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; text-align: center !important; }`,
      `  ${allPromoArtSelectors} { width: 120px !important; height: 108px !important; aspect-ratio: 140 / 125 !important; margin: 0 auto !important; }`
    );
  }

  // 5. PRODUCT GRID & CARDS RULES
  const allProductGridSelectors = Array.from(
    new Set(['.wc-products-grid', ...Array.from(productGrids)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allProductCardSelectors = Array.from(
    new Set(['.wc-product-card', ...Array.from(productCards)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');

  if (productStrategy === 'grid-2col') {
    rules.push(
      `  ${allProductGridSelectors} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }`,
      `  ${allProductCardSelectors} { min-width: 0 !important; width: 100% !important; padding: 10px !important; border-radius: 14px !important; display: flex !important; flex-direction: column !important; --flex-direction: column !important; }`,
      `  ${sp} .wc-product-thumb { width: 100% !important; aspect-ratio: 1 / 1 !important; height: auto !important; padding: 26px 10px 10px !important; margin-bottom: 10px !important; display: flex !important; align-items: center !important; justify-content: center !important; position: relative !important; }`,
      `  ${sp} .wc-product-thumb svg, ${sp} .wc-product-thumb img { width: 100% !important; height: 100% !important; max-width: 92px !important; max-height: 92px !important; aspect-ratio: 1 / 1 !important; object-fit: contain !important; margin: 0 auto !important; }`,
      `  ${sp} .wc-badge { position: absolute !important; top: 6px !important; right: 6px !important; padding: 2px 7px !important; font-size: 9.5px !important; line-height: 1.35 !important; white-space: nowrap !important; width: auto !important; }`,
      `  ${sp} .wc-wishlist-btn { position: absolute !important; top: 6px !important; left: 6px !important; width: 26px !important; height: 26px !important; aspect-ratio: 1 / 1 !important; }`,
      `  ${sp} .wc-wishlist-btn svg, ${sp} .wc-wishlist-btn .elementor-button-icon { width: 13px !important; height: 13px !important; }`,
      `  ${sp} .wc-product-cat { font-size: 10.5px !important; margin-bottom: 3px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }`,
      `  ${sp} .wc-product-title { font-size: 12.5px !important; line-height: 1.45 !important; min-height: 36px !important; margin-bottom: 8px !important; display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }`,
      `  ${sp} .wc-price-row { display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: baseline !important; flex-wrap: wrap !important; gap: 4px !important; margin-top: auto !important; margin-bottom: 10px !important; }`,
      `  ${sp} .wc-price-regular-del { font-size: 10.5px !important; }`,
      `  ${sp} .wc-price-current { font-size: 13px !important; font-weight: 800 !important; }`,
      `  ${sp} .wc-currency { font-size: 10px !important; font-weight: 500 !important; }`,
      `  ${sp} .wc-add-to-cart { width: 100% !important; padding: 7px 6px !important; font-size: 11px !important; gap: 4px !important; white-space: nowrap !important; border-radius: 9px !important; display: flex !important; align-items: center !important; justify-content: center !important; }`,
      `  ${sp} .wc-add-to-cart svg, ${sp} .wc-add-to-cart .elementor-button-icon { width: 13px !important; height: 13px !important; flex-shrink: 0 !important; }`
    );
  } else if (productStrategy === 'grid-1col') {
    rules.push(
      `  ${allProductGridSelectors} { grid-template-columns: 1fr !important; gap: 16px !important; }`,
      `  ${allProductCardSelectors} { padding: 14px !important; }`,
      `  ${sp} .wc-product-thumb { aspect-ratio: 16 / 11 !important; padding: 20px !important; }`,
      `  ${sp} .wc-product-thumb svg, ${sp} .wc-product-thumb img { max-width: 130px !important; max-height: 130px !important; }`
    );
  }

  // 6. CATEGORY TILES RULES
  if (categoryStrategy === 'grid-2col') {
    rules.push(
      `  ${sp} .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }`,
      `  ${sp} .category-art-box { width: 100% !important; aspect-ratio: 1 / 1 !important; padding: 14px !important; margin-bottom: 8px !important; }`
    );
  } else if (categoryStrategy === 'grid-3col') {
    rules.push(
      `  ${sp} .category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 10px !important; }`,
      `  ${sp} .category-art-box { width: 100% !important; aspect-ratio: 1 / 1 !important; padding: 10px !important; border-radius: 14px !important; margin-bottom: 6px !important; }`,
      `  ${sp} .category-name { font-size: 12px !important; }`,
      `  ${sp} .category-count { font-size: 10px !important; }`
    );
  }

  // 7. COLLECTIONS & EDITORIAL BLOG RULES
  if (collectionStrategy === 'single-col-card') {
    rules.push(
      `  ${sp} .collections-section, ${sp} .blog-section { padding: 36px 0 !important; }`,
      `  ${sp} .collections-grid, ${sp} .blog-grid { grid-template-columns: 1fr !important; gap: 16px !important; }`,
      `  ${sp} .collection-card { padding: 22px 18px !important; display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; }`,
      `  ${sp} .collection-art { width: 120px !important; height: 102px !important; aspect-ratio: 140 / 115 !important; margin: 0 auto 12px !important; }`,
      `  ${sp} .collection-desc { max-width: 100% !important; margin-bottom: 14px !important; }`,
      `  ${sp} .collection-cta { margin-top: auto !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; width: auto !important; }`,
      `  ${sp} .blog-thumb { aspect-ratio: 16 / 9 !important; padding: 16px !important; }`,
      `  ${sp} .blog-body { padding: 16px !important; }`
    );
  } else if (collectionStrategy === 'compact-grid') {
    rules.push(
      `  ${sp} .collections-grid, ${sp} .blog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }`,
      `  ${sp} .collection-card { padding: 14px 10px !important; }`,
      `  ${sp} .collection-art { width: 84px !important; height: 72px !important; margin-bottom: 8px !important; }`,
      `  ${sp} .collection-title { font-size: 14px !important; }`,
      `  ${sp} .collection-desc { font-size: 11.5px !important; }`
    );
  }

  // 8. TRUST FEATURE BAR RULES
  const allTrustItemSelectors = Array.from(
    new Set(['.trust-item', ...Array.from(trustItems)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');
  const allTrustIconSelectors = Array.from(
    new Set(['.trust-icon', ...Array.from(trustIcons)])
  )
    .map((s) => `${sp} ${s}`)
    .join(', ');

  if (trustStrategy === 'horizontal-rows') {
    rules.push(
      `  ${sp} .trust-bar { grid-template-columns: 1fr !important; padding: 18px 16px !important; gap: 14px !important; }`,
      `  ${allTrustItemSelectors} { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; gap: 12px !important; width: 100% !important; }`,
      `  ${allTrustIconSelectors} { width: 46px !important; height: 46px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; }`
    );
  } else if (trustStrategy === 'grid-2col') {
    rules.push(
      `  ${sp} .trust-bar { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; padding: 16px 12px !important; gap: 12px !important; }`,
      `  ${allTrustItemSelectors} { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 8px !important; }`,
      `  ${allTrustIconSelectors} { width: 44px !important; height: 44px !important; aspect-ratio: 1 / 1 !important; margin: 0 auto !important; }`
    );
  }

  // 9. FAQ ACCORDION RULES
  if (faqStrategy === 'compact-accordion') {
    rules.push(
      `  ${sp} .faq-section { padding: 34px 0 48px !important; }`,
      `  ${sp} .faq-question, ${sp} .el-native-accordion .elementor-tab-title { padding: 14px 16px !important; font-size: 13.5px !important; gap: 10px !important; }`,
      `  ${sp} .faq-answer-inner, ${sp} .el-native-accordion .elementor-tab-content { padding: 0 16px 14px !important; font-size: 12.5px !important; line-height: 1.75 !important; }`,
      `  ${sp} .faq-toggle-icon { width: 24px !important; height: 24px !important; font-size: 14px !important; }`
    );
  }

  // 10. SITE FOOTER RULES
  if (footerStrategy === 'clean-stack') {
    rules.push(
      `  ${sp} .site-footer { padding: 38px 0 22px !important; }`,
      `  ${sp} .footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; padding-bottom: 28px !important; }`,
      `  ${sp} .trust-badges-row { display: flex !important; flex-direction: row !important; --flex-direction: row !important; flex-wrap: wrap !important; gap: 10px !important; }`,
      `  ${sp} .footer-bottom { flex-direction: column !important; --flex-direction: column !important; text-align: center !important; justify-content: center !important; gap: 8px !important; font-size: 11.5px !important; }`
    );
  } else if (footerStrategy === 'grid-2col-links') {
    rules.push(
      `  ${sp} .site-footer { padding: 36px 0 20px !important; }`,
      `  ${sp} .footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 18px !important; }`,
      `  ${sp} .footer-grid > *:first-child { grid-column: 1 / -1 !important; }`,
      `  ${sp} .footer-bottom { flex-direction: column !important; text-align: center !important; gap: 6px !important; }`
    );
  }

  // 11. DATA-PURPOSE SCOPED TAILWIND TEMPLATE RULES (e.g. stich.html)
  if (doc.querySelector('[data-purpose]')) {
    if (headerStrategy !== 'disabled') {
      rules.push(
        `  ${sp} [data-purpose="top-announcement"] > div { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; flex-wrap: wrap !important; align-items: center !important; justify-content: center !important; gap: 6px !important; font-size: 11.5px !important; text-align: center !important; }`,
        `  ${sp} [data-purpose="main-header"] > div > div:first-child { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; }`,
        `  ${sp} [data-purpose="main-header"] .w-14.h-14 { width: 44px !important; height: 44px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; }`,
        `  ${sp} [data-purpose="main-header"] :where(h1, .el-tag-h1) { font-size: 17px !important; line-height: 1.25 !important; white-space: nowrap !important; }`,
        `  ${sp} [data-purpose="main-header"] nav :where(ul, .el-tag-ul) { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; flex-wrap: nowrap !important; overflow-x: auto !important; gap: 6px !important; padding-bottom: 2px !important; }`,
        `  ${sp} [data-purpose="main-header"] nav :where(li, .el-tag-li) { flex-shrink: 0 !important; width: auto !important; }`
      );
    }
    if (heroStrategy !== 'disabled') {
      rules.push(
        `  ${sp} [data-purpose="hero-scrapbook"] { padding-top: 24px !important; padding-bottom: 36px !important; overflow-x: hidden !important; }`,
        `  ${sp} [data-purpose="hero-scrapbook"] .grid.lg\\:grid-cols-12 { display: grid !important; --display: grid !important; grid-template-columns: 1fr !important; gap: 28px !important; }`,
        `  ${sp} [data-purpose="hero-scrapbook"] .lg\\:col-span-7, ${sp} [data-purpose="hero-scrapbook"] .lg\\:col-span-5 { grid-column: span 1 / span 1 !important; width: 100% !important; min-width: 0 !important; }`,
        `  ${sp} [data-purpose="hero-scrapbook"] :where(h2, .el-tag-h2) { font-size: 25px !important; line-height: 1.4 !important; }`,
        `  ${sp} [data-purpose="hero-scrapbook"] .aspect-square { width: 100% !important; aspect-ratio: 1 / 1 !important; height: auto !important; position: relative !important; overflow: hidden !important; }`,
        `  ${sp} [data-purpose="hero-scrapbook"] .aspect-square .el-native-img, ${sp} [data-purpose="hero-scrapbook"] .aspect-square img { width: 100% !important; height: 100% !important; object-fit: cover !important; }`
      );
    }
    if (promoStrategy !== 'disabled') {
      rules.push(
        `  ${sp} [data-purpose="promo-banners"] .grid { display: grid !important; --display: grid !important; grid-template-columns: 1fr !important; gap: 16px !important; }`,
        `  ${sp} [data-purpose="promo-banners"] .grid > div { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: space-between !important; padding: 20px 16px !important; gap: 12px !important; }`,
        `  ${sp} [data-purpose="promo-banners"] .text-6xl { font-size: 3.25rem !important; line-height: 1 !important; flex-shrink: 0 !important; }`
      );
    }
    if (categoryStrategy !== 'disabled') {
      const catCols = categoryStrategy === 'grid-3col' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))';
      rules.push(
        `  ${sp} [data-purpose="categories-section"] .grid { display: grid !important; --display: grid !important; grid-template-columns: ${catCols} !important; gap: 12px !important; }`,
        `  ${sp} [data-purpose="categories-section"] .grid > * { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; padding: 14px 10px !important; min-width: 0 !important; }`,
        `  ${sp} [data-purpose="categories-section"] .w-20.h-20 { width: 64px !important; height: 64px !important; aspect-ratio: 1 / 1 !important; display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 auto 10px !important; flex-shrink: 0 !important; }`
      );
    }
    if (productStrategy !== 'disabled') {
      const prodCols = productStrategy === 'grid-1col' ? '1fr' : 'repeat(2, minmax(0, 1fr))';
      rules.push(
        `  ${sp} [data-purpose="new-arrivals"] > div > .flex.flex-col.md\\:flex-row { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .grid, ${sp} [data-purpose="best-sellers"] .grid { display: grid !important; --display: grid !important; grid-template-columns: ${prodCols} !important; gap: 12px !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .grid > *, ${sp} [data-purpose="best-sellers"] .grid > * { padding: 10px !important; border-radius: 18px !important; min-width: 0 !important; width: 100% !important; display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; justify-content: space-between !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .aspect-square, ${sp} [data-purpose="best-sellers"] .aspect-square { width: 100% !important; aspect-ratio: 1 / 1 !important; height: auto !important; display: flex !important; align-items: center !important; justify-content: center !important; position: relative !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .text-7xl, ${sp} [data-purpose="best-sellers"] .text-6xl { font-size: 3rem !important; line-height: 1 !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] :where(h3, .el-tag-h3) { font-size: 13px !important; line-height: 1.45 !important; min-height: 38px !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .border-t.flex.items-center.justify-between, ${sp} [data-purpose="best-sellers"] .flex.items-center.justify-between { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; justify-content: space-between !important; gap: 6px !important; width: 100% !important; }`,
        `  ${sp} [data-purpose="new-arrivals"] .w-10.h-10 { width: 34px !important; height: 34px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; }`
      );
    }
    if (collectionStrategy !== 'disabled') {
      rules.push(
        `  ${sp} [data-purpose="featured-collections"] .grid, ${sp} [data-purpose="customer-reviews"] .grid { display: grid !important; --display: grid !important; grid-template-columns: 1fr !important; gap: 20px !important; }`,
        `  ${sp} [data-purpose="featured-collections"] .h-44 { width: 100% !important; height: 150px !important; display: flex !important; align-items: center !important; justify-content: center !important; position: relative !important; }`
      );
    }
    if (splitStoryStrategy !== 'disabled') {
      rules.push(
        `  ${sp} [data-purpose="brand-story"] .grid.lg\\:grid-cols-12 { display: grid !important; --display: grid !important; grid-template-columns: 1fr !important; gap: 20px !important; }`,
        `  ${sp} [data-purpose="brand-story"] .lg\\:col-span-4, ${sp} [data-purpose="brand-story"] .lg\\:col-span-8 { grid-column: span 1 / span 1 !important; width: 100% !important; min-width: 0 !important; }`,
        `  ${sp} [data-purpose="brand-story"] .w-48.h-48 { width: 150px !important; height: 150px !important; aspect-ratio: 1 / 1 !important; margin: 0 auto !important; }`,
        `  ${sp} [data-purpose="brand-story"] .grid-cols-3 { display: grid !important; --display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; width: 100% !important; }`
      );
    }
    rules.push(
      `  ${sp} [data-purpose="newsletter-club"] form { display: flex !important; flex-direction: column !important; gap: 10px !important; width: 100% !important; }`,
      `  ${sp} [data-purpose="newsletter-club"] form input, ${sp} [data-purpose="newsletter-club"] form button { width: 100% !important; }`
    );
    if (trustStrategy !== 'disabled') {
      const trustCols = trustStrategy === 'grid-2col' ? 'repeat(2, minmax(0, 1fr))' : '1fr';
      rules.push(
        `  ${sp} footer[data-purpose="main-footer"] > div > .grid:first-child { display: grid !important; --display: grid !important; grid-template-columns: ${trustCols} !important; gap: 12px !important; }`,
        `  ${sp} footer[data-purpose="main-footer"] > div > .grid:first-child > div { display: flex !important; --display: flex !important; flex-direction: row !important; --flex-direction: row !important; align-items: center !important; gap: 12px !important; width: 100% !important; }`,
        `  ${sp} footer[data-purpose="main-footer"] > div > .grid:first-child .w-12.h-12 { width: 44px !important; height: 44px !important; aspect-ratio: 1 / 1 !important; flex-shrink: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; }`
      );
    }
    if (footerStrategy !== 'disabled') {
      rules.push(
        `  ${sp} footer[data-purpose="main-footer"] > div > .grid.lg\\:grid-cols-12 { display: grid !important; --display: grid !important; grid-template-columns: 1fr !important; gap: 24px !important; }`,
        `  ${sp} footer[data-purpose="main-footer"] > div > .grid.lg\\:grid-cols-12 > div { grid-column: span 1 / span 1 !important; width: 100% !important; }`,
        `  ${sp} footer[data-purpose="main-footer"] > div > div:last-child { display: flex !important; --display: flex !important; flex-direction: column !important; --flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 10px !important; }`
      );
    }
  }

  rules.push(`}`);

  return {
    detectedPatterns,
    mobileCssRules: [rules.join('\n')],
  };
}
