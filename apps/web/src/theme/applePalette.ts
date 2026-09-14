/**
 * Apple (HIG) chart palette.
 *
 * Charts (Recharts props, inline SVG, SVG data-URIs) cannot take a
 * `var(--token)` string, so previously this module mirrored the Apple system
 * colours as hardcoded hex pairs and relied on a human to keep them in sync
 * with `styles.css` — which had already drifted (`maintenance`, dark `unknown`).
 *
 * It now resolves the real design tokens from the document root at runtime
 * (once per appearance, then cached). The literal palettes below are the
 * last-resort fallbacks used when there is no DOM (SSR / tests) or when the
 * stylesheet did not load; they intentionally name the same tokens.
 */

export interface AppleChartPalette {
  /** Status colours. */
  up: string;
  down: string;
  maintenance: string;
  paused: string;
  unknown: string;
  accent: string;

  /** Uptime tier ramp (best → worst), used by the 30-day strips. */
  tierBest: string;
  tierGood: string;
  tierFair: string;
  tierPoor: string;

  /** Chrome. */
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  linePrimary: string;
  lineSecondary: string;
}

/**
 * CSS custom property backing each palette entry. Status ramps point at the
 * shared `--color-*` tokens, so this file no longer holds a second copy of
 * the status palette.
 */
const TOKEN_NAMES: Record<keyof AppleChartPalette, string> = {
  up: '--color-up',
  down: '--color-down',
  maintenance: '--color-maintenance',
  paused: '--color-paused',
  unknown: '--color-unknown',
  accent: '--color-accent',
  tierBest: '--chart-tier-best',
  tierGood: '--chart-tier-good',
  tierFair: '--chart-tier-fair',
  tierPoor: '--chart-tier-poor',
  axis: '--chart-axis',
  grid: '--chart-grid',
  tooltipBg: '--chart-tooltip-bg',
  tooltipBorder: '--chart-tooltip-border',
  tooltipText: '--chart-tooltip-text',
  linePrimary: '--chart-line-primary',
  lineSecondary: '--chart-line-secondary',
};

const UNKNOWN_FILL_TOKEN = '--chart-unknown-fill';

/** Light appearance — fallback values mirroring `:root` in `styles.css`. */
export const lightChartPalette: AppleChartPalette = {
  up: '#34C759', // systemGreen
  down: '#FF3B30', // systemRed
  maintenance: '#0071E3', // systemBlue
  paused: '#FF9500', // systemOrange
  unknown: '#8E8E93', // systemGray
  accent: '#0071E3', // systemBlue

  tierBest: '#34C759', // ≥ 99.9 %
  tierGood: '#FFCC00', // ≥ 99 %
  tierFair: '#FF9500', // ≥ 95 %
  tierPoor: '#FF3B30', // < 95 %

  axis: '#8E8E93',
  grid: 'rgba(16, 32, 58, 0.10)',
  tooltipBg: 'rgba(255, 255, 255, 0.92)',
  tooltipBorder: 'rgba(16, 32, 58, 0.12)',
  tooltipText: '#14213D',
  linePrimary: '#34C759',
  lineSecondary: '#8E8E93',
};

/** Dark appearance — fallback values mirroring `.dark` in `styles.css`. */
export const darkChartPalette: AppleChartPalette = {
  up: '#30D158',
  down: '#FF453A',
  maintenance: '#0A84FF',
  paused: '#FF9F0A',
  unknown: '#98989D', // was #8E8E93 (light gray) — drifted from --color-unknown
  accent: '#0A84FF',

  tierBest: '#30D158',
  tierGood: '#FFD60A',
  tierFair: '#FF9F0A',
  tierPoor: '#FF453A',

  axis: '#9AA3B5',
  grid: 'rgba(255, 255, 255, 0.13)',
  tooltipBg: 'rgba(26, 34, 50, 0.94)',
  tooltipBorder: 'rgba(255, 255, 255, 0.16)',
  tooltipText: '#F7FAFF',
  linePrimary: '#30D158',
  lineSecondary: '#636366',
};

const paletteCache = new Map<boolean, AppleChartPalette>();
const unknownFillCache = new Map<boolean, string>();

function readRootStyle(): CSSStyleDeclaration | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const root = document.documentElement;
  if (!root) return null;
  return window.getComputedStyle(root);
}

function resolvePalette(isDark: boolean): AppleChartPalette {
  const fallback = isDark ? darkChartPalette : lightChartPalette;
  const styles = readRootStyle();
  if (!styles) return fallback;

  const resolved: AppleChartPalette = { ...fallback };
  (Object.keys(TOKEN_NAMES) as (keyof AppleChartPalette)[]).forEach((key) => {
    const value = styles.getPropertyValue(TOKEN_NAMES[key]).trim();
    if (value) resolved[key] = value;
  });
  return resolved;
}

/**
 * Chart palette for the current appearance, resolved from the CSS tokens the
 * first time it is requested and then reused (charts call this per series and
 * per bar, so `getComputedStyle` must not run in a render loop).
 */
export function chartPalette(isDark: boolean): AppleChartPalette {
  const cached = paletteCache.get(isDark);
  if (cached) return cached;

  const palette = resolvePalette(isDark);
  paletteCache.set(isDark, palette);
  return palette;
}

/** Muted fill used for "no data" cells in both appearances. */
export function unknownFill(isDark: boolean): string {
  const cached = unknownFillCache.get(isDark);
  if (cached) return cached;

  const fromToken = readRootStyle()?.getPropertyValue(UNKNOWN_FILL_TOKEN).trim();
  const fill = fromToken || (isDark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(16, 32, 58, 0.2)');
  unknownFillCache.set(isDark, fill);
  return fill;
}

/** Invalidate the memoised tokens (styles.css hot reload, token refresh). */
export function resetChartPaletteCache(): void {
  paletteCache.clear();
  unknownFillCache.clear();
}
