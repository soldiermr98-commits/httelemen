// ===== IMPORTS & DEPENDENCIES =====
import {
  BoxEdges,
  ElementorBoxShadow,
  ElementorDimension,
} from '../types/elementor';

// ===== CONFIGURATION & CONSTANTS =====
const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'inherit',
  'initial',
  'unset',
]);

// ===== UTILITY FUNCTIONS =====

/**
 * Rounds any CSS font-weight string/number to the nearest standard 100-900 value.
 */
export function normalizeFontWeight(rawWeight: string | number | undefined): string {
  if (rawWeight === undefined || rawWeight === null) return '400';
  const str = String(rawWeight).trim().toLowerCase();
  if (str === 'normal' || str === 'regular') return '400';
  if (str === 'bold') return '700';
  if (str === 'bolder') return '800';
  if (str === 'lighter') return '300';

  const parsed = parseFloat(str);
  if (!Number.isFinite(parsed)) return '400';

  const rounded = Math.round(parsed / 100) * 100;
  const clamped = Math.min(900, Math.max(100, rounded));
  return String(clamped);
}

/**
 * Converts CSS rgb/rgba or named/hex colors into standard Elementor hex or rgba strings.
 */
export function normalizeColor(cssColor: string): string {
  if (!cssColor) return '';
  const trimmed = cssColor.trim().toLowerCase();
  if (
    trimmed === 'transparent' ||
    trimmed === 'rgba(0, 0, 0, 0)' ||
    trimmed === 'rgba(0,0,0,0)' ||
    trimmed === 'none'
  ) {
    return '';
  }

  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    return trimmed.toUpperCase();
  }

  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)/
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;

    if (a === 0) return '';
    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
    }
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return cssColor;
}

/**
 * Parses a pixel float value safely.
 */
export function parsePx(val: string | null | undefined, fallback = 0): number {
  if (!val) return fallback;
  const num = parseFloat(val);
  return Number.isFinite(num) ? Math.round(num) : fallback;
}

/**
 * Builds an official Elementor Size object: { unit, size, sizes: [] }
 */
export function formatSize(
  size: number,
  unit: 'px' | 'em' | 'rem' | '%' | 'vw' | 'vh' = 'px'
): { unit: string; size: number; sizes: never[] } {
  return {
    unit,
    size: Number(size.toFixed(2)),
    sizes: [],
  };
}

/**
 * Builds an official Elementor Dimension object: { unit, top, right, bottom, left, isLinked }
 */
export function buildElementorDimension(
  edges: BoxEdges,
  unit: 'px' | 'em' | 'rem' | '%' = 'px'
): ElementorDimension {
  const top = Math.round(edges.top);
  const right = Math.round(edges.right);
  const bottom = Math.round(edges.bottom);
  const left = Math.round(edges.left);
  const isLinked = top === right && right === bottom && bottom === left;

  return {
    unit,
    top: String(top),
    right: String(right),
    bottom: String(bottom),
    left: String(left),
    isLinked,
  };
}

export const formatDimension = buildElementorDimension;

/**
 * Checks whether a BoxEdges object has any non-zero value.
 */
export function hasNonZeroEdges(edges?: BoxEdges): boolean {
  if (!edges) return false;
  return (
    Math.abs(edges.top) > 0 ||
    Math.abs(edges.right) > 0 ||
    Math.abs(edges.bottom) > 0 ||
    Math.abs(edges.left) > 0
  );
}

export function edgesZero(edges?: BoxEdges): boolean {
  return !hasNonZeroEdges(edges);
}

/**
 * Compares two BoxEdges objects to determine if responsive override differs from desktop.
 */
export function edgesDiffer(a?: BoxEdges, b?: BoxEdges): boolean {
  if (!a || !b) return false;
  return (
    Math.round(a.top) !== Math.round(b.top) ||
    Math.round(a.right) !== Math.round(b.right) ||
    Math.round(a.bottom) !== Math.round(b.bottom) ||
    Math.round(a.left) !== Math.round(b.left)
  );
}

/**
 * Extracts primary font family name and determines if it's a custom web font.
 */
export function extractPrimaryFont(cssFontFamily: string): {
  primaryFont: string;
  isCustomFont: boolean;
} {
  if (!cssFontFamily) {
    return { primaryFont: '', isCustomFont: false };
  }
  const candidates = cssFontFamily
    .split(',')
    .map((f) => f.trim().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!GENERIC_FONT_FAMILIES.has(candidate.toLowerCase())) {
      return { primaryFont: candidate, isCustomFont: true };
    }
  }

  return {
    primaryFont: candidates[0] || 'sans-serif',
    isCustomFont: false,
  };
}

/**
 * Parses CSS box-shadow string into Elementor box_shadow structure.
 */
export function parseBoxShadow(cssBoxShadow: string): ElementorBoxShadow | null {
  if (!cssBoxShadow || cssBoxShadow === 'none') return null;

  let color = 'rgba(0,0,0,0.15)';
  let remainder = cssBoxShadow.trim();

  const rgbaMatch = remainder.match(/rgba?\([^)]+\)/i);
  if (rgbaMatch) {
    color = normalizeColor(rgbaMatch[0]) || color;
    remainder = remainder.replace(rgbaMatch[0], '').trim();
  } else {
    const hexMatch = remainder.match(/#[0-9a-f]{3,8}/i);
    if (hexMatch) {
      color = normalizeColor(hexMatch[0]) || color;
      remainder = remainder.replace(hexMatch[0], '').trim();
    }
  }

  remainder = remainder.replace(/\binset\b/gi, '').trim();
  const nums = remainder
    .split(/\s+/)
    .map((part) => parseFloat(part))
    .filter((n) => Number.isFinite(n));

  if (nums.length < 2) return null;

  return {
    horizontal: Math.round(nums[0] || 0),
    vertical: Math.round(nums[1] || 0),
    blur: Math.round(nums[2] || 0),
    spread: Math.round(nums[3] || 0),
    color,
  };
}

/**
 * Parses CSS linear-gradient into Elementor gradient settings.
 */
export function parseLinearGradient(bgImage: string): {
  angle: number;
  colorA: string;
  colorB: string;
} | null {
  if (!bgImage || !bgImage.includes('linear-gradient')) return null;

  let angle = 180;
  const degMatch = bgImage.match(/(-?\d+(?:\.\d+)?)deg/i);
  if (degMatch) {
    angle = Math.round(parseFloat(degMatch[1]));
  } else if (bgImage.includes('to right')) {
    angle = 90;
  } else if (bgImage.includes('to left')) {
    angle = 270;
  } else if (bgImage.includes('to top')) {
    angle = 0;
  } else if (bgImage.includes('to bottom right')) {
    angle = 135;
  }

  const colorMatches = bgImage.match(
    /(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/g
  );
  if (!colorMatches || colorMatches.length < 2) return null;

  const colorA = normalizeColor(colorMatches[0]) || '#4F46E5';
  const colorB = normalizeColor(colorMatches[colorMatches.length - 1]) || '#06B6D4';

  return { angle, colorA, colorB };
}

/**
 * Extracts background image URL from CSS background-image property.
 */
export function extractCssUrl(bgImage: string): string | null {
  if (!bgImage || bgImage === 'none' || bgImage.includes('gradient(')) {
    return null;
  }
  const match = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/i);
  return match ? match[1].trim() : null;
}
