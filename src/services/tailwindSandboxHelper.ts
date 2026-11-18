// ===== CONFIGURATION & CONSTANTS =====

const TAILWIND_CDN_SCRIPT_REGEX =
  /<script[^>]+src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/i;

const SPACING_SCALE: Record<string, string> = {
  '0': '0px',
  px: '1px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '3.5': '14px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '9': '36px',
  '10': '40px',
  '11': '44px',
  '12': '48px',
  '14': '56px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
  '28': '112px',
  '32': '128px',
  '36': '144px',
  '40': '160px',
  '44': '176px',
  '48': '192px',
  '52': '208px',
  '56': '224px',
  '60': '240px',
  '64': '256px',
  '72': '288px',
  '80': '320px',
  '96': '384px',
};

const MAX_WIDTH_SCALE: Record<string, string> = {
  none: 'none',
  xs: '320px',
  sm: '384px',
  md: '448px',
  lg: '512px',
  xl: '576px',
  '2xl': '672px',
  '3xl': '768px',
  '4xl': '896px',
  '5xl': '1024px',
  '6xl': '1152px',
  '7xl': '1280px',
  full: '100%',
  fit: 'fit-content',
  max: 'max-content',
  min: 'min-content',
};

const FONT_SIZE_SCALE: Record<string, { size: string; lineHeight: string }> = {
  xs: { size: '12px', lineHeight: '16px' },
  sm: { size: '14px', lineHeight: '20px' },
  base: { size: '16px', lineHeight: '24px' },
  lg: { size: '18px', lineHeight: '28px' },
  xl: { size: '20px', lineHeight: '28px' },
  '2xl': { size: '24px', lineHeight: '32px' },
  '3xl': { size: '30px', lineHeight: '36px' },
  '4xl': { size: '36px', lineHeight: '40px' },
  '5xl': { size: '48px', lineHeight: '48px' },
  '6xl': { size: '60px', lineHeight: '60px' },
  '7xl': { size: '72px', lineHeight: '72px' },
};

const RADIUS_SCALE: Record<string, string> = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  DEFAULT: '6px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
};

const DEFAULT_TAILWIND_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
  // Slate
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'slate-950': '#020617',
  // Gray
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'gray-950': '#030712',
  // Zinc
  'zinc-50': '#fafafa',
  'zinc-100': '#f4f4f5',
  'zinc-200': '#e4e4e7',
  'zinc-300': '#d4d4d8',
  'zinc-400': '#a1a1aa',
  'zinc-500': '#71717a',
  'zinc-600': '#52525b',
  'zinc-700': '#3f3f46',
  'zinc-800': '#27272a',
  'zinc-900': '#18181b',
  // Red
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-200': '#fecaca',
  'red-300': '#fca5a5',
  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  // Orange
  'orange-50': '#fff7ed',
  'orange-100': '#ffedd5',
  'orange-200': '#fed7aa',
  'orange-300': '#fdba74',
  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
  'orange-900': '#7c2d12',
  // Amber
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'amber-200': '#fde68a',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'amber-800': '#92400e',
  'amber-900': '#78350f',
  'amber-950': '#451a03',
  // Yellow
  'yellow-50': '#fefce8',
  'yellow-100': '#fef9c3',
  'yellow-200': '#fef08a',
  'yellow-300': '#fde047',
  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',
  'yellow-800': '#854d0e',
  'yellow-900': '#713f12',
  // Lime
  'lime-50': '#f7fee7',
  'lime-100': '#ecfccb',
  'lime-200': '#d9f99d',
  'lime-500': '#84cc16',
  'lime-600': '#65a30d',
  // Green
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-200': '#bbf7d0',
  'green-300': '#86efac',
  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',
  // Emerald
  'emerald-50': '#ecfdf5',
  'emerald-100': '#d1fae5',
  'emerald-200': '#a7f3d0',
  'emerald-300': '#6ee7b7',
  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-900': '#064e3b',
  'emerald-950': '#022c22',
  // Teal
  'teal-50': '#f0fdfa',
  'teal-100': '#ccfbf1',
  'teal-200': '#99f6e4',
  'teal-300': '#5eead4',
  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',
  'teal-800': '#115e59',
  'teal-900': '#134e4a',
  // Cyan & Sky
  'cyan-50': '#ecfeff',
  'cyan-100': '#cffafe',
  'cyan-200': '#a5f3fc',
  'cyan-500': '#06b6d4',
  'sky-50': '#f0f9ff',
  'sky-100': '#e0f2fe',
  'sky-200': '#bae6fd',
  'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  // Blue
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd',
  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  // Indigo
  'indigo-50': '#eef2ff',
  'indigo-100': '#e0e7ff',
  'indigo-200': '#c7d2fe',
  'indigo-300': '#a5b4fc',
  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'indigo-800': '#3730a3',
  'indigo-900': '#312e81',
  // Violet
  'violet-50': '#f5f3ff',
  'violet-100': '#ede9fe',
  'violet-200': '#ddd6fe',
  'violet-300': '#c4b5fd',
  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'violet-700': '#6d28d9',
  'violet-800': '#5b21b6',
  'violet-900': '#4c1d95',
  // Purple
  'purple-50': '#faf5ff',
  'purple-100': '#f3e8ff',
  'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe',
  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'purple-800': '#6b21a8',
  'purple-900': '#581c87',
  'purple-950': '#3b0764',
  // Fuchsia
  'fuchsia-50': '#fdf4ff',
  'fuchsia-100': '#fae8ff',
  'fuchsia-200': '#f5d0fe',
  'fuchsia-300': '#f0abfc',
  'fuchsia-400': '#e879f9',
  'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3',
  // Pink
  'pink-50': '#fdf2f8',
  'pink-100': '#fce7f3',
  'pink-200': '#fbcfe8',
  'pink-300': '#f9a8d4',
  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',
  'pink-800': '#9d174d',
  'pink-900': '#831843',
  'pink-950': '#500724',
  // Rose
  'rose-50': '#fff1f2',
  'rose-100': '#ffe4e6',
  'rose-200': '#fecdd3',
  'rose-300': '#fda4af',
  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
  'rose-800': '#9f1239',
  'rose-900': '#881337',
  'rose-950': '#4c0519',
  // Direct hex shorthand tokens (e.g. bg-FFF9F3, via-FFF9F3, from-FFF9F3)
  FFF9F3: '#FFF9F3',
  FFFDFB: '#FFFDFB',
  FFFDF9: '#FFFDF9',
  FFF8F2: '#FFF8F2',
  FFF3E8: '#FFF3E8',
};

