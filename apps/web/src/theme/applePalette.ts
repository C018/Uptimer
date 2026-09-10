/**
 * Apple (HIG) chart palette.
 *
 * Recharts and the inline-SVG widgets cannot consume the CSS custom
 * properties defined in `styles.css` (an SVG data-URI has no access to the
 * page cascade), so the same Apple system colours are mirrored here as plain
 * hex values, in a light and a dark appearance.
 *
 * Keep this list in sync with the `--color-*` tokens in `styles.css`.
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

/** Light appearance — Apple system colours (light variants). */
export const lightChartPalette: AppleChartPalette = {
  up: '#34C759', // systemGreen
  down: '#FF3B30', // systemRed
  maintenance: '#007AFF', // systemBlue
  paused: '#FF9500', // systemOrange
  unknown: '#8E8E93', // systemGray
  accent: '#007AFF', // systemBlue

  tierBest: '#34C759', // ≥ 99.9 %
  tierGood: '#FFCC00', // ≥ 99 %
  tierFair: '#FF9500', // ≥ 95 %
  tierPoor: '#FF3B30', // < 95 %

  axis: '#8E8E93',
  grid: '#E5E5EA',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E5E5EA',
  tooltipText: '#1C1C1E',
  linePrimary: '#34C759',
  lineSecondary: '#8E8E93',
};

/** Dark appearance — Apple system colours (dark variants). */
export const darkChartPalette: AppleChartPalette = {
  up: '#30D158',
  down: '#FF453A',
  maintenance: '#0A84FF',
  paused: '#FF9F0A',
  unknown: '#8E8E93',
  accent: '#0A84FF',

  tierBest: '#30D158',
  tierGood: '#FFD60A',
  tierFair: '#FF9F0A',
  tierPoor: '#FF453A',

  axis: '#8E8E93',
  grid: '#38383A',
  tooltipBg: '#1C1C1E',
  tooltipBorder: '#38383A',
  tooltipText: '#F2F2F7',
  linePrimary: '#30D158',
  lineSecondary: '#636366',
};

export function chartPalette(isDark: boolean): AppleChartPalette {
  return isDark ? darkChartPalette : lightChartPalette;
}

/** Muted fill used for "no data" cells in both appearances. */
export function unknownFill(isDark: boolean): string {
  return isDark ? '#3A3A3C' : '#D1D1D6';
}
