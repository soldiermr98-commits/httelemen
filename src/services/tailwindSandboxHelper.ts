// ===== CONFIGURATION & CONSTANTS =====

export const MATERIAL_ICON_TO_FA_MAP: Record<string, string> = {
  deployed_code: 'fas fa-cube',
  phone_in_talk: 'fas fa-phone-alt',
  arrow_left_alt: 'fas fa-arrow-left',
  arrow_back: 'fas fa-arrow-left',
  arrow_forward: 'fas fa-arrow-right',
  spark: 'fas fa-magic',
  auto_awesome: 'fas fa-magic',
  play_circle: 'fas fa-play-circle',
  lock: 'fas fa-lock',
  rocket_launch: 'fas fa-rocket',
  rocket: 'fas fa-rocket',
  diamond: 'fas fa-gem',
  hub: 'fas fa-network-wired',
  token: 'fas fa-coins',
  cloud: 'fas fa-cloud',
  bolt: 'fas fa-bolt',
  shield: 'fas fa-shield-alt',
  layers: 'fas fa-layer-group',
  domain: 'fas fa-building',
  check_circle: 'fas fa-check-circle',
  check: 'fas fa-check',
  shopping_cart: 'fas fa-shopping-cart',
  code: 'fas fa-code',
  palette: 'fas fa-palette',
  speed: 'fas fa-tachometer-alt',
  support_agent: 'fas fa-headset',
  verified: 'fas fa-check-circle',
  verified_user: 'fas fa-user-shield',
  design_services: 'fas fa-pencil-ruler',
  lock_reset: 'fas fa-sync-alt',
  cancel: 'fas fa-times-circle',
  warning: 'fas fa-exclamation-triangle',
  gpp_bad: 'fas fa-shield-virus',
  content_copy: 'fas fa-copy',
  headset_off: 'fas fa-phone-slash',
  star: 'fas fa-star',
  trending_up: 'fas fa-chart-line',
  visibility: 'fas fa-eye',
  search_insights: 'fas fa-search-plus',
  draw: 'fas fa-pen-nib',
  terminal: 'fas fa-terminal',
  price_check: 'fas fa-tags',
  calculate: 'fas fa-calculator',
  send: 'fas fa-paper-plane',
  expand_more: 'fas fa-chevron-down',
  alternate_email: 'fas fa-at',
  share: 'fas fa-share-alt',
  location_on: 'fas fa-map-marker-alt',
  call: 'fas fa-phone',
  mail: 'fas fa-envelope',
};

const DEFAULT_TAILWIND_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'amber-400': '#fbbf24',
  'yellow-400': '#facc15',
  'indigo-400': '#818cf8',
  'sky-500': '#0ea5e9',
  'slate-900': '#0f172a',
  'slate-800': '#1e293b',
};

const SPACING_SCALE_PX: Record<string, number> = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
  '28': 112,
  '32': 128,
  '36': 144,
  '40': 160,
  '44': 176,
  '48': 192,
  '52': 208,
  '56': 224,
  '60': 240,
  '64': 256,
  '72': 288,
  '80': 320,
  '96': 384,
};

// ===== UTILITY FUNCTIONS =====

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