const DEFAULT_BOX_SHADOWS: Record<string, string> = {
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  none: 'none',
};

// ===== UTILITY FUNCTIONS =====

function hexToRgba(hex: string, alphaPercent: number): string {
  const clean = hex.replace('#', '').trim();
  const alpha = Math.max(0, Math.min(1, alphaPercent / 100));
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(2))})`;
  }
  return hex;
}

function escapeCssClassName(cls: string): string {
  return cls.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function resolveColorToken(
  token: string,
  colorMap: Record<string, string>
): string | null {
  let colorName = token;
  let alpha: number | null = null;

  if (token.includes('/')) {
    const parts = token.split('/');
    colorName = parts[0];
    const parsedAlpha = parseFloat(parts[1]);
    if (!Number.isNaN(parsedAlpha)) {
      alpha = parsedAlpha;
    }
  }

  // Arbitrary hex color token: [#FFFDFB] or [#593B63]/80
  const arbHexMatch = colorName.match(/^\[(#[0-9a-fA-F]{3,8})\]$/);
  if (arbHexMatch) {
    const rawHex = arbHexMatch[1];
    if (alpha !== null) {
      return hexToRgba(rawHex, alpha);
    }
    return rawHex;
  }

  // Raw 6-char hex shorthand token (e.g. FFF9F3)
  if (/^[0-9a-fA-F]{6}$/.test(colorName) && !colorMap[colorName]) {
    const hexVal = `#${colorName}`;
    return alpha !== null ? hexToRgba(hexVal, alpha) : hexVal;
  }

  const baseHex = colorMap[colorName];
  if (!baseHex) return null;

  if (alpha !== null && baseHex.startsWith('#')) {
    return hexToRgba(baseHex, alpha);
  }
  return baseHex;
}

function extractBalancedBraceBlock(
  source: string,
  startBraceIdx: number
): string | null {
  if (source[startBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = startBraceIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(startBraceIdx + 1, i);
      }
    }
  }
  return null;
}

