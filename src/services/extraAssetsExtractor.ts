// ===== IMPORTS & DEPENDENCIES =====
import {
  ConverterSettings,
  ElementorNode,
  ElementorTemplateJSON,
  ExtractedSvgAsset,
  WrapperReconstructionSpec,
} from '../types/elementor';
import { synthesizeTailwindStylesheet } from './tailwindSandboxHelper';

// ===== TYPES & INTERFACES =====
export interface ExtractedExtraAssets {
  extraCss: string;
  extraJs: string;
  extractedCssRulesCount: number;
  extractedJsBlocksCount: number;
  fontFaceFiles: string[];
  extraCssItems: string[];
  extraJsItems: string[];
}

// ===== UTILITY FUNCTIONS =====

function isMultiColorSvgMarkup(svgMarkup: string): boolean {
  if (/data-el-multicolor-svg=["']1["']/i.test(svgMarkup)) return true;
  if (/(<linearGradient|<radialGradient|url\(#)/i.test(svgMarkup)) return true;
  const colorMatches =
    svgMarkup.match(
      /\b(?:fill|stroke)=["'](#[0-9a-fA-F]{3,8}|rgba?\([^"']+\))["']/gi
    ) || [];
  const distinctColors = new Set(
    colorMatches.map((m) =>
      m
        .replace(/^(?:fill|stroke)=["']/i, '')
        .replace(/["']$/, '')
        .toLowerCase()
    )
  );
  return distinctColors.size > 1;
}

function collectCustomAttrsMap(
  nodes: ElementorNode[],
  out: Record<string, Record<string, string>> = {}
): Record<string, Record<string, string>> {
  for (const node of nodes) {
    const customAttrs = node.settings?._custom_attrs as
      | Record<string, string>
      | undefined;
    if (
      node.id &&
      customAttrs &&
      typeof customAttrs === 'object' &&
      Object.keys(customAttrs).length > 0
    ) {
      out[node.id] = customAttrs;
    }
    if (node.elements && node.elements.length > 0) {
      collectCustomAttrsMap(node.elements, out);
    }
  }
  return out;
}

/**
 * Splits a CSS stylesheet into top-level blocks (rules, @keyframes, @media, @supports, @font-face)
 * while respecting nested braces, strings, and comments.
 */
function splitTopLevelCssBlocks(cssText: string): string[] {
  const blocks: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inComment = false;

  for (let i = 0; i < cssText.length; i++) {
    const ch = cssText[i];
    const next = cssText[i + 1] || '';

    if (inComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += '/';
        i++;
        inComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === '/' && next === '*') {
      inComment = true;
      current += '/*';
      i++;
      continue;
    }

    if (ch === "'" && !inDoubleQuote && cssText[i - 1] !== '\\') {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote && cssText[i - 1] !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '{') {
        depth++;
        current += ch;
        continue;
      }
      if (ch === '}') {
        depth = Math.max(0, depth - 1);
        current += ch;
        if (depth === 0) {
          const trimmed = current.trim();
          if (trimmed) blocks.push(trimmed);
          current = '';
        }
        continue;
      }
      if (ch === ';' && depth === 0) {
        current += ch;
        const trimmed = current.trim();
        if (trimmed) blocks.push(trimmed);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) blocks.push(tail);
  return blocks;
}

/**
 * Splits a selector list by top-level commas only (ignoring commas inside parentheses like :is(...), :where(...), :not(...))
 * and strips CSS comments so selectors are never corrupted.
 */
function splitSelectorGroupTopLevel(selectorGroup: string): string[] {
  const cleaned = selectorGroup.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }

  const tail = current.trim();
  if (tail) result.push(tail);
  return result;
}

/**
 * Scopes a CSS selector list with the page isolation prefix (e.g., `.elementor-gilaclick-faq`)
 * while preserving any root wrapper classes (like `.gf-page`, `.ga-page`, `.gc-page`, `.gs-page`)
 * verbatim so complex selectors (`:is(...)`, `::before`, `::after`, `::placeholder`, `::marker`)
 * are 100% valid W3C CSS and never corrupted.
 */
function scopeSelectorList(
  selectorGroup: string,
  scopeClass: string,
  rootPageClasses: string[]
): string {
  const parts = splitSelectorGroupTopLevel(selectorGroup);
  const isGenericEconRule =
    selectorGroup.includes('.e-con') &&
    parts.every((p) => p.endsWith('.e-con') || p.endsWith('.e-con-inner'));

  return parts
    .map((rawSel) => {
      // Adapt selectors targeting .elementor-widget-html, inline svg, button, anchor, ul/ol/li, h1, details, or summary
      // Use :where(...) for tag-level selectors so their specificity stays (0,0,0) and NEVER overrides class selectors like .btn-primary, .nav-link, .brand, or .demo-tab!
      const sel = rawSel
        .replace(
          /\.elementor-widget-html\b/g,
          ':where(.elementor-widget-html, .el-svg-widget)'
        )
        .replace(
          /\[aria-current=["']?(page|true)["']?\]/gi,
          ':where([aria-current="page"], [aria-current="true"], .el-aria-current-page)'
        )
        .replace(
          /(^|[\s>+~(])svg(?=($|[\s>+~),.:[#]))/g,
          '$1:where(svg, img.el-svg-img)'
        )
        .replace(
          /(^|[\s>+~(])button(?=($|[\s>+~),.:[#]))/g,
          '$1:where(button, .el-tag-button)'
        )
        .replace(
          /(^|[\s>+~(])a(?=($|[\s>+~),.:[#]))/g,
          '$1:where(a:not(.elementor-button), .el-tag-a)'
        )
        .replace(
          /(^|[\s>+~(])ul(?=($|[\s>+~),.:[#]))/g,
          '$1:where(ul, .el-tag-ul)'
        )
        .replace(
          /(^|[\s>+~(])ol(?=($|[\s>+~),.:[#]))/g,
          '$1:where(ol, .el-tag-ol)'
        )
        .replace(
          /(^|[\s>+~(])li(?=($|[\s>+~),.:[#]))/g,
          '$1:where(li, .el-tag-li)'
        )
        .replace(
          /(^|[\s>+~(])h1(?=($|[\s>+~),.:[#]))/g,
          '$1:where(h1, .el-tag-h1)'
        )
        .replace(
          /(^|[\s>+~])details(?=($|[\s>+~),.:[#]))/g,
          '$1:where(details:not(.elementor-accordion-item), .el-native-accordion:not(.gf-item))'
        )
        .replace(
          /(^|[\s>+~])summary(?=($|[\s>+~),.:[#]))/g,
          '$1:where(summary:not(.elementor-tab-title), .el-native-accordion:not(.gf-item) .elementor-tab-title)'
        );

      if (
        sel.startsWith('@') ||
        sel === ':root' ||
        sel === 'html' ||
        sel === 'body'
      ) {
        if (sel === ':root') return `:root, .${scopeClass}`;
        if (sel === 'html' || sel === 'body') {
          return `.${scopeClass}.${scopeClass}.${scopeClass}`;
        }
        return sel;
      }

      // Handle root theme attribute selectors like `[data-theme="dark"]` or `[data-theme="dark"] .site-header`
      if (/^\[data-theme[^\]]*\]$/i.test(sel)) {
        return `${sel}, ${sel} .${scopeClass}, .${scopeClass}${sel}`;
      }
      const themePrefixMatch = sel.match(/^(\[data-theme[^\]]*\])\s+([\s\S]+)$/i);
      if (themePrefixMatch) {
        return `${themePrefixMatch[1]} .${scopeClass}.${scopeClass}.${scopeClass} ${themePrefixMatch[2]}, .${scopeClass}.${scopeClass}.${scopeClass}${themePrefixMatch[1]} ${themePrefixMatch[2]}`;
      }

      if (
        sel === '*' ||
        sel === '*::before' ||
        sel === '*::after' ||
        sel === '::before' ||
        sel === '::after'
      ) {
        return `:where(.${scopeClass}) ${sel}`;
      }

      // Check if selector matches or contains any root page class (e.g. .gf-page, .ga-page, .gc-page)
      for (const rpc of rootPageClasses) {
        const dotRpc = `.${rpc}`;
        if (sel === dotRpc || sel === `${dotRpc}${dotRpc}`) {
          return `:root, .${scopeClass}, ${dotRpc}, .${scopeClass}${dotRpc}`;
        }
        if (sel.includes(dotRpc)) {
          if (isGenericEconRule) {
            return sel;
          }
          // Boost specificity so author rules always beat Elementor's post-<id>.css (.elementor-123 .elementor-element.elementor-element-abc)
          return `${sel}, .${scopeClass}.${scopeClass} ${sel}`;
        }
      }

      if (sel.includes(`.${scopeClass}`)) return sel;

      // If selector starts with body/html (e.g. body::before, body.admin-bar ..., html:focus-within), keep it and add exact scoped equivalent
      if (/^(html|body)\b/i.test(sel)) {
        const replaced = sel.replace(
          /^(html|body)(\.[a-zA-Z0-9_-]+)?/i,
          `.${scopeClass}.${scopeClass}.${scopeClass}$2`
        );
        return replaced && replaced !== sel
          ? `${sel}, ${replaced}`
          : `${sel}, .${scopeClass}.${scopeClass}.${scopeClass}`;
      }

      // Prefix with .scopeClass.scopeClass.scopeClass ((0,3,0) + selector = at least (0,4,0))
      // so author rules ALWAYS override WordPress Elementor's per-element .elementor-<post> .elementor-element.elementor-element-<id> ((0,3,0))
      return `.${scopeClass}.${scopeClass}.${scopeClass} ${sel}`;
    })
    .join(', ');
}

/**
 * Synchronizes standard CSS `display` and `flex-direction` declarations with WordPress Elementor 3.24+
 * `.e-con` custom properties (`--display`, `--flex-direction`) and ensures `display: flex` without an
 * explicit `flex-direction` defaults to `flex-direction: row` instead of Elementor's `--flex-direction: column`.
 */
function augmentCssBodyForElementorContainers(body: string): string {
  let augmented = body.trim();
  if (!augmented) return augmented;

  if (!augmented.endsWith(';')) {
    augmented += ';';
  }

  const extras: string[] = [];

  if (/\bdisplay\s*:\s*grid\b/i.test(augmented)) {
    extras.push('--display: grid;');
  } else if (/\bdisplay\s*:\s*inline-grid\b/i.test(augmented)) {
    extras.push('--display: inline-grid;');
  } else if (/\bdisplay\s*:\s*block\b/i.test(augmented)) {
    extras.push('--display: block;');
  } else if (/\bdisplay\s*:\s*none\b/i.test(augmented)) {
    extras.push('--display: none;');
  } else if (/\bdisplay\s*:\s*inline-flex\b/i.test(augmented)) {
    extras.push('--display: inline-flex;');
    if (!/\bflex-direction\s*:/i.test(augmented)) {
      extras.push('flex-direction: row;', '--flex-direction: row;');
    }
  } else if (/\bdisplay\s*:\s*flex\b/i.test(augmented)) {
    extras.push('--display: flex;');
    if (!/\bflex-direction\s*:/i.test(augmented)) {
      extras.push('flex-direction: row;', '--flex-direction: row;');
    }
  }

  const flexDirMatch = augmented.match(
    /\bflex-direction\s*:\s*(row-reverse|column-reverse|row|column)\b/i
  );
  if (flexDirMatch) {
    extras.push(`--flex-direction: ${flexDirMatch[1].toLowerCase()};`);
  }

  if (extras.length > 0) {
    return `${augmented} ${extras.join(' ')}`;
  }
  return body.trim();
}

/**
 * Categorizes and retains author CSS rules for `extra.css` (Requirement 4):
 * Retains 100% of custom variables, pseudo-elements, gradients, filters, transitions/animations,
 * decorative layers, AND component/layout styling so pages keep 100% of their visual design.
 */
function shouldKeepCssBlockInExtra(selector: string, body: string): {
  keep: boolean;
  category?: string;
} {
  const selLower = selector.toLowerCase();
  const bodyLower = body.toLowerCase();

  if (!bodyLower.trim()) {
    return { keep: false };
  }

  if (selLower.includes(':root') || bodyLower.includes('--')) {
    return {
      keep: true,
      category: 'متغیرهای CSS سراسری (:root و Custom Properties)',
    };
  }

  if (
    selLower.includes('::before') ||
    selLower.includes('::after') ||
    selLower.includes(':before') ||
    selLower.includes(':after')
  ) {
    return { keep: true, category: 'شبه‌عنصرهای تزئینی (::before / ::after)' };
  }

  if (
    selLower.includes(':hover') ||
    selLower.includes(':focus') ||
    selLower.includes(':active')
  ) {
    return { keep: true, category: 'حالت‌های تعاملی (:hover / :focus-visible)' };
  }

  if (
    bodyLower.includes('backdrop-filter') ||
    bodyLower.includes('-webkit-backdrop-filter') ||
    bodyLower.includes('mask-image') ||
    bodyLower.includes('-webkit-mask') ||
    bodyLower.includes('filter:')
  ) {
    return {
      keep: true,
      category: 'فیلترهای نوری و شیشه‌ای (backdrop-filter / mask / filter)',
    };
  }

  if (
    bodyLower.includes('radial-gradient') ||
    bodyLower.includes('conic-gradient') ||
    (bodyLower.match(/gradient\(/g) || []).length >= 2
  ) {
    return {
      keep: true,
      category: 'گرادیانت‌های چندلایه و شعاعی (Multi-layer Gradients)',
    };
  }

  if (bodyLower.includes('transition') || bodyLower.includes('animation')) {
    return {
      keep: true,
      category: 'انیمیشن‌ها و ترنزیشن‌های CSS (transition / animation)',
    };
  }

  if (
    bodyLower.includes('position: absolute') ||
    bodyLower.includes('position:absolute') ||
    /(aurora|particles|beam|glow|circuit|blueprint|signal|decor|trace|seam|node|spot|shade|frame)/.test(
      selLower
    )
  ) {
    return {
      keep: true,
      category: 'لایه‌های تزئینی مطلق (position: absolute / aurora / particles)',
    };
  }

  return {
    keep: true,
    category: 'استایل‌های اختصاصی اجزا و کلاس‌های قالب (Scoped Component CSS)',
  };
}

// ===== CORE BUSINESS LOGIC =====

export function extractExtraCssAndJs(
  rawHtml: string,
  settings: ConverterSettings,
  reconstructedWrappers: WrapperReconstructionSpec[] = [],
  extractedSvgs: ExtractedSvgAsset[] = [],
  templateJson?: ElementorTemplateJSON
): ExtractedExtraAssets {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const safeSlug =
    (settings.scopePrefix || settings.templateTitle || 'page')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'page';

  const scopeClass = safeSlug.startsWith('elementor-')
    ? safeSlug
    : `elementor-${safeSlug}`;

  const fontFaceBlocks: string[] = [];
  const fontFaceFiles: string[] = [];
  const rootVarBlocks: string[] = [];
  const keyframesBlocks: string[] = [];
  const scopedRuleBlocks: string[] = [];
  const mediaBlocks: string[] = [];
  const cssCategoriesSet = new Set<string>();
  let extractedCssRulesCount = 0;

  // 1. Collect all <style> contents + synthesized Tailwind utilities (if Tailwind CDN is used)
  const styleElements = Array.from(doc.querySelectorAll('style'));
  const synthesizedTailwind = synthesizeTailwindStylesheet(doc);
  const combinedCss = [
    ...styleElements.map((s) => s.textContent || ''),
    synthesizedTailwind || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // Detect all root page classes (e.g. gf-page, ga-page, gc-page, gs-page) from DOM and CSS
  const rootPageClassSet = new Set<string>(['gf-page']);
  doc.querySelectorAll('[class*="-page"]').forEach((el) => {
    Array.from(el.classList).forEach((cls) => {
      if (
        cls.endsWith('-page') &&
        !cls.startsWith('elementor-') &&
        cls !== 'page'
      ) {
        rootPageClassSet.add(cls);
      }
    });
  });
  const cssPageMatches = combinedCss.match(/\.[a-z0-9_-]+-page\b/gi) || [];
  for (const m of cssPageMatches) {
    const cls = m.slice(1);
    if (!cls.startsWith('elementor-') && cls !== 'page') {
      rootPageClassSet.add(cls);
    }
  }
  const rootPageClasses = Array.from(rootPageClassSet);

  const scopeAtRuleInnerCss = (innerCssText: string, indent = '  '): string[] => {
    const innerBlocks = splitTopLevelCssBlocks(innerCssText);
    const scopedInner: string[] = [];

    for (const ib of innerBlocks) {
      const cleanIb = ib.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!cleanIb) continue;

      if (/^@(-webkit-)?keyframes/i.test(cleanIb)) {
        scopedInner.push(`${indent}${cleanIb}`);
        extractedCssRulesCount++;
        continue;
      }

      if (/^@(media|supports|container)\b/i.test(cleanIb)) {
        const subOpen = cleanIb.indexOf('{');
        const subClose = cleanIb.lastIndexOf('}');
        if (subOpen !== -1 && subClose > subOpen) {
          const subHeader = cleanIb.slice(0, subOpen).trim();
          // Skip @supports (animation-timeline: view()) so .reveal sections below the fold never stay faded out at opacity: 0
          if (/animation-timeline\s*:\s*view\s*\(/i.test(subHeader)) {
            continue;
          }
          const subBody = cleanIb.slice(subOpen + 1, subClose).trim();
          const subScoped = scopeAtRuleInnerCss(subBody, `${indent}  `);
          if (subScoped.length > 0) {
            scopedInner.push(
              `${indent}${subHeader} {\n${subScoped.join('\n')}\n${indent}}`
            );
          }
        }
        continue;
      }

      const iOpen = cleanIb.indexOf('{');
      const iClose = cleanIb.lastIndexOf('}');
      if (iOpen !== -1 && iClose > iOpen) {
        const iSel = cleanIb.slice(0, iOpen).trim();
        const iBody = cleanIb.slice(iOpen + 1, iClose).trim();
        if (/animation-timeline\s*:\s*view\s*\(/i.test(iBody)) {
          continue;
        }
        const scopedMediaSel = scopeSelectorList(
          iSel,
          scopeClass,
          rootPageClasses
        );
        if (scopedMediaSel) {
          const augMediaBody = augmentCssBodyForElementorContainers(iBody);
          scopedInner.push(
            `${indent}${scopedMediaSel} {\n${indent}  ${augMediaBody}\n${indent}}`
          );
          extractedCssRulesCount++;
        }
      }
    }

    return scopedInner;
  };

  const topBlocks = splitTopLevelCssBlocks(combinedCss);

  for (const block of topBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Strip leading comments before checking @font-face / @keyframes / @media / @supports
    const withoutLeadingComments = trimmed
      .replace(/^(\/\*[\s\S]*?\*\/\s*)+/, '')
      .trim();
    if (!withoutLeadingComments) continue;

    // @font-face handling (Requirement 4 & 8: convert local font url to {{FONT_URL}})
    if (/^@font-face/i.test(withoutLeadingComments)) {
      // Strip all CSS comments from @font-face
      const rewrittenFontFace = withoutLeadingComments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
        .replace(
          /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
          (_full, quote, rawUrl: string) => {
            const cleanUrl = rawUrl.trim();
            if (
              cleanUrl.startsWith('data:') ||
              cleanUrl.startsWith('http://') ||
              cleanUrl.startsWith('https://') ||
              cleanUrl.startsWith('//')
            ) {
              return _full;
            }
            const fileName =
              cleanUrl.split('/').pop()?.split('?')[0]?.split('#')[0] ||
              'custom-font.woff2';
            if (!fontFaceFiles.includes(fileName)) {
              fontFaceFiles.push(fileName);
            }
            const q = quote || "'";
            return `url(${q}{{FONT_URL}}/${fileName}${q})`;
          }
        );
      fontFaceBlocks.push(rewrittenFontFace);
      extractedCssRulesCount++;
      cssCategoriesSet.add('تعاریف فونت (@font-face) با مسیر {{FONT_URL}}');
      continue;
    }

    // @keyframes handling
    if (/^@(-webkit-)?keyframes/i.test(withoutLeadingComments)) {
      keyframesBlocks.push(
        withoutLeadingComments.replace(/\/\*[\s\S]*?\*\//g, '').trim()
      );
      extractedCssRulesCount++;
      cssCategoriesSet.add('انیمیشن‌های کلیدی (@keyframes)');
      continue;
    }

    // @media / @supports / @container handling
    if (/^@(media|supports|container)\b/i.test(withoutLeadingComments)) {
      const openBraceIdx = withoutLeadingComments.indexOf('{');
      const closeBraceIdx = withoutLeadingComments.lastIndexOf('}');
      if (openBraceIdx !== -1 && closeBraceIdx > openBraceIdx) {
        const mediaHeader = withoutLeadingComments
          .slice(0, openBraceIdx)
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .trim();
        if (/animation-timeline\s*:\s*view\s*\(/i.test(mediaHeader)) {
          continue;
        }
        const innerCss = withoutLeadingComments
          .slice(openBraceIdx + 1, closeBraceIdx)
          .trim();
        const scopedInner = scopeAtRuleInnerCss(innerCss, '  ');

        if (scopedInner.length > 0) {
          mediaBlocks.push(`${mediaHeader} {\n${scopedInner.join('\n')}\n}`);
          cssCategoriesSet.add('قوانین واکنش‌گرا (@media / @supports)');
        }
      }
      continue;
    }

    // Standard rule block: selector { body }
    const openIdx = withoutLeadingComments.indexOf('{');
    const closeIdx = withoutLeadingComments.lastIndexOf('}');
    if (openIdx !== -1 && closeIdx > openIdx) {
      const selector = withoutLeadingComments
        .slice(0, openIdx)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const body = withoutLeadingComments
        .slice(openIdx + 1, closeIdx)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

      const decision = shouldKeepCssBlockInExtra(selector, body);
      if (decision.keep) {
        if (decision.category) cssCategoriesSet.add(decision.category);
        const scopedSel = scopeSelectorList(
          selector,
          scopeClass,
          rootPageClasses
        );
        if (!scopedSel) continue;
        const augBody = augmentCssBodyForElementorContainers(body);
        const formattedRule = `${scopedSel} {\n  ${augBody}\n}`;
        const isRootVarRule =
          selector.includes(':root') ||
          rootPageClasses.some(
            (rpc) =>
              selector.trim() === `.${rpc}` ||
              selector.trim() === `.${rpc}.${rpc}`
          );
        if (isRootVarRule) {
          rootVarBlocks.push(formattedRule);
        } else {
          scopedRuleBlocks.push(formattedRule);
        }
        extractedCssRulesCount++;
      }
    }
  }

  // Collect external <link rel="stylesheet"> from <head> (e.g. Google Fonts, Material Symbols, FontAwesome)
  const externalCssImports: string[] = [];
  doc.querySelectorAll('head link[rel="stylesheet"]').forEach((linkEl) => {
    const href = (linkEl.getAttribute('href') || '').trim();
    if (
      href &&
      (href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//'))
    ) {
      externalCssImports.push(`@import url("${href}");`);
    }
  });

  // Exact SVG icon rules for native icon-box and button widgets so the exact original SVG icon renders in both Elementor Editor & frontend
  // and dynamically inherits currentColor on :hover without ever showing FontAwesome fallback icons or solid fills
  const exactSvgIconCssRules: string[] = [];
  extractedSvgs.forEach((svgAsset) => {
    const cls = `el-svg-icon-${svgAsset.id}`;
    const w = svgAsset.widthPx || 20;
    const h = svgAsset.heightPx || 20;
    const isMultiColor = isMultiColorSvgMarkup(svgAsset.svgContent);
    exactSvgIconCssRules.push(
      `.${scopeClass} .${cls}.elementor-widget-icon-box .elementor-icon > i, .${scopeClass} .${cls}.elementor-widget-icon-box .elementor-icon > svg.e-font-icon-svg, .${scopeClass} .${cls}.elementor-widget-button .elementor-button-icon > i, .${scopeClass} .${cls}.elementor-widget-button .elementor-button-icon > svg.e-font-icon-svg { display: none !important; }`,
      isMultiColor
        ? `.${scopeClass} .${cls}.elementor-widget-icon-box .elementor-icon:not(:has(> svg[data-el-exact-svg="1"])), .${scopeClass} .${cls}.elementor-widget-button .elementor-button-icon:not(:has(> svg[data-el-exact-svg="1"])) { display: inline-block !important; width: ${w}px !important; height: ${h}px !important; background: url("${svgAsset.dataUrl}") no-repeat center / contain !important; background-color: transparent !important; -webkit-mask: none !important; mask: none !important; vertical-align: middle !important; flex-shrink: 0 !important; }`
        : `.${scopeClass} .${cls}.elementor-widget-icon-box .elementor-icon:not(:has(> svg[data-el-exact-svg="1"])), .${scopeClass} .${cls}.elementor-widget-button .elementor-button-icon:not(:has(> svg[data-el-exact-svg="1"])) { display: inline-block !important; width: ${w}px !important; height: ${h}px !important; -webkit-mask: url("${svgAsset.dataUrl}") no-repeat center / contain !important; mask: url("${svgAsset.dataUrl}") no-repeat center / contain !important; background-color: currentColor !important; vertical-align: middle !important; flex-shrink: 0 !important; }`,
      `.${scopeClass} .${cls}.elementor-widget-icon-box .elementor-icon > svg[data-el-exact-svg="1"], .${scopeClass} .${cls}.elementor-widget-button .elementor-button-icon > svg[data-el-exact-svg="1"] { display: block !important; width: ${w}px !important; height: ${h}px !important; flex-shrink: 0 !important; }`
    );
  });

  // Add zero-interference Elementor reset rules so Elementor's default section/column/container/widget wrappers
  // never alter the original HTML paddings, widths, CSS grids, sticky bars, or button styles
  const rootSelectorsList = [
    `.${scopeClass}`,
    ...rootPageClasses.map((c) => `.${c}`),
  ].join(', ');

  const cleanCustomFont = (settings.customFontFamily || '').trim();
  const customFontCssRules: string[] = cleanCustomFont
    ? [
        `:root, .${scopeClass} {`,
        `  --font: "${cleanCustomFont}", Tahoma, system-ui, -apple-system, sans-serif !important;`,
        `  --font-sans: "${cleanCustomFont}", Tahoma, system-ui, -apple-system, sans-serif !important;`,
        `  --font-display: "${cleanCustomFont}", Tahoma, system-ui, -apple-system, sans-serif !important;`,
        `  --e-global-typography-primary-font-family: "${cleanCustomFont}" !important;`,
        `  --e-global-typography-secondary-font-family: "${cleanCustomFont}" !important;`,
        `  --e-global-typography-text-font-family: "${cleanCustomFont}" !important;`,
        `  --e-global-typography-accent-font-family: "${cleanCustomFont}" !important;`,
        `}`,
        `.${scopeClass}.${scopeClass}.${scopeClass},`,
        `.${scopeClass}.${scopeClass}.${scopeClass} *:not(code):not(pre):not(.mono):not(.out-box):not(.mock-out):not(.tool-slug):not(.fa):not(.fas):not(.far):not(.fab):not([class*="eicon-"]),`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-heading-title,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-button,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-button-text,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-widget-text-editor,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-tab-title,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} .elementor-tab-content,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} button,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} input:not(.mono),`,
        `.${scopeClass}.${scopeClass}.${scopeClass} select,`,
        `.${scopeClass}.${scopeClass}.${scopeClass} textarea {`,
        `  font-family: "${cleanCustomFont}", Tahoma, system-ui, -apple-system, sans-serif !important;`,
        `}`,
      ]
    : [];

  scopedRuleBlocks.unshift(
    [
      ...customFontCssRules,
      `${rootSelectorsList} {`,
      `  direction: rtl;`,
      `  box-sizing: border-box;`,
      `  position: relative;`,
      `  isolation: isolate;`,
      `}`,
      `.${scopeClass}.e-con, .${scopeClass} .e-con {`,
      `  --width: auto;`,
      `  --max-width: none;`,
      `  --flex-direction: row;`,
      `  --margin-top: 0px;`,
      `  --margin-right: 0px;`,
      `  --margin-bottom: 0px;`,
      `  --margin-left: 0px;`,
      `  --padding-top: 0px;`,
      `  --padding-right: 0px;`,
      `  --padding-bottom: 0px;`,
      `  --padding-left: 0px;`,
      `  --padding-block-start: 0px;`,
      `  --padding-block-end: 0px;`,
      `  --padding-inline-start: 0px;`,
      `  --padding-inline-end: 0px;`,
      `  --gap: 0px;`,
      `  --row-gap: 0px;`,
      `  --column-gap: 0px;`,
      `  --content-width: auto;`,
      `  --container-widget-width: auto !important;`,
      `  --container-widget-flex-grow: 0 !important;`,
      `  --align-items: normal;`,
      `  min-width: 0;`,
      `  min-height: 0;`,
      `}`,
      `:where(.${scopeClass} .elementor-element.e-con-full, .${scopeClass} .elementor-element.e-con) {`,
      `  width: auto;`,
      `  max-width: none;`,
      `  margin: 0;`,
      `  padding: 0;`,
      `}`,
      `:where(.${scopeClass}) .el-block-con {`,
      `  display: block;`,
      `  --display: block;`,
      `}`,
      `.${scopeClass} .reveal {`,
      `  opacity: 1 !important;`,
      `  transform: none !important;`,
      `}`,
      `.${scopeClass} #demo-tabs, .${scopeClass} .demo-tabs {`,
      `  display: flex !important;`,
      `  --display: flex !important;`,
      `  flex-direction: row !important;`,
      `  --flex-direction: row !important;`,
      `}`,
      `.${scopeClass} .demo-panel[hidden],`,
      `.${scopeClass} .demo.is-live:not([data-el-tab-init="1"]) .demo-panel + .demo-panel {`,
      `  display: none !important;`,
      `  --display: none !important;`,
      `}`,
      `.${scopeClass} .demo-tab[aria-selected="true"],`,
      `.${scopeClass} .demo.is-live:not([data-el-tab-init="1"]) .demo-tabs > .demo-tab:first-child {`,
      `  background-image: var(--grad);`,
      `  color: #fff !important;`,
      `  box-shadow: 0 8px 18px -10px rgba(29, 78, 216, 0.7);`,
      `}`,
      `.${scopeClass} .e-con > .mx-auto {`,
      `  width: 100%;`,
      `}`,
      `:where(.${scopeClass}) :where(.elementor-widget) {`,
      `  width: auto;`,
      `  min-width: 0;`,
      `  max-width: 100%;`,
      `  margin: 0;`,
      `}`,
      `:where(.${scopeClass}) :where(.elementor-widget-container) {`,
      `  width: auto;`,
      `  margin: 0;`,
      `  padding: 0;`,
      `}`,
      `:where(.${scopeClass}) :where(.el-tag-button) {`,
      `  display: inline-flex;`,
      `  align-items: center;`,
      `  justify-content: center;`,
      `  text-align: center;`,
      `  cursor: pointer;`,
      `}`,
      `.${scopeClass} .elementor-widget.el-native-inline {`,
      `  display: inline-block;`,
      `  width: auto;`,
      `}`,
      `:where(.${scopeClass}) :where(.elementor-heading-title, p) {`,
      `  margin: 0;`,
      `  padding: 0;`,
      `  color: inherit;`,
      `  font: inherit;`,
      `  line-height: inherit;`,
      `  letter-spacing: inherit;`,
      `  text-transform: inherit;`,
      `}`,
      `.${scopeClass} .elementor-hybrid-inline-carrier {`,
      `  display: none !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-heading.el-native-heading > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget.el-native-text > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget.el-native-list,`,
      `.${scopeClass} .elementor-widget.el-native-list > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget.el-native-html,`,
      `.${scopeClass} .elementor-widget.el-native-html > .elementor-widget-container {`,
      `  display: contents;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.gf-item > .elementor-widget-container {`,
      `  display: contents !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) .elementor-accordion,`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) .elementor-accordion-item {`,
      `  display: block;`,
      `  width: 100%;`,
      `  margin: 0;`,
      `  padding: 0;`,
      `  border: 0;`,
      `  background: transparent;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) .elementor-tab-title {`,
      `  display: flex;`,
      `  align-items: center;`,
      `  justify-content: space-between;`,
      `  gap: 12px;`,
      `  width: 100%;`,
      `  cursor: pointer;`,
      `  list-style: none;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) .elementor-tab-title::-webkit-details-marker {`,
      `  display: none !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) .elementor-accordion-icon {`,
      `  display: inline-flex;`,
      `  align-items: center;`,
      `  justify-content: center;`,
      `  transition: transform 0.25s ease;`,
      `  flex-shrink: 0;`,
      `}`,
      `.${scopeClass} .elementor-widget-accordion.el-native-accordion:not(.gf-item) details.elementor-accordion-item[open] > summary .elementor-accordion-icon {`,
      `  transform: rotate(180deg);`,
      `}`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon-box-wrapper,`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon-box-icon {`,
      `  display: contents !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon {`,
      `  display: inline-flex;`,
      `  align-items: center;`,
      `  justify-content: center;`,
      `  background: transparent !important;`,
      `  background-color: transparent !important;`,
      `  padding: 0 !important;`,
      `  border: 0 !important;`,
      `  border-radius: inherit;`,
      `  color: inherit !important;`,
      `  fill: inherit;`,
      `  font-size: inherit;`,
      `  width: auto;`,
      `  height: auto;`,
      `}`,
      `:where(.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon) :where(i, svg:not([width])) {`,
      `  width: 1em;`,
      `  height: 1em;`,
      `  color: inherit !important;`,
      `}`,
      `.${scopeClass} svg[fill="none"]:not([data-el-multicolor-svg="1"]),`,
      `.${scopeClass} .elementor-icon svg[fill="none"]:not([data-el-multicolor-svg="1"]),`,
      `.${scopeClass} .elementor-button-icon svg[fill="none"]:not([data-el-multicolor-svg="1"]) {`,
      `  fill: none !important;`,
      `  stroke: currentColor !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon svg:not([fill="none"]):not([data-el-multicolor-svg="1"]),`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-icon svg:not([fill="none"]):not([data-el-multicolor-svg="1"]) {`,
      `  fill: currentColor;`,
      `}`,
      `.${scopeClass} .elementor-widget-icon-box.el-native-icon-box .elementor-icon-box-content:empty {`,
      `  display: none !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-button.el-native-btn > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-wrapper,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button:hover,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button:focus,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button:active,`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-content-wrapper {`,
      `  display: contents !important;`,
      `  color: inherit !important;`,
      `  background: transparent !important;`,
      `  background-color: transparent !important;`,
      `  border: 0 !important;`,
      `  padding: 0 !important;`,
      `  margin: 0 !important;`,
      `  box-shadow: none !important;`,
      `  font: inherit;`,
      `  text-decoration: none;`,
      `}`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-icon {`,
      `  display: inline-flex;`,
      `  align-items: center;`,
      `  justify-content: center;`,
      `  line-height: 0;`,
      `  color: inherit !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-text {`,
      `  color: inherit !important;`,
      `  font: inherit;`,
      `}`,
      `.${scopeClass} .elementor-widget-button.el-native-btn .elementor-button-text:empty {`,
      `  display: none !important;`,
      `}`,
      `.${scopeClass} .elementor-widget-image.el-native-img > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget-image.el-svg-widget > .elementor-widget-container {`,
      `  display: contents;`,
      `}`,
      `.${scopeClass} .elementor-widget-image.el-native-img img:not(.el-svg-img) {`,
      `  width: 100%;`,
      `  height: 100%;`,
      `  object-fit: inherit;`,
      `  border-radius: inherit;`,
      `  display: block;`,
      `}`,
      `.${scopeClass} img.el-svg-img {`,
      `  display: inline-block;`,
      `  vertical-align: middle;`,
      `  flex-shrink: 0;`,
      `  object-fit: contain;`,
      `}`,
      `.${scopeClass} .elementor-widget-spacer.el-decor-layer > .elementor-widget-container,`,
      `.${scopeClass} .elementor-widget-spacer.el-decor-layer .elementor-spacer,`,
      `.${scopeClass} .elementor-widget-spacer.el-decor-layer .elementor-spacer-inner {`,
      `  width: 100%;`,
      `  height: 100%;`,
      `  min-height: 0;`,
      `}`,
      `.elementor-section.el-exact-section,`,
      `.elementor-section.el-exact-section > .elementor-container,`,
      `.elementor-section.el-exact-section > .elementor-container > .elementor-column,`,
      `.elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap,`,
      `.elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap > .elementor-widget.el-exact-html-carrier,`,
      `.elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap > .elementor-widget.el-exact-html-carrier > .elementor-widget-container {`,
      `  padding: 0 !important;`,
      `  margin: 0 !important;`,
      `  max-width: 100% !important;`,
      `  width: 100% !important;`,
      `  gap: 0 !important;`,
      `}`,
      `.elementor-section.el-exact-section > .elementor-container > .elementor-column > .elementor-widget-wrap {`,
      `  display: block !important;`,
      `}`,
      `.elementor-section.el-exact-sticky-header {`,
      `  position: sticky !important;`,
      `  top: var(--gf-admin-offset, var(--ga-admin-offset, 0px)) !important;`,
      `  z-index: 80 !important;`,
      `}`,
      `.elementor-section.el-exact-sticky-controls {`,
      `  position: sticky !important;`,
      `  top: calc(var(--gf-admin-offset, 0px) + var(--gf-header-height, 0px)) !important;`,
      `  z-index: 70 !important;`,
      `}`,
      ...exactSvgIconCssRules,
    ].join('\n')
  );

  // Assemble extra.css with zero comments
  const extraCssParts: string[] = [];

  if (externalCssImports.length > 0) {
    extraCssParts.push(externalCssImports.join('\n'));
  }

  if (fontFaceBlocks.length > 0) {
    extraCssParts.push(fontFaceBlocks.join('\n\n'));
  }

  if (rootVarBlocks.length > 0) {
    extraCssParts.push(rootVarBlocks.join('\n\n'));
  }

  if (keyframesBlocks.length > 0) {
    extraCssParts.push(keyframesBlocks.join('\n\n'));
  }

  if (scopedRuleBlocks.length > 0) {
    extraCssParts.push(scopedRuleBlocks.join('\n\n'));
  }

  if (mediaBlocks.length > 0) {
    extraCssParts.push(mediaBlocks.join('\n\n'));
  }

  const extraCss = extraCssParts.join('\n\n');

  // 2. Collect behavioral JavaScript from <script> tags (Requirement 6)
  const scriptElements = Array.from(doc.querySelectorAll('script'));
  const rawScripts: string[] = [];
  const jsFeaturesSet = new Set<string>();

  for (const scriptEl of scriptElements) {
    const typeAttr = (scriptEl.getAttribute('type') || '').toLowerCase();
    if (typeAttr === 'application/ld+json' || typeAttr === 'application/json') {
      continue;
    }
    const srcAttr = scriptEl.getAttribute('src') || '';
    if (srcAttr) {
      continue;
    }
    const code = (scriptEl.textContent || '').trim();
    if (!code) continue;

    // Ensure scripts that check document.currentScript or elementor-preview work both on WordPress frontend,
    // inside Elementor preview (?elementor-preview=...), and when invoked via DOMContentLoaded
    const normalizedCode = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(
        /document\.body\.classList\.contains\(['"]elementor-editor-preview['"]\)/g,
        'false'
      )
      .replace(
        /\/\[\?&\]elementor-preview=\/\.test\(location\.search\)/g,
        'false'
      )
      .replace(
        /\bdocument\.currentScript\b/g,
        `(document.currentScript || document.getElementById('hybrid-inline-assets') || document.querySelector('.${scopeClass}') || document.body)`
      )
      .replace(
        /var\s+root\s*=\s*script\s*&&\s*script\.closest\(['"](\.[a-z0-9_-]+-page)['"]\);/gi,
        `var root = (script && script.closest("$1")) || document.querySelector(".elementor$1") || document.querySelector("$1") || document.querySelector(".${scopeClass}");`
      )
      .trim();

    if (normalizedCode) {
      rawScripts.push(normalizedCode);
    }

    if (code.includes('IntersectionObserver')) {
      jsFeaturesSet.add(
        'مشاهده‌گر اسکرول و انیمیشن ورود (IntersectionObserver)'
      );
    }
    if (code.includes('data-circuit') || code.includes('circuit')) {
      jsFeaturesSet.add('رسم پویا و انیمیشن مدارهای SVG (Circuit Renderer)');
    }
    if (
      code.includes('parallax') ||
      code.includes('scrollY') ||
      code.includes('requestAnimationFrame')
    ) {
      jsFeaturesSet.add(
        'حرکت پارالاکس و محاسبات فریم‌به‌فریم (requestAnimationFrame / Scroll)'
      );
    }
    if (code.includes('data-split') || code.includes('data-reveal')) {
      jsFeaturesSet.add(
        'انیمیشن تفکیک کلمات و آشکارسازی متون (data-split / data-reveal)'
      );
    }
    if (code.includes('hv__') || code.includes('typing')) {
      jsFeaturesSet.add('شبیه‌ساز تایپ کد و سوئیچ تب‌های پنل کد هیرو');
    }
    if (code.includes('gf-item') || code.includes('gf-search')) {
      jsFeaturesSet.add(
        'موتور آکاردئون سوالات متداول، فیلتر دسته‌بندی و جستجوی زنده (FAQ Interactive Engine)'
      );
    }
  }

  if (reconstructedWrappers.length > 0) {
    jsFeaturesSet.add(
      `بازسازی خودکار ${reconstructedWrappers.length} کانتینر میانی (DOM Wrapper Bridge) برای حفظ ۱۰۰٪ ساختار و استایل‌ها`
    );
  }

  if (extractedSvgs.length > 0) {
    jsFeaturesSet.add(
      `مدیریت و اجرای لوکال ${extractedSvgs.length} فایل SVG مجزا (assets/svg/*.svg)`
    );
  }

  const serializedRootPageClasses = JSON.stringify(rootPageClasses);
  const serializedWrapperSpecs = JSON.stringify(reconstructedWrappers);
  const customAttrsMap = templateJson?.content
    ? collectCustomAttrsMap(templateJson.content)
    : {};
  const serializedCustomAttrsMap = JSON.stringify(customAttrsMap);
  const localSvgMapObj: Record<string, string> = {};
  const inlineSvgMarkupById: Record<string, string> = {};
  extractedSvgs.forEach((svgAsset) => {
    localSvgMapObj[svgAsset.relativePath] = svgAsset.dataUrl;
    localSvgMapObj[svgAsset.fileName] = svgAsset.dataUrl;
    let cleanSvg = svgAsset.svgContent
      .replace(/<\?xml[^>]*\?>\s*/i, '')
      .trim();
    if (cleanSvg.startsWith('<svg')) {
      if (isMultiColorSvgMarkup(cleanSvg)) {
        cleanSvg = cleanSvg.replace(
          /^<svg\b/i,
          '<svg data-el-exact-svg="1" data-el-multicolor-svg="1"'
        );
      } else {
        const isStrokeIcon =
          /\bfill=["']none["']/i.test(cleanSvg) ||
          /\bstroke=["'](?!none)/i.test(cleanSvg);
        if (isStrokeIcon) {
          cleanSvg = cleanSvg
            .replace(
              /\bstroke=["']#[0-9a-fA-F]{3,8}["']/gi,
              'stroke="currentColor"'
            )
            .replace(
              /\bstroke=["']rgba?\([^"']+\)["']/gi,
              'stroke="currentColor"'
            )
            .replace(
              /^<svg\b/i,
              '<svg data-el-exact-svg="1" fill="none" stroke="currentColor" style="fill:none !important;stroke:currentColor !important;"'
            );
        } else {
          cleanSvg = cleanSvg
            .replace(/\bfill=["']#[0-9a-fA-F]{3,8}["']/gi, 'fill="currentColor"')
            .replace(/\bfill=["']rgba?\([^"']+\)["']/gi, 'fill="currentColor"')
            .replace(
              /^<svg\b/i,
              '<svg data-el-exact-svg="1" fill="currentColor" style="fill:currentColor !important;"'
            );
        }
      }
    }
    inlineSvgMarkupById[svgAsset.id] = cleanSvg;
  });
  const serializedLocalSvgMap = JSON.stringify(localSvgMapObj);
  const serializedInlineSvgById = JSON.stringify(inlineSvgMarkupById);

  // Runtime DOM bridge (with zero comments) to ensure root scope classes, custom attributes, exact SVG icons, native accordions, and intermediate wrappers exist in Elementor DOM
  const domBridgeCode = [
    `    var pageRootClasses = ${serializedRootPageClasses};`,
    `    pageRootClasses.forEach(function (rpc) {`,
    `      Array.prototype.slice.call(document.querySelectorAll('section.' + rpc + ', .hybrid-inline-assets-section.' + rpc)).forEach(function (sec) {`,
    `        sec.classList.remove(rpc);`,
    `      });`,
    `    });`,
    `    var carrier = document.getElementById('hybrid-inline-assets');`,
    `    var elRoot = (carrier && carrier.closest('.elementor')) || document.querySelector('.elementor') || document.body;`,
    `    if (elRoot) {`,
    `      elRoot.classList.add('${scopeClass}');`,
    `      pageRootClasses.forEach(function (rpc) {`,
    `        if (document.querySelector('.' + rpc)) return;`,
    `        var prefix = rpc.replace(/-page$/, '-');`,
    `        if (document.querySelector('[class*="' + prefix + '"]') || pageRootClasses.length === 1) {`,
    `          elRoot.classList.add(rpc);`,
    `        }`,
    `      });`,
    `    }`,
    `    var customAttrsMap = ${serializedCustomAttrsMap};`,
    `    Object.keys(customAttrsMap).forEach(function (elId) {`,
    `      var nodeEl = document.querySelector('.el-attr-' + elId + ', [data-id="' + elId + '"]');`,
    `      if (!nodeEl) return;`,
    `      var attrs = customAttrsMap[elId];`,
    `      Object.keys(attrs).forEach(function (attrName) {`,
    `        if (attrName === 'hidden') {`,
    `          nodeEl.setAttribute('hidden', '');`,
    `        } else {`,
    `          nodeEl.setAttribute(attrName, attrs[attrName]);`,
    `        }`,
    `      });`,
    `    });`,
    `    Array.prototype.slice.call(document.querySelectorAll('.el-tag-button a.elementor-button')).forEach(function (aEl) {`,
    `      if (aEl.getAttribute('href') === '#') {`,
    `        aEl.removeAttribute('href');`,
    `        aEl.setAttribute('role', 'button');`,
    `        aEl.tabIndex = 0;`,
    `      }`,
    `    });`,
    `    (function initWorkbenchTabsSafety() {`,
    `      var demoEl = document.getElementById('demo');`,
    `      var tabbarEl = document.getElementById('demo-tabs');`,
    `      if (!demoEl || !tabbarEl) return;`,
    `      demoEl.classList.add('is-live');`,
    `      demoEl.setAttribute('data-el-tab-init', '1');`,
    `      tabbarEl.hidden = false;`,
    `      tabbarEl.removeAttribute('hidden');`,
    `      var tabsList = Array.prototype.slice.call(tabbarEl.querySelectorAll('.demo-tab'));`,
    `      var panelsList = Array.prototype.slice.call(demoEl.querySelectorAll('.demo-panel'));`,
    `      tabsList.forEach(function (tEl, idx) {`,
    `        if (!tEl.getAttribute('data-tab') && panelsList[idx] && panelsList[idx].id) {`,
    `          tEl.setAttribute('data-tab', panelsList[idx].id);`,
    `        }`,
    `      });`,
    `    })();`,
    `    Array.prototype.slice.call(document.querySelectorAll('.gf-item.el-native-accordion')).forEach(function (gfAcc) {`,
    `      if (gfAcc.querySelector('.gf-question') && gfAcc.querySelector('.gf-answer')) return;`,
    `      var titleEl = gfAcc.querySelector('.elementor-accordion-title, .elementor-tab-title');`,
    `      var contentEl = gfAcc.querySelector('.elementor-tab-content');`,
    `      var host = gfAcc.querySelector('.elementor-widget-container') || gfAcc;`,
    `      if (titleEl && contentEl && host) {`,
    `        var qText = (titleEl.textContent || '').trim();`,
    `        var aHtml = contentEl.innerHTML || '';`,
    `        host.innerHTML = '<div class="elementor-widget elementor-widget-heading gf-question"><div class="elementor-widget-container"><h3 class="elementor-heading-title">' + qText + '</h3></div></div><div class="elementor-widget elementor-widget-text-editor gf-answer"><div class="elementor-widget-container">' + aHtml + '</div></div>';`,
    `      }`,
    `    });`,
    `    var localSvgAssets = ${serializedLocalSvgMap};`,
    `    Array.prototype.slice.call(document.querySelectorAll('img.el-svg-img, img[src^="assets/svg/"], img[data-local-svg-asset]')).forEach(function (imgEl) {`,
    `      var rawSrc = (imgEl.getAttribute('data-local-svg-asset') || imgEl.getAttribute('src') || '').trim();`,
    `      var fileName = rawSrc.split('/').pop() || '';`,
    `      var fallbackDataUrl = imgEl.getAttribute('data-svg-fallback') || localSvgAssets[rawSrc] || localSvgAssets[fileName];`,
    `      if (!fallbackDataUrl) return;`,
    `      imgEl.addEventListener('error', function () {`,
    `        if (imgEl.getAttribute('src') !== fallbackDataUrl) {`,
    `          imgEl.setAttribute('src', fallbackDataUrl);`,
    `        }`,
    `      }, { once: true });`,
    `      var currentSrc = (imgEl.getAttribute('src') || '').trim();`,
    `      if ((imgEl.complete && imgEl.naturalWidth === 0) || currentSrc.indexOf('placeholder.png') !== -1) {`,
    `        imgEl.setAttribute('src', fallbackDataUrl);`,
    `      }`,
    `    });`,
    `    var svgMarkupById = ${serializedInlineSvgById};`,
    `    Object.keys(svgMarkupById).forEach(function (svgId) {`,
    `      var rawSvg = svgMarkupById[svgId];`,
    `      if (!rawSvg) return;`,
    `      Array.prototype.slice.call(document.querySelectorAll('.el-svg-icon-' + svgId + ' .elementor-icon, .el-svg-icon-' + svgId + ' .elementor-button-icon')).forEach(function (iconHost) {`,
    `        if (!iconHost.querySelector('svg[data-el-exact-svg="1"]')) {`,
    `          iconHost.innerHTML = rawSvg;`,
    `        }`,
    `      });`,
    `    });`,
    `    var wrapperSpecs = ${serializedWrapperSpecs};`,
    `    wrapperSpecs.forEach(function (spec) {`,
    `      if (!spec || !spec.childIds || spec.childIds.length === 0) return;`,
    `      if (spec.id && document.getElementById(spec.id)) return;`,
    `      var childNodes = [];`,
    `      for (var i = 0; i < spec.childIds.length; i++) {`,
    `        var cid = spec.childIds[i];`,
    `        var found = document.querySelector('.el-attr-' + cid + ', [data-id="' + cid + '"]');`,
    `        if (found && childNodes.indexOf(found) === -1) {`,
    `          childNodes.push(found);`,
    `        }`,
    `      }`,
    `      if (childNodes.length === 0) return;`,
    `      var firstNode = childNodes[0];`,
    `      var parent = firstNode.parentNode;`,
    `      if (!parent) return;`,
    `      var sameParentNodes = childNodes.filter(function (n) { return n.parentNode === parent; });`,
    `      if (sameParentNodes.length === 0) return;`,
    `      if (parent.tagName && parent.tagName.toLowerCase() === (spec.tag || 'div').toLowerCase() && spec.className && parent.className.trim() === spec.className.trim()) {`,
    `        if (spec.id && !parent.id) parent.id = spec.id;`,
    `        parent.setAttribute('data-id', spec.wrapperId);`,
    `        return;`,
    `      }`,
    `      var wrapperEl = document.createElement(spec.tag || 'div');`,
    `      if (spec.id) wrapperEl.id = spec.id;`,
    `      if (spec.className) wrapperEl.className = spec.className;`,
    `      wrapperEl.setAttribute('data-id', spec.wrapperId);`,
    `      parent.insertBefore(wrapperEl, sameParentNodes[0]);`,
    `      sameParentNodes.forEach(function (n) {`,
    `        wrapperEl.appendChild(n);`,
    `      });`,
    `    });`,
    `    (function initWorkflowStepBridge() {`,
    `      var wfSteps = Array.prototype.slice.call(document.querySelectorAll('.wf-step'));`,
    `      var wfScenes = Array.prototype.slice.call(document.querySelectorAll('.wf-scene'));`,
    `      var wfDots = Array.prototype.slice.call(document.querySelectorAll('#wf-dots i'));`,
    `      if (!wfSteps.length || !wfScenes.length) return;`,
    `      wfSteps.forEach(function (s, idx) {`,
    `        if (!s.hasAttribute('data-step')) s.setAttribute('data-step', String(idx));`,
    `      });`,
    `      wfScenes.forEach(function (sc, idx) {`,
    `        if (!sc.hasAttribute('data-scene')) sc.setAttribute('data-scene', String(idx));`,
    `      });`,
    `      function activateWfStep(idx) {`,
    `        wfSteps.forEach(function (s, j) { s.classList.toggle('is-active', j === idx); });`,
    `        wfScenes.forEach(function (sc, j) { sc.classList.toggle('is-active', j === idx); });`,
    `        wfDots.forEach(function (d, j) {`,
    `          d.classList.toggle('on', j === idx);`,
    `          d.classList.toggle('is-on', j === idx);`,
    `        });`,
    `      }`,
    `      wfSteps.forEach(function (stepEl, idx) {`,
    `        stepEl.style.cursor = 'pointer';`,
    `        stepEl.addEventListener('click', function () { activateWfStep(idx); });`,
    `        stepEl.addEventListener('mouseenter', function () { activateWfStep(idx); });`,
    `      });`,
    `      wfDots.forEach(function (dotEl, idx) {`,
    `        dotEl.style.cursor = 'pointer';`,
    `        dotEl.addEventListener('click', function () { activateWfStep(idx); });`,
    `      });`,
    `      function syncWorkflowOnScroll() {`,
    `        var vh = window.innerHeight || document.documentElement.clientHeight || 800;`,
    `        var center = vh * 0.5;`,
    `        var bestIdx = -1;`,
    `        var bestDist = Infinity;`,
    `        wfSteps.forEach(function (s, idx) {`,
    `          var r = s.getBoundingClientRect();`,
    `          if (r.bottom > 0 && r.top < vh) {`,
    `            var mid = (r.top + r.bottom) * 0.5;`,
    `            var dist = Math.abs(mid - center);`,
    `            if (dist < bestDist) { bestDist = dist; bestIdx = idx; }`,
    `          }`,
    `        });`,
    `        if (bestIdx !== -1 && bestDist < vh * 0.48) {`,
    `          activateWfStep(bestIdx);`,
    `        }`,
    `      }`,
    `      window.addEventListener('scroll', syncWorkflowOnScroll, { passive: true });`,
    `      window.addEventListener('message', function (ev) {`,
    `        if (ev && ev.data && ev.data.type === 'EL_SIM_PARENT_SCROLL') {`,
    `          var pScrollTop = Number(ev.data.scrollTop || 0);`,
    `          var pVh = Number(ev.data.viewportHeight || 800);`,
    `          var targetCenterY = pScrollTop + pVh * 0.5;`,
    `          var bestIdx = -1;`,
    `          var bestDist = Infinity;`,
    `          wfSteps.forEach(function (s, idx) {`,
    `            var r = s.getBoundingClientRect();`,
    `            var absMid = r.top + window.scrollY + r.height * 0.5;`,
    `            var dist = Math.abs(absMid - targetCenterY);`,
    `            if (dist < bestDist) { bestDist = dist; bestIdx = idx; }`,
    `          });`,
    `          if (bestIdx !== -1 && bestDist < pVh * 0.65) {`,
    `            activateWfStep(bestIdx);`,
    `          }`,
    `          var wfGrid = document.querySelector('.wf-grid');`,
    `          var wfSticky = document.querySelector('.wf-sticky');`,
    `          if (wfGrid && wfSticky && window.innerWidth > 960) {`,
    `            var gRect = wfGrid.getBoundingClientRect();`,
    `            var sRect = wfSticky.getBoundingClientRect();`,
    `            var gTop = gRect.top + window.scrollY;`,
    `            var maxOffset = Math.max(0, gRect.height - sRect.height);`,
    `            var desiredOffset = Math.min(maxOffset, Math.max(0, pScrollTop + 96 - gTop));`,
    `            wfSticky.style.transform = desiredOffset > 0 ? 'translateY(' + Math.round(desiredOffset) + 'px)' : '';`,
    `          } else if (wfSticky) {`,
    `            wfSticky.style.transform = '';`,
    `          }`,
    `        }`,
    `      });`,
    `    })();`,
  ].join('\n');

  const extraJs = [
    `(function () {`,
    `  'use strict';`,
    `  function initHybridElementorBehaviors() {`,
    `    window.__elHybridInitRan = true;`,
    `    try {`,
    domBridgeCode,
    ...rawScripts.map((s) =>
      s
        .split('\n')
        .map((line) => `      ${line}`)
        .join('\n')
    ),
    `    } catch (err) {`,
    `      console.warn('[Elementor Hybrid Extra JS]:', err);`,
    `    }`,
    `  }`,
    `  if (document.readyState === 'loading') {`,
    `    document.addEventListener('DOMContentLoaded', initHybridElementorBehaviors);`,
    `  } else {`,
    `    initHybridElementorBehaviors();`,
    `  }`,
    `})();`,
  ].join('\n');

  return {
    extraCss,
    extraJs,
    extractedCssRulesCount,
    extractedJsBlocksCount: Math.max(
      rawScripts.length,
      reconstructedWrappers.length > 0 ? 1 : 0
    ),
    fontFaceFiles,
    extraCssItems: Array.from(cssCategoriesSet),
    extraJsItems: Array.from(jsFeaturesSet),
  };
}