function escapeCssClassName(cls: string): string {
  return cls.replace(/([!:[\]/().%#-])/g, '\\$1');
}

/**
 * Extracts custom colors and font sizes from inline `tailwind.config = { ... }` script blocks
 * and synthesizes a deterministic CSS stylesheet so `getComputedStyle` and `extra.css`
 * work immediately with 100% dimensional accuracy without external CDN scripts.
 */
export function synthesizeTailwindStylesheet(doc: Document): string {
  const scripts = Array.from(doc.querySelectorAll('script'));
  const hasTailwindCdn = scripts.some(
    (s) =>
      (s.getAttribute('src') || '').includes('tailwindcss') ||
      (s.textContent || '').includes('tailwind.config')
  );

  const customColors: Record<string, string> = { ...DEFAULT_TAILWIND_COLORS };
  const customFontSizes: Record<
    string,
    {
      fontSize: string;
      lineHeight?: string;
      fontWeight?: string;
      letterSpacing?: string;
    }
  > = {
    xs: { fontSize: '12px', lineHeight: '16px' },
    sm: { fontSize: '14px', lineHeight: '20px' },
    base: { fontSize: '16px', lineHeight: '24px' },
    lg: { fontSize: '18px', lineHeight: '28px' },
    xl: { fontSize: '20px', lineHeight: '28px' },
    '2xl': { fontSize: '24px', lineHeight: '32px' },
    '3xl': { fontSize: '30px', lineHeight: '36px' },
    '4xl': { fontSize: '36px', lineHeight: '40px' },
    '5xl': { fontSize: '48px', lineHeight: '52px' },
  };

  for (const script of scripts) {
    const txt = script.textContent || '';
    if (!txt.includes('tailwind.config')) continue;

    // Extract hex color definitions: "primary": "#b7c4ff"
    const colorRegex =
      /["']([a-zA-Z0-9_-]+)["']\s*:\s*["'](#[0-9a-fA-F]{3,8})["']/g;
    let match: RegExpExecArray | null;
    while ((match = colorRegex.exec(txt)) !== null) {
      customColors[match[1]] = match[2];
    }

    // Extract custom fontSize entries: "display": ["56px", { "lineHeight": "68px", ... }]
    const fontRegex =
      /["']([a-zA-Z0-9_-]+)["']\s*:\s*\[\s*["'](\d+px)["']\s*,\s*\{([^}]+)\}\s*\]/g;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = fontRegex.exec(txt)) !== null) {
      const key = fMatch[1];
      const sizePx = fMatch[2];
      const meta = fMatch[3];
      const lhMatch = meta.match(/["']?lineHeight["']?\s*:\s*["']([^"']+)["']/);
      const fwMatch = meta.match(/["']?fontWeight["']?\s*:\s*["']([^"']+)["']/);
      const lsMatch = meta.match(
        /["']?letterSpacing["']?\s*:\s*["']([^"']+)["']/
      );
      customFontSizes[key] = {
        fontSize: sizePx,
        lineHeight: lhMatch ? lhMatch[1] : undefined,
        fontWeight: fwMatch ? fwMatch[1] : undefined,
        letterSpacing: lsMatch ? lsMatch[1] : undefined,
      };
    }
  }

  // Collect all unique classes used in the document
  const allClasses = new Set<string>();
  doc.querySelectorAll('[class]').forEach((el) => {
    el.classList.forEach((c) => allClasses.add(c));
  });

  if (!hasTailwindCdn && !allClasses.has('grid') && !allClasses.has('flex')) {
    return '';
  }

  const baseRules: string[] = [
    `*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; }`,
    `body { margin: 0; }`,
  ];
  const smRules: string[] = [];
  const mdRules: string[] = [];
  const lgRules: string[] = [];

  const resolveColorValue = (token: string): string | null => {
    const [colorName, alphaPart] = token.split('/');
    const baseHex = customColors[colorName];
    if (!baseHex) return null;
    if (!alphaPart) return baseHex;
    const alphaNum = parseFloat(alphaPart);
    if (Number.isFinite(alphaNum)) {
      return hexToRgba(baseHex, alphaNum / 100);
    }
    return baseHex;
  };

  const resolvePositionOffset = (val: string, isNeg: boolean): string | null => {
    if (val === '0') return '0px';
    if (val === '1/2') return isNeg ? '-50%' : '50%';
    if (val === '1/3') return isNeg ? '-33.333333%' : '33.333333%';
    if (val === '2/3') return isNeg ? '-66.666667%' : '66.666667%';
    if (val === '1/4') return isNeg ? '-25%' : '25%';
    if (val === '3/4') return isNeg ? '-75%' : '75%';
    if (val === 'full') return isNeg ? '-100%' : '100%';
    if (SPACING_SCALE_PX[val] !== undefined) {
      const px = SPACING_SCALE_PX[val];
      return `${isNeg ? -px : px}px`;
    }
    return null;
  };

  const generateRuleBody = (coreClass: string): string | null => {
    // Display & Layout
    if (coreClass === 'block') return 'display: block;';
    if (coreClass === 'inline-block') return 'display: inline-block;';
    if (coreClass === 'inline') return 'display: inline;';
    if (coreClass === 'flex') return 'display: flex;';
    if (coreClass === 'inline-flex') return 'display: inline-flex;';
    if (coreClass === 'grid') return 'display: grid;';
    if (coreClass === 'inline-grid') return 'display: inline-grid;';
    if (coreClass === 'hidden') return 'display: none;';
    if (coreClass === 'relative') return 'position: relative;';
    if (coreClass === 'absolute') return 'position: absolute;';
    if (coreClass === 'fixed') return 'position: fixed;';
    if (coreClass === 'sticky') return 'position: sticky;';

    // Inset / Top / Right / Bottom / Left (including negative and fractions)
    const insetMatch = coreClass.match(/^(-)?(inset|top|right|bottom|left)-(.+)$/);
    if (insetMatch) {
      const isNeg = Boolean(insetMatch[1]);
      const prop = insetMatch[2];
      const offsetVal = resolvePositionOffset(insetMatch[3], isNeg);
      if (offsetVal !== null) {
        if (prop === 'inset') {
          return `top: ${offsetVal}; right: ${offsetVal}; bottom: ${offsetVal}; left: ${offsetVal};`;
        }
        return `${prop}: ${offsetVal};`;
      }
    }

    // Z-index
    const zMatch = coreClass.match(/^(-)?z-(\d+)$/);
    if (zMatch) {
      const zVal = parseInt(zMatch[2], 10);
      return `z-index: ${zMatch[1] ? -zVal : zVal};`;
    }

    // Overflow & Object Fit & Pointer Events & Cursor
    if (coreClass === 'overflow-hidden') return 'overflow: hidden;';
    if (coreClass === 'overflow-x-hidden') return 'overflow-x: hidden;';
    if (coreClass === 'overflow-x-auto') return 'overflow-x: auto;';
    if (coreClass === 'overflow-y-auto') return 'overflow-y: auto;';
    if (coreClass === 'object-cover') return 'object-fit: cover;';
    if (coreClass === 'object-contain') return 'object-fit: contain;';
    if (coreClass === 'pointer-events-none') return 'pointer-events: none;';
    if (coreClass === 'cursor-pointer') return 'cursor: pointer;';
    if (coreClass === 'antialiased') return '-webkit-font-smoothing: antialiased;';

    // Transforms (translate, scale, rotate)
    const transMatch = coreClass.match(/^(-)?translate-(x|y)-(.+)$/);
    if (transMatch) {
      const isNeg = Boolean(transMatch[1]);
      const axis = transMatch[2].toUpperCase();
      const offsetVal = resolvePositionOffset(transMatch[3], isNeg);
      if (offsetVal !== null) {
        return `transform: translate${axis}(${offsetVal});`;
      }
    }
    const scaleMatch = coreClass.match(/^scale-(\d+)$/);
    if (scaleMatch) {
      const s = parseInt(scaleMatch[1], 10) / 100;
      return `transform: scale(${s});`;
    }
    const arbScaleMatch = coreClass.match(/^scale-\[([\d.]+)\]$/);
    if (arbScaleMatch) {
      return `transform: scale(${arbScaleMatch[1]});`;
    }

    // Flex Direction, Alignment, Justify, Shrink
    if (coreClass === 'flex-col') return 'flex-direction: column;';
    if (coreClass === 'flex-row') return 'flex-direction: row;';
    if (coreClass === 'flex-wrap') return 'flex-wrap: wrap;';
    if (coreClass === 'flex-1') return 'flex: 1 1 0%;';
    if (coreClass === 'shrink-0' || coreClass === 'flex-shrink-0')
      return 'flex-shrink: 0;';
    if (coreClass === 'min-w-0') return 'min-width: 0px;';
    if (coreClass === 'items-start') return 'align-items: flex-start;';
    if (coreClass === 'items-center') return 'align-items: center;';
    if (coreClass === 'items-end') return 'align-items: flex-end;';
    if (coreClass === 'items-stretch') return 'align-items: stretch;';
    if (coreClass === 'items-baseline') return 'align-items: baseline;';
    if (coreClass === 'justify-start') return 'justify-content: flex-start;';
    if (coreClass === 'justify-center') return 'justify-content: center;';
    if (coreClass === 'justify-between') return 'justify-content: space-between;';
    if (coreClass === 'justify-end') return 'justify-content: flex-end;';
    if (coreClass === 'justify-items-center') return 'justify-items: center;';

    // Grid Columns & Span
    const gridColsMatch = coreClass.match(/^grid-cols-(\d+)$/);
    if (gridColsMatch) {
      const n = parseInt(gridColsMatch[1], 10);
      return `grid-template-columns: repeat(${n}, minmax(0, 1fr));`;
    }
    const colSpanMatch = coreClass.match(/^col-span-(\d+)$/);
    if (colSpanMatch) {
      const n = parseInt(colSpanMatch[1], 10);
      return `grid-column: span ${n} / span ${n};`;
    }

    // Gap
    const gapMatch = coreClass.match(/^gap-(\d+(?:\.\d+)?)$/);
    if (gapMatch && SPACING_SCALE_PX[gapMatch[1]] !== undefined) {
      return `gap: ${SPACING_SCALE_PX[gapMatch[1]]}px;`;
    }

    // Width & Max-Width & Height & Aspect Ratio (NO artificial min-height!)
    if (coreClass === 'w-full') return 'width: 100%;';
    if (coreClass === 'w-auto') return 'width: auto;';
    if (coreClass === 'h-full') return 'height: 100%;';
    if (coreClass === 'h-auto') return 'height: auto;';
    if (coreClass === 'aspect-[4/3]') return 'aspect-ratio: 4 / 3;';
    if (coreClass === 'aspect-[16/10]') return 'aspect-ratio: 16 / 10;';
    if (coreClass === 'aspect-video') return 'aspect-ratio: 16 / 9;';
    if (coreClass === 'aspect-square') return 'aspect-ratio: 1 / 1;';
    if (coreClass === 'mx-auto') return 'margin-left: auto; margin-right: auto;';
    if (coreClass === 'max-w-7xl') return 'max-width: 1280px;';
    if (coreClass === 'max-w-6xl') return 'max-width: 1152px;';
    if (coreClass === 'max-w-5xl') return 'max-width: 1024px;';
    if (coreClass === 'max-w-4xl') return 'max-width: 896px;';
    if (coreClass === 'max-w-3xl') return 'max-width: 768px;';
    if (coreClass === 'max-w-2xl') return 'max-width: 672px;';
    if (coreClass === 'max-w-xl') return 'max-width: 576px;';
    if (coreClass === 'max-w-lg') return 'max-width: 512px;';
    if (coreClass === 'max-w-md') return 'max-width: 448px;';
    if (coreClass === 'max-w-sm') return 'max-width: 384px;';
    if (coreClass === 'max-w-xs') return 'max-width: 320px;';
    if (coreClass === 'max-w-none') return 'max-width: none;';

    const arbHeightMatch = coreClass.match(/^h-\[([^\]]+)\]$/);
    if (arbHeightMatch) return `height: ${arbHeightMatch[1]};`;
    const arbWidthMatch = coreClass.match(/^w-\[([^\]]+)\]$/);
    if (arbWidthMatch) return `width: ${arbWidthMatch[1]};`;

    const wScaleMatch = coreClass.match(/^w-(\d+(?:\.\d+)?)$/);
    if (wScaleMatch && SPACING_SCALE_PX[wScaleMatch[1]] !== undefined) {
      return `width: ${SPACING_SCALE_PX[wScaleMatch[1]]}px;`;
    }
    const hScaleMatch = coreClass.match(/^h-(\d+(?:\.\d+)?)$/);
    if (hScaleMatch && SPACING_SCALE_PX[hScaleMatch[1]] !== undefined) {
      return `height: ${SPACING_SCALE_PX[hScaleMatch[1]]}px;`;
    }

    // Padding
    const pMatch = coreClass.match(/^(p|px|py|pt|pb|pl|pr)-(\d+(?:\.\d+)?)$/);
    if (pMatch && SPACING_SCALE_PX[pMatch[2]] !== undefined) {
      const dir = pMatch[1];
      const px = SPACING_SCALE_PX[pMatch[2]];
      if (dir === 'p') return `padding: ${px}px;`;
      if (dir === 'px') return `padding-left: ${px}px; padding-right: ${px}px;`;
      if (dir === 'py') return `padding-top: ${px}px; padding-bottom: ${px}px;`;
      if (dir === 'pt') return `padding-top: ${px}px;`;
      if (dir === 'pb') return `padding-bottom: ${px}px;`;
      if (dir === 'pl') return `padding-left: ${px}px;`;
      if (dir === 'pr') return `padding-right: ${px}px;`;
    }

    // Margin (including negative margins like -mr-3.5)
    const mMatch = coreClass.match(
      /^(-)?(m|mx|my|mt|mb|ml|mr)-(\d+(?:\.\d+)?)$/
    );
    if (mMatch && SPACING_SCALE_PX[mMatch[3]] !== undefined) {
      const isNeg = Boolean(mMatch[1]);
      const dir = mMatch[2];
      const rawPx = SPACING_SCALE_PX[mMatch[3]];
      const px = isNeg ? -rawPx : rawPx;
      if (dir === 'm') return `margin: ${px}px;`;
      if (dir === 'mx') return `margin-left: ${px}px; margin-right: ${px}px;`;
      if (dir === 'my') return `margin-top: ${px}px; margin-bottom: ${px}px;`;
      if (dir === 'mt') return `margin-top: ${px}px;`;
      if (dir === 'mb') return `margin-bottom: ${px}px;`;
      if (dir === 'ml') return `margin-left: ${px}px;`;
      if (dir === 'mr') return `margin-right: ${px}px;`;
    }

    // Border Radius
    if (coreClass === 'rounded-full') return 'border-radius: 9999px;';
    if (coreClass === 'rounded-3xl') return 'border-radius: 24px;';
    if (coreClass === 'rounded-2xl') return 'border-radius: 16px;';
    if (coreClass === 'rounded-xl') return 'border-radius: 12px;';
    if (coreClass === 'rounded-br-xl') return 'border-bottom-right-radius: 12px;';
    if (coreClass === 'rounded-bl-xl') return 'border-bottom-left-radius: 12px;';
    if (coreClass === 'rounded-tr-xl') return 'border-top-right-radius: 12px;';
    if (coreClass === 'rounded-tl-xl') return 'border-top-left-radius: 12px;';
    if (coreClass === 'rounded-lg') return 'border-radius: 8px;';
    if (coreClass === 'rounded-md') return 'border-radius: 6px;';
    if (coreClass === 'rounded') return 'border-radius: 4px;';

    // Border Width & Style
    if (coreClass === 'border') return 'border-width: 1px; border-style: solid;';
    if (coreClass === 'border-2') return 'border-width: 2px; border-style: solid;';
    if (coreClass === 'border-t')
      return 'border-top-width: 1px; border-top-style: solid;';
    if (coreClass === 'border-b')
      return 'border-bottom-width: 1px; border-bottom-style: solid;';
    if (coreClass === 'border-b-2')
      return 'border-bottom-width: 2px; border-bottom-style: solid;';
    if (coreClass === 'border-r')
      return 'border-right-width: 1px; border-right-style: solid;';
    if (coreClass === 'border-l')
      return 'border-left-width: 1px; border-left-style: solid;';
    if (coreClass === 'border-y')
      return 'border-top-width: 1px; border-bottom-width: 1px; border-style: solid;';
    if (coreClass === 'border-x')
      return 'border-left-width: 1px; border-right-width: 1px; border-style: solid;';
    if (coreClass === 'border-dashed') return 'border-style: dashed;';

    if (coreClass.startsWith('border-')) {
      const borderColor = resolveColorValue(coreClass.slice(7));
      if (borderColor) return `border-color: ${borderColor};`;
    }

    // Opacity, Blur, Backdrop-Blur, Grayscale, Shadow, Transitions
    const opacityMatch = coreClass.match(/^opacity-(\d+)$/);
    if (opacityMatch) {
      return `opacity: ${parseInt(opacityMatch[1], 10) / 100};`;
    }
    if (coreClass === 'blur-sm') return 'filter: blur(4px);';
    if (coreClass === 'blur-md') return 'filter: blur(12px);';
    if (coreClass === 'blur-lg') return 'filter: blur(16px);';
    if (coreClass === 'blur-xl') return 'filter: blur(24px);';
    if (coreClass === 'blur-2xl') return 'filter: blur(40px);';
    if (coreClass === 'blur-3xl') return 'filter: blur(64px);';
    const arbBlurMatch = coreClass.match(/^blur-\[([^\]]+)\]$/);
    if (arbBlurMatch) return `filter: blur(${arbBlurMatch[1]});`;

    if (coreClass === 'backdrop-blur-sm')
      return 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);';
    if (coreClass === 'backdrop-blur-md')
      return 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);';
    if (coreClass === 'backdrop-blur-lg')
      return 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);';
    if (coreClass === 'grayscale') return 'filter: grayscale(100%);';
    if (coreClass === 'grayscale-0') return 'filter: grayscale(0%);';

    if (coreClass === 'shadow-sm')
      return 'box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);';
    if (coreClass === 'shadow-lg')
      return 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.15);';
    if (coreClass === 'shadow-2xl')
      return 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);';

    if (coreClass === 'transition-all')
      return 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    if (coreClass === 'transition-colors')
      return 'transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    if (coreClass === 'transition-transform')
      return 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    const durMatch = coreClass.match(/^duration-(\d+)$/);
    if (durMatch) return `transition-duration: ${durMatch[1]}ms;`;

    // Text Alignment, Weight, Line-Height, Tracking
    if (coreClass === 'text-center') return 'text-align: center;';
    if (coreClass === 'text-right') return 'text-align: right;';
    if (coreClass === 'text-left') return 'text-align: left;';
    if (coreClass === 'font-extrabold') return 'font-weight: 800;';
    if (coreClass === 'font-bold') return 'font-weight: 700;';
    if (coreClass === 'font-semibold') return 'font-weight: 600;';
    if (coreClass === 'font-medium') return 'font-weight: 500;';
    if (coreClass === 'font-normal') return 'font-weight: 400;';
    if (coreClass === 'leading-tight') return 'line-height: 1.25;';
    if (coreClass === 'leading-snug') return 'line-height: 1.375;';
    if (coreClass === 'leading-normal') return 'line-height: 1.5;';
    if (coreClass === 'leading-relaxed') return 'line-height: 1.625;';
    if (coreClass === 'tracking-tight') return 'letter-spacing: -0.025em;';
    if (coreClass === 'tracking-wide') return 'letter-spacing: 0.025em;';
    if (coreClass === 'tracking-wider') return 'letter-spacing: 0.05em;';
    if (coreClass === 'bg-clip-text')
      return '-webkit-background-clip: text; background-clip: text;';
    if (coreClass === 'text-transparent') return 'color: transparent;';

    // Custom font-* scale from tailwind.config (e.g. font-display, font-headline-lg)
    if (coreClass.startsWith('font-')) {
      const sub = coreClass.slice(5);
      const fs = customFontSizes[sub];
      if (fs) {
        let out = `font-size: ${fs.fontSize};`;
        if (fs.lineHeight) out += ` line-height: ${fs.lineHeight};`;
        if (fs.fontWeight) out += ` font-weight: ${fs.fontWeight};`;
        if (fs.letterSpacing) out += ` letter-spacing: ${fs.letterSpacing};`;
        return out;
      }
    }

    // Font Size or Text Color
    if (coreClass.startsWith('text-')) {
      const sub = coreClass.slice(5);
      const arbFsMatch = sub.match(/^\[(\d+px)\]$/);
      if (arbFsMatch) return `font-size: ${arbFsMatch[1]};`;
      const fs = customFontSizes[sub];
      if (fs) {
        let out = `font-size: ${fs.fontSize};`;
        if (fs.lineHeight) out += ` line-height: ${fs.lineHeight};`;
        if (fs.fontWeight) out += ` font-weight: ${fs.fontWeight};`;
        if (fs.letterSpacing) out += ` letter-spacing: ${fs.letterSpacing};`;
        return out;
      }
      const txtColor = resolveColorValue(sub);
      if (txtColor) return `color: ${txtColor};`;
    }

    // Background Color & Gradients
    if (coreClass === 'bg-gradient-to-l') {
      return 'background-image: linear-gradient(to left, var(--tw-gradient-stops, var(--tw-gradient-from, #1d4ed8), var(--tw-gradient-to, transparent)));';
    }
    if (coreClass === 'bg-gradient-to-r') {
      return 'background-image: linear-gradient(to right, var(--tw-gradient-stops, var(--tw-gradient-from, #00d2ff), var(--tw-gradient-to, transparent)));';
    }
    if (coreClass === 'bg-gradient-to-t') {
      return 'background-image: linear-gradient(to top, var(--tw-gradient-stops, var(--tw-gradient-from, #060e20), var(--tw-gradient-to, transparent)));';
    }
    if (coreClass === 'bg-gradient-to-b') {
      return 'background-image: linear-gradient(to bottom, var(--tw-gradient-stops, var(--tw-gradient-from, #060e20), var(--tw-gradient-to, transparent)));';
    }
    if (coreClass === 'bg-gradient-to-tr') {
      return 'background-image: linear-gradient(to top right, var(--tw-gradient-stops, var(--tw-gradient-from, #1d4ed8), var(--tw-gradient-to, transparent)));';
    }
    if (coreClass.startsWith('from-')) {
      const c = resolveColorValue(coreClass.slice(5));
      if (c)
        return `--tw-gradient-from: ${c}; --tw-gradient-to: transparent; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);`;
    }
    if (coreClass.startsWith('via-')) {
      const c = resolveColorValue(coreClass.slice(4));
      if (c)
        return `--tw-gradient-to: transparent; --tw-gradient-stops: var(--tw-gradient-from), ${c}, var(--tw-gradient-to);`;
    }
    if (coreClass.startsWith('to-')) {
      const c = resolveColorValue(coreClass.slice(3));
      if (c) return `--tw-gradient-to: ${c};`;
    }
    if (coreClass.startsWith('bg-')) {
      const bgColor = resolveColorValue(coreClass.slice(3));
      if (bgColor) return `background-color: ${bgColor};`;
    }

    return null;
  };

  allClasses.forEach((rawCls) => {
    // Handle space-y-* with child combinator so block containers stay block while spacing direct children
    const spaceYMatch = rawCls.match(/^(?:(sm|md|lg):)?space-y-(\d+(?:\.\d+)?)$/);
    if (spaceYMatch && SPACING_SCALE_PX[spaceYMatch[2]] !== undefined) {
      const prefix = spaceYMatch[1];
      const px = SPACING_SCALE_PX[spaceYMatch[2]];
      const rule = `.${escapeCssClassName(rawCls)} > :not([hidden]) ~ :not([hidden]) { margin-top: ${px}px; }`;
      if (!prefix) baseRules.push(rule);
      else if (prefix === 'sm') smRules.push(rule);
      else if (prefix === 'md') mdRules.push(rule);
      else if (prefix === 'lg') lgRules.push(rule);
      return;
    }

    const parts = rawCls.split(':');
    if (parts.length === 1) {
      const body = generateRuleBody(rawCls);
      if (body) {
        baseRules.push(`.${escapeCssClassName(rawCls)} { ${body} }`);
      }
    } else if (parts.length === 2) {
      const [prefix, core] = parts;
      const body = generateRuleBody(core);
      if (!body) return;
      if (prefix === 'hover') {
        baseRules.push(`.${escapeCssClassName(rawCls)}:hover { ${body} }`);
        return;
      }
      const rule = `.${escapeCssClassName(rawCls)} { ${body} }`;
      if (prefix === 'sm') smRules.push(rule);
      else if (prefix === 'md') mdRules.push(rule);
      else if (prefix === 'lg' || prefix === 'xl') lgRules.push(rule);
    }
  });

  return [
    ...baseRules,
    smRules.length > 0
      ? `@media (min-width: 640px) {\n  ${smRules.join('\n  ')}\n}`
      : '',
    mdRules.length > 0
      ? `@media (min-width: 768px) {\n  ${mdRules.join('\n  ')}\n}`
      : '',
    lgRules.length > 0
      ? `@media (min-width: 1024px) {\n  ${lgRules.join('\n  ')}\n}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
