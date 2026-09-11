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

  axis: '#9AA3B5',
  grid: 'rgba(255, 255, 255, 0.13)',
  tooltipBg: 'rgba(26, 34, 50, 0.94)',
  tooltipBorder: 'rgba(255, 255, 255, 0.16)',
  tooltipText: '#F7FAFF',
  linePrimary: '#30D158',
  lineSecondary: '#636366',
};

export function chartPalette(isDark: boolean): AppleChartPalette {
  return isDark ? darkChartPalette : lightChartPalette;
}

/** Muted fill used for "no data" cells in both appearances. */
export function unknownFill(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(16, 32, 58, 0.2)';
}