function extractTailwindConfigColors(doc: Document): Record<string, string> {
  const colors: Record<string, string> = { ...DEFAULT_TAILWIND_COLORS };
  const scripts = Array.from(doc.querySelectorAll('script'));

  for (const script of scripts) {
    const content = script.textContent || '';
    if (!content.includes('tailwind.config')) continue;

    // 1. Parse nested color groups (e.g. `colors: { gandom: { pink: '#F36FA8', cream: '#FFF9F3' } }`)
    const colorsKeyMatch = content.match(/\bcolors\s*:\s*\{/);
    if (colorsKeyMatch && colorsKeyMatch.index !== undefined) {
      const openIdx =
        colorsKeyMatch.index + colorsKeyMatch[0].lastIndexOf('{');
      const colorsBlock = extractBalancedBraceBlock(content, openIdx);
      if (colorsBlock) {
        // Match nested group: `groupName: { ... }`
        const groupRegex =
          /["']?([a-zA-Z0-9_-]+)["']?\s*:\s*\{([^{}]*)\}/g;
        let grpMatch: RegExpExecArray | null;
        while ((grpMatch = groupRegex.exec(colorsBlock)) !== null) {
          const groupName = grpMatch[1];
          const groupBody = grpMatch[2];
          const pairRegex =
            /["']?([a-zA-Z0-9_-]+)["']?\s*:\s*["'](#[0-9a-fA-F]{3,8}|rgba?\([^"']+\))["']/g;
          let pairMatch: RegExpExecArray | null;
          while ((pairMatch = pairRegex.exec(groupBody)) !== null) {
            const subKey = pairMatch[1];
            const val = pairMatch[2];
            if (subKey === 'DEFAULT') {
              colors[groupName] = val;
            } else {
              colors[`${groupName}-${subKey}`] = val;
              // Also register unprefixed custom key (e.g. `bg-cream` when `gandom.cream` is defined)
              if (!colors[subKey]) {
                colors[subKey] = val;
              }
            }
          }
        }
      }
    }

    // 2. Parse flat color key-value pairs (both quoted and unquoted keys)
    const flatColorRegex =
      /["']?([a-zA-Z0-9_-]+)["']?\s*:\s*["'](#[0-9a-fA-F]{3,8})["']/g;
    let match: RegExpExecArray | null;
    while ((match = flatColorRegex.exec(content)) !== null) {
      const key = match[1];
      const val = match[2];
      if (!colors[key]) {
        colors[key] = val;
      }
    }
  }

  return colors;
}

function extractTailwindConfigBoxShadows(doc: Document): Record<string, string> {
  const shadows: Record<string, string> = { ...DEFAULT_BOX_SHADOWS };
  const scripts = Array.from(doc.querySelectorAll('script'));

  for (const script of scripts) {
    const content = script.textContent || '';
    if (!content.includes('tailwind.config')) continue;

    const shadowKeyMatch = content.match(/\bboxShadow\s*:\s*\{/);
    if (shadowKeyMatch && shadowKeyMatch.index !== undefined) {
      const openIdx =
        shadowKeyMatch.index + shadowKeyMatch[0].lastIndexOf('{');
      const shadowBlock = extractBalancedBraceBlock(content, openIdx);
      if (shadowBlock) {
        const pairRegex =
          /["']?([a-zA-Z0-9_-]+)["']?\s*:\s*["']([^"']+)["']/g;
        let m: RegExpExecArray | null;
        while ((m = pairRegex.exec(shadowBlock)) !== null) {
          shadows[m[1]] = m[2].trim();
        }
      }
    }
  }

  return shadows;
}

function extractTailwindConfigFonts(doc: Document): {
  displayFont: string;
  bodyFont: string;
} {
  let displayFont = "'Vazirmatn', system-ui, -apple-system, sans-serif";
  let bodyFont = "'Vazirmatn', system-ui, -apple-system, sans-serif";

  const scripts = Array.from(doc.querySelectorAll('script'));
  for (const script of scripts) {
    const content = script.textContent || '';
    if (!content.includes('fontFamily')) continue;

    const sansMatch = content.match(/sans\s*:\s*\[\s*["']([^"']+)["']/);
    if (sansMatch) {
      displayFont = `'${sansMatch[1]}', system-ui, -apple-system, sans-serif`;
      bodyFont = `'${sansMatch[1]}', system-ui, -apple-system, sans-serif`;
    }
    const displayMatch = content.match(
      /["']?display["']?\s*:\s*\[\s*["']([^"']+)["']/
    );
    if (displayMatch) {
      displayFont = `'${displayMatch[1]}', system-ui, -apple-system, sans-serif`;
    }
    const bodyMatch = content.match(
      /["']?body["']?\s*:\s*\[\s*["']([^"']+)["']/
    );
    if (bodyMatch) {
      bodyFont = `'${bodyMatch[1]}', system-ui, -apple-system, sans-serif`;
    }
  }

  return { displayFont, bodyFont };
}

function generateDeclarationForToken(
  token: string,
  colors: Record<string, string>,
  boxShadows: Record<string, string>,
  fonts: { displayFont: string; bodyFont: string }
): string | null {
  switch (token) {
    case 'block':
      return 'display: block;';
    case 'inline-block':
      return 'display: inline-block;';
    case 'inline':
      return 'display: inline;';
    case 'flex':
      return 'display: flex;';
    case 'inline-flex':
      return 'display: inline-flex;';
    case 'grid':
      return 'display: grid;';
    case 'hidden':
      return 'display: none;';
    case 'flex-row':
      return 'flex-direction: row;';
    case 'flex-row-reverse':
      return 'flex-direction: row-reverse;';
    case 'flex-col':
      return 'flex-direction: column;';
    case 'flex-col-reverse':
      return 'flex-direction: column-reverse;';
    case 'flex-wrap':
      return 'flex-wrap: wrap;';
    case 'flex-nowrap':
      return 'flex-wrap: nowrap;';
    case 'flex-1':
      return 'flex: 1 1 0%;';
    case 'flex-auto':
      return 'flex: 1 1 auto;';
    case 'shrink-0':
    case 'flex-shrink-0':
      return 'flex-shrink: 0;';
    case 'grow':
    case 'flex-grow':
      return 'flex-grow: 1;';
    case 'items-center':
      return 'align-items: center;';
    case 'items-start':
      return 'align-items: flex-start;';
    case 'items-end':
      return 'align-items: flex-end;';
    case 'items-baseline':
      return 'align-items: baseline;';
    case 'items-stretch':
      return 'align-items: stretch;';
    case 'justify-center':
      return 'justify-content: center;';
    case 'justify-between':
      return 'justify-content: space-between;';
    case 'justify-around':
      return 'justify-content: space-around;';
    case 'justify-evenly':
      return 'justify-content: space-evenly;';
    case 'justify-start':
      return 'justify-content: flex-start;';
    case 'justify-end':
      return 'justify-content: flex-end;';
    case 'self-start':
      return 'align-self: flex-start;';
    case 'self-center':
      return 'align-self: center;';
    case 'self-end':
      return 'align-self: flex-end;';
    case 'relative':
      return 'position: relative;';
    case 'absolute':
      return 'position: absolute;';
    case 'fixed':
      return 'position: fixed;';
    case 'sticky':
      return 'position: sticky;';
    case 'inset-0':
      return 'top: 0px; right: 0px; bottom: 0px; left: 0px;';
    case 'top-0':
      return 'top: 0px;';
    case 'bottom-0':
      return 'bottom: 0px;';
    case 'left-0':
      return 'left: 0px;';
    case 'right-0':
      return 'right: 0px;';
    case 'top-1/2':
      return 'top: 50%;';
    case 'bottom-1/2':
      return 'bottom: 50%;';
    case 'left-1/2':
      return 'left: 50%;';
    case 'right-1/2':
      return 'right: 50%;';
    case 'translate-y-1/2':
      return 'transform: translateY(50%);';
    case '-translate-y-1/2':
      return 'transform: translateY(-50%);';
    case 'translate-x-1/2':
      return 'transform: translateX(50%);';
    case '-translate-x-1/2':
      return 'transform: translateX(-50%);';
    case 'm-auto':
      return 'margin: auto;';
    case 'mx-auto':
      return 'margin-left: auto; margin-right: auto;';
    case 'my-auto':
      return 'margin-top: auto; margin-bottom: auto;';
    case 'mr-auto':
      return 'margin-right: auto;';
    case 'ml-auto':
      return 'margin-left: auto;';
    case 'mt-auto':
      return 'margin-top: auto;';
    case 'mb-auto':
      return 'margin-bottom: auto;';
    case 'w-full':
      return 'width: 100%;';
    case 'w-fit':
      return 'width: fit-content;';
    case 'w-auto':
      return 'width: auto;';
    case 'w-1/2':
      return 'width: 50%;';
    case 'w-1/3':
      return 'width: 33.333333%;';
    case 'w-2/3':
      return 'width: 66.666667%;';
    case 'h-full':
      return 'height: 100%;';
    case 'h-fit':
      return 'height: fit-content;';
    case 'h-auto':
      return 'height: auto;';
    case 'min-h-screen':
      return 'min-height: 100vh;';
    case 'aspect-square':
      return 'aspect-ratio: 1 / 1;';
    case 'aspect-video':
      return 'aspect-ratio: 16 / 9;';
    case 'overflow-hidden':
      return 'overflow: hidden;';
    case 'overflow-x-auto':
      return 'overflow-x: auto;';
    case 'overflow-x-hidden':
      return 'overflow-x: hidden;';
    case 'bg-clip-text':
      return '-webkit-background-clip: text; background-clip: text;';
    case 'text-transparent':
      return 'color: transparent;';
    case 'text-left':
      return 'text-align: left;';
    case 'text-center':
      return 'text-align: center;';
    case 'text-right':
      return 'text-align: right;';
    case 'text-justify':
      return 'text-align: justify;';
    case 'font-display':
      return `font-family: ${fonts.displayFont};`;
    case 'font-body':
    case 'font-sans':
      return `font-family: ${fonts.bodyFont};`;
    case 'font-mono':
      return 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;';
    case 'font-light':
      return 'font-weight: 300;';
    case 'font-normal':
      return 'font-weight: 400;';
    case 'font-medium':
      return 'font-weight: 500;';
    case 'font-semibold':
      return 'font-weight: 600;';
    case 'font-bold':
      return 'font-weight: 700;';
    case 'font-extrabold':
      return 'font-weight: 800;';
    case 'font-black':
      return 'font-weight: 900;';
    case 'italic':
      return 'font-style: italic;';
    case 'not-italic':
      return 'font-style: normal;';
    case 'uppercase':
      return 'text-transform: uppercase;';
    case 'lowercase':
      return 'text-transform: lowercase;';
    case 'capitalize':
      return 'text-transform: capitalize;';
    case 'leading-none':
      return 'line-height: 1;';
    case 'leading-tight':
      return 'line-height: 1.25;';
    case 'leading-snug':
      return 'line-height: 1.375;';
    case 'leading-normal':
      return 'line-height: 1.5;';
    case 'leading-relaxed':
      return 'line-height: 1.625;';
    case 'leading-loose':
      return 'line-height: 2;';
    case 'tracking-tighter':
      return 'letter-spacing: -0.05em;';
    case 'tracking-tight':
      return 'letter-spacing: -0.025em;';
    case 'tracking-normal':
      return 'letter-spacing: 0em;';
    case 'tracking-wide':
      return 'letter-spacing: 0.025em;';
    case 'tracking-wider':
      return 'letter-spacing: 0.05em;';
    case 'tracking-widest':
      return 'letter-spacing: 0.1em;';
    case 'underline':
      return 'text-decoration-line: underline;';
    case 'line-through':
      return 'text-decoration-line: line-through;';
    case 'no-underline':
      return 'text-decoration-line: none;';
    case 'decoration-wavy':
      return 'text-decoration-style: wavy;';
    case 'decoration-dashed':
      return 'text-decoration-style: dashed;';
    case 'decoration-dotted':
      return 'text-decoration-style: dotted;';
    case 'decoration-2':
      return 'text-decoration-thickness: 2px;';
    case 'decoration-4':
      return 'text-decoration-thickness: 4px;';
    case 'underline-offset-2':
      return 'text-underline-offset: 2px;';
    case 'underline-offset-4':
      return 'text-underline-offset: 4px;';
    case 'underline-offset-8':
      return 'text-underline-offset: 8px;';
    case 'whitespace-nowrap':
      return 'white-space: nowrap;';
    case 'select-none':
      return 'user-select: none;';
    case 'pointer-events-none':
      return 'pointer-events: none;';
    case 'cursor-pointer':
      return 'cursor: pointer;';
    case 'outline-none':
      return 'outline: 2px solid transparent; outline-offset: 2px;';
    case 'ring-2':
      return 'box-shadow: 0 0 0 2px var(--tw-ring-color, rgba(244, 114, 182, 0.5));';
    case 'line-clamp-1':
      return 'overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1;';
    case 'line-clamp-2':
      return 'overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;';
    case 'line-clamp-3':
      return 'overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3;';
    case 'border':
      return 'border-width: 1px; border-style: solid;';
    case 'border-0':
      return 'border-width: 0px;';
    case 'border-2':
      return 'border-width: 2px; border-style: solid;';
    case 'border-4':
      return 'border-width: 4px; border-style: solid;';
    case 'border-t':
      return 'border-top-width: 1px; border-top-style: solid;';
    case 'border-t-2':
      return 'border-top-width: 2px; border-top-style: solid;';
    case 'border-t-4':
      return 'border-top-width: 4px; border-top-style: solid;';
    case 'border-b':
      return 'border-bottom-width: 1px; border-bottom-style: solid;';
    case 'border-b-2':
      return 'border-bottom-width: 2px; border-bottom-style: solid;';
    case 'border-b-4':
      return 'border-bottom-width: 4px; border-bottom-style: solid;';
    case 'border-l':
      return 'border-left-width: 1px; border-left-style: solid;';
    case 'border-l-2':
      return 'border-left-width: 2px; border-left-style: solid;';
    case 'border-l-4':
      return 'border-left-width: 4px; border-left-style: solid;';
    case 'border-r':
      return 'border-right-width: 1px; border-right-style: solid;';
    case 'border-r-2':
      return 'border-right-width: 2px; border-right-style: solid;';
    case 'border-r-4':
      return 'border-right-width: 4px; border-right-style: solid;';
    case 'border-dashed':
      return 'border-style: dashed;';
    case 'border-dotted':
      return 'border-style: dotted;';
    case 'border-solid':
      return 'border-style: solid;';
    case 'backdrop-blur-xs':
      return 'backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);';
    case 'backdrop-blur-sm':
      return 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);';
    case 'backdrop-blur-md':
    case 'backdrop-blur':
      return 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);';
    case 'backdrop-blur-lg':
      return 'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);';
    case 'blur-xl':
      return 'filter: blur(24px);';
    case 'blur-2xl':
      return 'filter: blur(40px);';
    case 'blur-3xl':
      return 'filter: blur(64px);';
    case 'drop-shadow':
      return 'filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.06));';
    case 'drop-shadow-sm':
      return 'filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.05));';
    case 'drop-shadow-md':
      return 'filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.07)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.06));';
    case 'drop-shadow-lg':
      return 'filter: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1));';
    case 'grayscale':
      return 'filter: grayscale(100%);';
    case 'grayscale-0':
      return 'filter: grayscale(0%);';
    case 'object-cover':
      return 'object-fit: cover;';
    case 'object-contain':
      return 'object-fit: contain;';
    case 'transition':
    case 'transition-all':
      return 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    case 'transition-colors':
      return 'transition-property: color, background-color, border-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    case 'transition-transform':
      return 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    case 'transition-shadow':
      return 'transition-property: box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    case 'transition-opacity':
      return 'transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 200ms;';
    case 'duration-150':
      return 'transition-duration: 150ms;';
    case 'duration-200':
      return 'transition-duration: 200ms;';
    case 'duration-300':
      return 'transition-duration: 300ms;';
    case 'duration-500':
      return 'transition-duration: 500ms;';
    case 'duration-700':
      return 'transition-duration: 700ms;';
    case 'duration-1000':
      return 'transition-duration: 1000ms;';
    case 'animate-pulse':
      return 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;';
    case 'animate-bounce':
      return 'animation: bounce 1s infinite;';
    case 'animate-ping':
      return 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;';
    case 'shadow-inner':
      return 'box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);';
    case 'shadow-xs':
      return 'box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);';
    case 'bg-gradient-to-t':
      return '--tw-gradient-dir: to top; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-b':
      return '--tw-gradient-dir: to bottom; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-l':
      return '--tw-gradient-dir: to left; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-r':
      return '--tw-gradient-dir: to right; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-tr':
      return '--tw-gradient-dir: to top right; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-tl':
      return '--tw-gradient-dir: to top left; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-br':
      return '--tw-gradient-dir: to bottom right; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    case 'bg-gradient-to-bl':
      return '--tw-gradient-dir: to bottom left; background-image: linear-gradient(var(--tw-gradient-dir), var(--tw-gradient-from, transparent), var(--tw-gradient-to, transparent));';
    default:
      break;
  }

  // Custom & standard box-shadow: shadow, shadow-sm, shadow-scrapbook, shadow-polaroid, shadow-cute-btn, etc.
  if (token === 'shadow') {
    return `box-shadow: ${boxShadows.DEFAULT};`;
  }
  if (token.startsWith('shadow-')) {
    const shKey = token.slice(7);
    if (boxShadows[shKey]) {
      return `box-shadow: ${boxShadows[shKey]};`;
    }
  }

  // Grid columns & span: grid-cols-1 .. grid-cols-12, col-span-1 .. col-span-12
  const gridColsMatch = token.match(/^grid-cols-(\d+)$/);
  if (gridColsMatch) {
    return `grid-template-columns: repeat(${gridColsMatch[1]}, minmax(0, 1fr));`;
  }
  const colSpanMatch = token.match(/^col-span-(\d+)$/);
  if (colSpanMatch) {
    return `grid-column: span ${colSpanMatch[1]} / span ${colSpanMatch[1]};`;
  }

  // Flex order: order-1 .. order-12, order-first, order-last, order-none
  if (token === 'order-first') return 'order: -9999;';
  if (token === 'order-last') return 'order: 9999;';
  if (token === 'order-none') return 'order: 0;';
  const orderMatch = token.match(/^order-(\d+)$/);
  if (orderMatch) {
    return `order: ${orderMatch[1]};`;
  }

  // Z-index: z-0, z-10, z-20, z-30, z-40, z-50, -z-10
  if (token === '-z-10') return 'z-index: -10;';
  const zMatch = token.match(/^z-(\d+)$/);
  if (zMatch) {
    return `z-index: ${zMatch[1]};`;
  }

  // Opacity: opacity-0 .. opacity-100
  const opacityMatch = token.match(/^opacity-(\d+)$/);
  if (opacityMatch) {
    const val = Math.max(0, Math.min(100, Number(opacityMatch[1]))) / 100;
    return `opacity: ${val};`;
  }

  // Rotations: rotate-0, rotate-1, rotate-2, rotate-3, rotate-6, rotate-12, rotate-45, rotate-90, rotate-180, -rotate-*, rotate-[*deg]
  const arbRotateMatch = token.match(/^(-?)rotate-\[(-?\d+(?:\.\d+)?)deg\]$/);
  if (arbRotateMatch) {
    const deg =
      arbRotateMatch[1] === '-' && !arbRotateMatch[2].startsWith('-')
        ? `-${arbRotateMatch[2]}`
        : arbRotateMatch[2];
    return `transform: rotate(${deg}deg);`;
  }
  const stdRotateMatch = token.match(/^(-?)rotate-(\d+(?:\.\d+)?)$/);
  if (stdRotateMatch) {
    const sign = stdRotateMatch[1] === '-' ? '-' : '';
    return `transform: rotate(${sign}${stdRotateMatch[2]}deg);`;
  }

  // Scale: scale-90, scale-95, scale-100, scale-105, scale-110, scale-125
  const scaleMatch = token.match(/^scale-(\d+)$/);
  if (scaleMatch) {
    const factor = Number(scaleMatch[1]) / 100;
    return `transform: scale(${factor});`;
  }

  // Translate: translate-y-*, -translate-y-*, translate-x-*, -translate-x-*
  const translateMatch = token.match(
    /^(-?)translate-([xy])-(\d+(?:\.\d+)?|px)$/
  );
  if (translateMatch && SPACING_SCALE[translateMatch[3]]) {
    const sign = translateMatch[1] === '-' ? '-' : '';
    const axis = translateMatch[2].toUpperCase();
    return `transform: translate${axis}(${sign}${SPACING_SCALE[translateMatch[3]]});`;
  }

  // Max-width: max-w-*
  if (token.startsWith('max-w-')) {
    const mwKey = token.slice(6);
    if (MAX_WIDTH_SCALE[mwKey]) {
      return `max-width: ${MAX_WIDTH_SCALE[mwKey]};`;
    }
    const arbMw = mwKey.match(/^\[(.+)\]$/);
    if (arbMw) {
      return `max-width: ${arbMw[1]};`;
    }
  }

  // Width & Height from spacing scale or arbitrary: w-*, h-*, min-h-[*]
  if (token.startsWith('w-')) {
    const wKey = token.slice(2);
    if (SPACING_SCALE[wKey]) return `width: ${SPACING_SCALE[wKey]};`;
    const arbW = wKey.match(/^\[(.+)\]$/);
    if (arbW) return `width: ${arbW[1]};`;
  }
  if (token.startsWith('h-')) {
    const hKey = token.slice(2);
    if (SPACING_SCALE[hKey]) return `height: ${SPACING_SCALE[hKey]};`;
    const arbH = hKey.match(/^\[(.+)\]$/);
    if (arbH) return `height: ${arbH[1]};`;
  }
  const minHArb = token.match(/^min-h-\[(.+)\]$/);
  if (minHArb) {
    return `min-height: ${minHArb[1]};`;
  }

  // Inset: inset-*, -inset-*, inset-x-*, -inset-x-*, inset-y-*, -inset-y-*
  const insetMatch = token.match(
    /^(-?)(inset|inset-x|inset-y)-(\d+(?:\.\d+)?|px)$/
  );
  if (insetMatch && SPACING_SCALE[insetMatch[3]]) {
    const sign = insetMatch[1] === '-' ? '-' : '';
    const val = `${sign}${SPACING_SCALE[insetMatch[3]]}`;
    if (insetMatch[2] === 'inset') {
      return `top: ${val}; right: ${val}; bottom: ${val}; left: ${val};`;
    }
    if (insetMatch[2] === 'inset-x') {
      return `left: ${val}; right: ${val};`;
    }
    if (insetMatch[2] === 'inset-y') {
      return `top: ${val}; bottom: ${val};`;
    }
  }

  // Positioned offsets: top-*, bottom-*, left-*, right-*, -top-*, -bottom-*, -left-*, -right-*
  const posOffsetMatch = token.match(
    /^(-?)(top|bottom|left|right)-(\d+(?:\.\d+)?|px)$/
  );
  if (posOffsetMatch && SPACING_SCALE[posOffsetMatch[3]]) {
    const sign = posOffsetMatch[1] === '-' ? '-' : '';
    const prop = posOffsetMatch[2];
    return `${prop}: ${sign}${SPACING_SCALE[posOffsetMatch[3]]};`;
  }

  // Gap: gap-*, gap-x-*, gap-y-*
  if (token.startsWith('gap-x-')) {
    const gx = SPACING_SCALE[token.slice(6)];
    if (gx) return `column-gap: ${gx};`;
  }
  if (token.startsWith('gap-y-')) {
    const gy = SPACING_SCALE[token.slice(6)];
    if (gy) return `row-gap: ${gy};`;
  }
  if (token.startsWith('gap-')) {
    const g = SPACING_SCALE[token.slice(4)];
    if (g) return `gap: ${g};`;
  }

  // Padding: p-*, px-*, py-*, pt-*, pr-*, pb-*, pl-*
  const padMatch = token.match(/^(p|px|py|pt|pr|pb|pl)-(\d+(?:\.\d+)?|px)$/);
  if (padMatch && SPACING_SCALE[padMatch[2]]) {
    const val = SPACING_SCALE[padMatch[2]];
    switch (padMatch[1]) {
      case 'p':
        return `padding: ${val};`;
      case 'px':
        return `padding-left: ${val}; padding-right: ${val};`;
      case 'py':
        return `padding-top: ${val}; padding-bottom: ${val};`;
      case 'pt':
        return `padding-top: ${val};`;
      case 'pr':
        return `padding-right: ${val};`;
      case 'pb':
        return `padding-bottom: ${val};`;
      case 'pl':
        return `padding-left: ${val};`;
    }
  }

  // Margin: m-*, mx-*, my-*, mt-*, mr-*, mb-*, ml-* (and negative margins -mt-*, -mr-*, -mb-*, -ml-*)
  const marginMatch = token.match(
    /^(-?)(m|mx|my|mt|mr|mb|ml)-(\d+(?:\.\d+)?|px)$/
  );
  if (marginMatch && SPACING_SCALE[marginMatch[3]]) {
    const sign = marginMatch[1] === '-' ? '-' : '';
    const val = `${sign}${SPACING_SCALE[marginMatch[3]]}`;
    switch (marginMatch[2]) {
      case 'm':
        return `margin: ${val};`;
      case 'mx':
        return `margin-left: ${val}; margin-right: ${val};`;
      case 'my':
        return `margin-top: ${val}; margin-bottom: ${val};`;
      case 'mt':
        return `margin-top: ${val};`;
      case 'mr':
        return `margin-right: ${val};`;
      case 'mb':
        return `margin-bottom: ${val};`;
      case 'ml':
        return `margin-left: ${val};`;
    }
  }

  // Border Radius: rounded, rounded-sm, rounded-lg, rounded-xl, rounded-2xl, rounded-3xl, rounded-full, rounded-[*], rounded-t-*, rounded-bl-none, etc.
  if (token === 'rounded') return `border-radius: ${RADIUS_SCALE.DEFAULT};`;
  if (token === 'rounded-bl-none') return 'border-bottom-left-radius: 0px;';
  if (token === 'rounded-br-none') return 'border-bottom-right-radius: 0px;';
  if (token === 'rounded-tl-none') return 'border-top-left-radius: 0px;';
  if (token === 'rounded-tr-none') return 'border-top-right-radius: 0px;';
  if (token.startsWith('rounded-t-')) {
    const r = RADIUS_SCALE[token.slice(10)];
    if (r) return `border-top-left-radius: ${r}; border-top-right-radius: ${r};`;
  }
  if (token.startsWith('rounded-b-')) {
    const r = RADIUS_SCALE[token.slice(10)];
    if (r)
      return `border-bottom-left-radius: ${r}; border-bottom-right-radius: ${r};`;
  }
  if (token.startsWith('rounded-')) {
    const rKey = token.slice(8);
    if (RADIUS_SCALE[rKey]) return `border-radius: ${RADIUS_SCALE[rKey]};`;
    const arbR = rKey.match(/^\[(.+)\]$/);
    if (arbR) return `border-radius: ${arbR[1]};`;
  }

  // Arbitrary line-height: leading-[1.6]
  const arbLeading = token.match(/^leading-\[(.+)\]$/);
  if (arbLeading) {
    return `line-height: ${arbLeading[1]};`;
  }

  // Font size OR Text Color: text-*
  if (token.startsWith('text-')) {
    const rest = token.slice(5);
    if (FONT_SIZE_SCALE[rest]) {
      return `font-size: ${FONT_SIZE_SCALE[rest].size}; line-height: ${FONT_SIZE_SCALE[rest].lineHeight};`;
    }
    const arbFontPx = rest.match(/^\[(\d+(?:\.\d+)?px)\]$/);
    if (arbFontPx) {
      return `font-size: ${arbFontPx[1]};`;
    }
    const resolvedTextColor = resolveColorToken(rest, colors);
    if (resolvedTextColor) {
      return `color: ${resolvedTextColor};`;
    }
  }

  // Text decoration color: decoration-pink-300, etc.
  if (token.startsWith('decoration-')) {
    const rest = token.slice(11);
    const resolvedDecColor = resolveColorToken(rest, colors);
    if (resolvedDecColor) {
      return `text-decoration-color: ${resolvedDecColor};`;
    }
  }

  // Ring color: ring-pink-300, ring-pink-400, etc.
  if (token.startsWith('ring-')) {
    const rest = token.slice(5);
    const resolvedRingColor = resolveColorToken(rest, colors);
    if (resolvedRingColor) {
      return `--tw-ring-color: ${resolvedRingColor};`;
    }
  }

  // Placeholder color: placeholder-pink-300, etc.
  if (token.startsWith('placeholder-')) {
    const rest = token.slice(12);
    const resolvedPhColor = resolveColorToken(rest, colors);
    if (resolvedPhColor) {
      return `color: ${resolvedPhColor};`;
    }
  }

  // Background Color: bg-*
  if (token.startsWith('bg-')) {
    const rest = token.slice(3);
    const resolvedBgColor = resolveColorToken(rest, colors);
    if (resolvedBgColor) {
      return `background-color: ${resolvedBgColor};`;
    }
  }

  // Border Color: border-*
  if (token.startsWith('border-')) {
    const rest = token.slice(7);
    const resolvedBorderColor = resolveColorToken(rest, colors);
    if (resolvedBorderColor) {
      return `border-color: ${resolvedBorderColor};`;
    }
  }

  // Gradient Stops: from-*, via-*, to-*
  if (token.startsWith('from-')) {
    const resolvedFrom = resolveColorToken(token.slice(5), colors);
    if (resolvedFrom) {
      return `--tw-gradient-from: ${resolvedFrom};`;
    }
  }
  if (token.startsWith('via-')) {
    const resolvedVia = resolveColorToken(token.slice(4), colors);
    if (resolvedVia) {
      return `--tw-gradient-via: ${resolvedVia}; background-image: linear-gradient(var(--tw-gradient-dir, to bottom), var(--tw-gradient-from, transparent), ${resolvedVia}, var(--tw-gradient-to, transparent));`;
    }
  }
  if (token.startsWith('to-')) {
    const resolvedTo = resolveColorToken(token.slice(3), colors);
    if (resolvedTo) {
      return `--tw-gradient-to: ${resolvedTo};`;
    }
  }

  return null;
}

/**
 * Computes a deterministic CSS cascade priority for a Tailwind core token so shorthand
 * utilities (`p-*`, `m-*`, `inset-*`, `border`, `rounded`, `flex`) always precede
 * axis/side-specific or override utilities (`px-*`, `pt-*`, `flex-col`, `hidden`).
 */
function getTokenCascadeOrder(coreToken: string): number {
  if (/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid)$/.test(coreToken)) return 10;
  if (/^(flex-row|flex-row-reverse|flex-col|flex-col-reverse|flex-wrap|flex-nowrap)$/.test(coreToken)) return 20;
  if (coreToken === 'hidden') return 30;
  if (/^-?inset-(\d|px)/.test(coreToken) || coreToken === 'inset-0') return 40;
  if (/^-?inset-[xy]-/.test(coreToken)) return 45;
  if (/^-?(top|right|bottom|left)-/.test(coreToken)) return 50;
  if (/^-?m-(\d|px|auto)/.test(coreToken)) return 60;
  if (/^-?m[xy]-/.test(coreToken)) return 65;
  if (/^-?m[trbl]-/.test(coreToken)) return 70;
  if (/^p-(\d|px)/.test(coreToken)) return 80;
  if (/^p[xy]-/.test(coreToken)) return 85;
  if (/^p[trbl]-/.test(coreToken)) return 90;
  if (/^border(-0|-2|-4)?$/.test(coreToken)) return 100;
  if (/^border-[trbl](-\d+)?$/.test(coreToken)) return 105;
  if (/^border-(solid|dashed|dotted|none)$/.test(coreToken)) return 110;
  if (/^border-/.test(coreToken)) return 115;
  if (/^rounded(-sm|-md|-lg|-xl|-2xl|-3xl|-full|-none|-\[)?$/.test(coreToken)) return 120;
  if (/^rounded-[tb]-/.test(coreToken)) return 125;
  if (/^rounded-(tl|tr|bl|br)-/.test(coreToken)) return 130;
  if (/^bg-gradient-/.test(coreToken)) return 140;
  if (/^(from|via|to)-/.test(coreToken)) return 145;
  if (coreToken === 'bg-clip-text' || coreToken === 'text-transparent') return 150;
  return 100;
}

// ===== CORE BUSINESS LOGIC =====

/**
 * Generates an inline CSS stylesheet for all Tailwind utility classes found in `doc`
 * when the document relies on `cdn.tailwindcss.com`.
 */
export function synthesizeTailwindStylesheet(doc: Document): string {
  const hasTailwindCdn = Array.from(doc.querySelectorAll('script[src]')).some(
    (s) => (s.getAttribute('src') || '').includes('cdn.tailwindcss.com')
  );
  const hasTailwindConfig = Array.from(doc.querySelectorAll('script')).some(
    (s) => (s.textContent || '').includes('tailwind.config')
  );

  if (!hasTailwindCdn && !hasTailwindConfig) {
    return '';
  }

  const colors = extractTailwindConfigColors(doc);
  const boxShadows = extractTailwindConfigBoxShadows(doc);
  const fonts = extractTailwindConfigFonts(doc);

  const uniqueClasses = new Set<string>();
  doc.querySelectorAll('[class]').forEach((el) => {
    const raw = el.getAttribute('class') || '';
    raw
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((cls) => uniqueClasses.add(cls));
  });

  const sortedClasses = Array.from(uniqueClasses).sort((a, b) => {
    const coreA = a.split(':').pop() || a;
    const coreB = b.split(':').pop() || b;
    return getTokenCascadeOrder(coreA) - getTokenCascadeOrder(coreB);
  });

  const baseRules: string[] = [
    `*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: #e5e7eb; }`,
    `body { margin: 0; font-family: ${fonts.bodyFont}; line-height: 1.5; }`,
    `h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd { margin: 0; }`,
    `ul, ol { list-style: none; margin: 0; padding: 0; }`,
    `a { color: inherit; text-decoration: inherit; }`,
    `button, input, optgroup, select, textarea { font-family: inherit; font-size: 100%; font-weight: inherit; line-height: inherit; color: inherit; margin: 0; padding: 0; background-color: transparent; background-image: none; }`,
    `button { cursor: pointer; }`,
    `img, svg, video, canvas { display: block; max-width: 100%; height: auto; }`,
    `@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }`,
    `@keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }`,
    `@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }`,
  ];

  if (uniqueClasses.has('no-scrollbar')) {
    baseRules.push(
      `.no-scrollbar::-webkit-scrollbar { display: none; }`,
      `.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`
    );
  }

  const smRules: string[] = [];
  const mdRules: string[] = [];
  const lgRules: string[] = [];
  const xlRules: string[] = [];

  sortedClasses.forEach((fullClass) => {
    const parts = fullClass.split(':');
    let breakpoint: 'base' | 'sm' | 'md' | 'lg' | 'xl' = 'base';
    let isHover = false;
    let isGroupHover = false;
    let isFocus = false;

    for (let i = 0; i < parts.length - 1; i++) {
      const prefix = parts[i];
      if (
        prefix === 'sm' ||
        prefix === 'md' ||
        prefix === 'lg' ||
        prefix === 'xl'
      ) {
        breakpoint = prefix;
      } else if (prefix === 'hover') {
        isHover = true;
      } else if (prefix === 'group-hover') {
        isGroupHover = true;
      } else if (prefix === 'focus' || prefix === 'focus-within') {
        isFocus = true;
      }
    }

    const coreToken = parts[parts.length - 1];
    const escapedClass = escapeCssClassName(fullClass);

    // Handle space-y-* and space-x-* child spacing utilities (including Elementor display:contents wrappers)
    const spaceYMatch = coreToken.match(/^space-y-(\d+(?:\.\d+)?|px)$/);
    if (spaceYMatch && SPACING_SCALE[spaceYMatch[1]]) {
      const val = SPACING_SCALE[spaceYMatch[1]];
      baseRules.push(
        `.${escapedClass} > :not([hidden]) ~ :not([hidden]), .${escapedClass} > :not([hidden]) ~ .el-native-html > .elementor-widget-container > * { margin-top: ${val} !important; }`
      );
      return;
    }

    const spaceXMatch = coreToken.match(/^space-x-(\d+(?:\.\d+)?|px)$/);
    if (spaceXMatch && SPACING_SCALE[spaceXMatch[1]]) {
      const val = SPACING_SCALE[spaceXMatch[1]];
      baseRules.push(
        `.${escapedClass} > :not([hidden]) ~ :not([hidden]) { margin-left: ${val} !important; }`
      );
      return;
    }

    let decl = generateDeclarationForToken(
      coreToken,
      colors,
      boxShadows,
      fonts
    );
    if (!decl) return;

    // Ensure responsive :hidden (e.g. lg:hidden, sm:hidden) uses !important so Elementor container/widget display rules never override it
    if (coreToken === 'hidden' && breakpoint !== 'base') {
      decl = 'display: none !important; --display: none !important;';
    }

    let selector = `.${escapedClass}`;
    if (coreToken.startsWith('placeholder-')) {
      selector = `.${escapedClass}::placeholder`;
    } else if (isGroupHover) {
      selector = `.group:hover .${escapedClass}`;
    } else if (isHover) {
      selector = `.${escapedClass}:hover`;
    } else if (isFocus) {
      selector = `.${escapedClass}:focus`;
    }

    const rule = `${selector} { ${decl} }`;

    switch (breakpoint) {
      case 'sm':
        smRules.push(rule);
        break;
      case 'md':
        mdRules.push(rule);
        break;
      case 'lg':
        lgRules.push(rule);
        break;
      case 'xl':
        xlRules.push(rule);
        break;
      default:
        baseRules.push(rule);
        break;
    }
  });

  const mediaSections: string[] = [];

  // Enforce mobile/tablet hiding for elements combining `.hidden` with `sm:*`, `md:*`, `lg:*` display classes
  // so Elementor's `.el-block-con` or `.el-native-inline` never leaks desktop-only elements onto mobile
  if (uniqueClasses.has('hidden')) {
    mediaSections.push(
      `@media (max-width: 639.98px) {\n  .hidden.sm\\:block, .hidden.sm\\:flex, .hidden.sm\\:inline-flex, .hidden.sm\\:grid, .hidden.sm\\:inline { display: none !important; --display: none !important; }\n}`,
      `@media (max-width: 767.98px) {\n  .hidden.md\\:block, .hidden.md\\:flex, .hidden.md\\:inline-flex, .hidden.md\\:grid, .hidden.md\\:inline { display: none !important; --display: none !important; }\n}`,
      `@media (max-width: 1023.98px) {\n  .hidden.lg\\:block, .hidden.lg\\:flex, .hidden.lg\\:inline-flex, .hidden.lg\\:grid, .hidden.lg\\:inline { display: none !important; --display: none !important; }\n}`
    );
  }

  if (smRules.length > 0) {
    mediaSections.push(
      `@media (min-width: 640px) {\n  ${smRules.join('\n  ')}\n}`
    );
  }
  if (mdRules.length > 0) {
    mediaSections.push(
      `@media (min-width: 768px) {\n  ${mdRules.join('\n  ')}\n}`
    );
  }
  if (lgRules.length > 0) {
    mediaSections.push(
      `@media (min-width: 1024px) {\n  ${lgRules.join('\n  ')}\n}`
    );
  }
  if (xlRules.length > 0) {
    mediaSections.push(
      `@media (min-width: 1280px) {\n  ${xlRules.join('\n  ')}\n}`
    );
  }

  return [...baseRules, ...mediaSections].join('\n');
}

export const MATERIAL_ICON_TO_FA_MAP: Record<string, string> = {
  help_outline: 'fas fa-question-circle',
  search: 'fas fa-search',
  expand_more: 'fas fa-chevron-down',
  expand_less: 'fas fa-chevron-up',
  keyboard_arrow_down: 'fas fa-chevron-down',
  keyboard_arrow_up: 'fas fa-chevron-up',
  keyboard_arrow_left: 'fas fa-chevron-left',
  keyboard_arrow_right: 'fas fa-chevron-right',
  arrow_back: 'fas fa-arrow-right',
  arrow_forward: 'fas fa-arrow-left',
  check: 'fas fa-check',
  check_circle: 'fas fa-check-circle',
  close: 'fas fa-times',
  menu: 'fas fa-bars',
  shopping_bag: 'fas fa-shopping-bag',
  shopping_cart: 'fas fa-shopping-cart',
  favorite: 'fas fa-heart',
  favorite_border: 'far fa-heart',
  person: 'fas fa-user',
  person_outline: 'far fa-user',
  star: 'fas fa-star',
  star_border: 'far fa-star',
  star_half: 'fas fa-star-half-alt',
  local_shipping: 'fas fa-shipping-fast',
  verified_user: 'fas fa-user-shield',
  support_agent: 'fas fa-headset',
  phone: 'fas fa-phone-alt',
  email: 'fas fa-envelope',
  location_on: 'fas fa-map-marker-alt',
  schedule: 'far fa-clock',
  info: 'fas fa-info-circle',
  warning: 'fas fa-exclamation-triangle',
  error: 'fas fa-exclamation-circle',
  add: 'fas fa-plus',
  remove: 'fas fa-minus',
  delete: 'fas fa-trash',
  edit: 'fas fa-edit',
  share: 'fas fa-share-alt',
  visibility: 'fas fa-eye',
  visibility_off: 'fas fa-eye-slash',
  lock: 'fas fa-lock',
  settings: 'fas fa-cog',
  home: 'fas fa-home',
};

/**
 * Replaces external `cdn.tailwindcss.com` script with an inline compiled `<style id="tw-offline-fallback">`
 * so the sandbox measurement iframe renders deterministically in <30ms without network latency or CDN failures.
 */
export function injectOfflineTailwindForSandbox(rawHtml: string): string {
  if (!TAILWIND_CDN_SCRIPT_REGEX.test(rawHtml)) {
    return rawHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const css = synthesizeTailwindStylesheet(doc);
  if (!css) return rawHtml;

  return rawHtml.replace(
    TAILWIND_CDN_SCRIPT_REGEX,
    `<style id="tw-offline-fallback">\n${css}\n</style>`
  );
}
