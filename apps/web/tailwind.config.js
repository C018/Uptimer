/**
 * Apple design language tokens (iOS / macOS Human Interface Guidelines).
 *
 * Strategy
 * --------
 * The whole app (public status page, incident history, admin dashboard,
 * analytics, forms, charts) already styles itself through Tailwind utilities.
 * Instead of rewriting thousands of class names page by page, the palettes
 * that the app already uses are re-pointed at Apple's *system colours*
 * (systemBlue / systemGreen / systemRed / systemOrange / systemGray ...).
 *
 * One source of truth → every existing `bg-slate-50`, `text-slate-700`,
 * `bg-emerald-50`, `ring-red-600/20`, `dark:bg-slate-800` … immediately
 * renders in the Apple palette, in both light and dark appearance.
 */

/** Apple system colours — light appearance. */
const light = {
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  orange: '#FF9500',
  pink: '#FF2D55',
  purple: '#AF52DE',
  red: '#FF3B30',
  teal: '#5AC8FA',
  yellow: '#FFCC00',
};

/** Apple system colours — dark appearance. */
const dark = {
  blue: '#0A84FF',
  green: '#30D158',
  indigo: '#5E5CE6',
  orange: '#FF9F0A',
  pink: '#FF375F',
  purple: '#BF5AF2',
  red: '#FF453A',
  teal: '#64D2FF',
  yellow: '#FFD60A',
};

/**
 * Static 50→950 ramps derived from the Apple system colours.
 * Plain hex on purpose: keeps Tailwind's slash-opacity modifiers
 * (`bg-red-500/20`, `ring-blue-600/30`, …) working across the whole app.
 */
const greenRamp = {
  50: '#EAF9EF',
  100: '#D6F3E0',
  200: '#ADE7C1',
  300: '#7ED9A0',
  400: '#52CE7C',
  500: '#34C759',
  600: '#2BA84B',
  700: '#22883D',
  800: '#1A6930',
  900: '#125023',
  950: '#0A3316',
  DEFAULT: '#34C759',
  dark: '#30D158',
};

const redRamp = {
  50: '#FFEDEC',
  100: '#FFDCDA',
  200: '#FFB9B6',
  300: '#FF918C',
  400: '#FF6B64',
  500: '#FF3B30',
  600: '#D92F26',
  700: '#B3241C',
  800: '#8C1A14',
  900: '#66110D',
  950: '#400A07',
  DEFAULT: '#FF3B30',
  dark: '#FF453A',
};

const blueRamp = {
  50: '#EAF3FF',
  100: '#D6E8FF',
  200: '#ADD0FF',
  300: '#85B8FF',
  400: '#4A9BFF',
  500: '#007AFF',
  600: '#0066D6',
  700: '#0052AD',
  800: '#003E82',
  900: '#002A5A',
  950: '#001838',
  DEFAULT: '#007AFF',
  dark: '#0A84FF',
};

const orangeRamp = {
  50: '#FFF4E5',
  100: '#FFE9CC',
  200: '#FFD399',
  300: '#FFBC66',
  400: '#FFA833',
  500: '#FF9500',
  600: '#D67D00',
  700: '#AD6400',
  800: '#804A00',
  900: '#573200',
  950: '#331E00',
  DEFAULT: '#FF9500',
  dark: '#FF9F0A',
};

const yellowRamp = {
  50: '#FFFAE5',
  100: '#FFF5CC',
  200: '#FFEB99',
  300: '#FFE680',
  400: '#FFD940',
  500: '#FFCC00',
  600: '#D6AB00',
  700: '#AD8B00',
  800: '#806700',
  900: '#574600',
  950: '#332900',
  DEFAULT: '#FFCC00',
  dark: '#FFD60A',
};

const tealRamp = {
  50: '#EEF9FF',
  100: '#DDF3FE',
  200: '#C0E9FD',
  300: '#A3E0FC',
  400: '#7ED4FB',
  500: '#5AC8FA',
  600: '#4AA8D3',
  700: '#3A87AB',
  800: '#2A6480',
  900: '#1C4256',
  950: '#0F2634',
  DEFAULT: '#5AC8FA',
  dark: '#64D2FF',
};

const indigoRamp = {
  50: '#EEEEFA',
  100: '#DDDDF5',
  200: '#C1C0EE',
  300: '#A5A3E8',
  400: '#8280DF',
  500: '#5856D6',
  600: '#4745B3',
  700: '#373690',
  800: '#29286C',
  900: '#1B1A48',
  950: '#0F0E2A',
  DEFAULT: '#5856D6',
  dark: '#5E5CE6',
};

const purpleRamp = {
  50: '#F7EDFB',
  100: '#EFDCF7',
  200: '#E4C1F1',
  300: '#D8A6EC',
  400: '#C77CE3',
  500: '#AF52DE',
  600: '#9345BA',
  700: '#773895',
  800: '#592A70',
  900: '#3C1C4B',
  950: '#220F2B',
  DEFAULT: '#AF52DE',
  dark: '#BF5AF2',
};

const pinkRamp = {
  50: '#FFEAEF',
  100: '#FFD5DF',
  200: '#FFB0C0',
  300: '#FF8AA0',
  400: '#FF5C79',
  500: '#FF2D55',
  600: '#D62547',
  700: '#AD1E39',
  800: '#80162A',
  900: '#560F1C',
  950: '#330810',
  DEFAULT: '#FF2D55',
  dark: '#FF375F',
};

/**
 * Apple system grays. `slate` is re-pointed at these so grouped backgrounds,
 * separators and label colours follow HIG (systemGroupedBackground #F2F2F7,
 * secondarySystemBackground #1C1C1E, tertiarySystemBackground #2C2C2E …).
 */
const systemGray = {
  50: '#F2F2F7', // systemGroupedBackground (light)
  100: '#E5E5EA', // systemGray5
  200: '#D1D1D6', // separator (light)
  300: '#C7C7CC', // systemGray4
  400: '#AEAEB2', // tertiaryLabel (light)
  500: '#8E8E93', // systemGray
  600: '#636366', // systemGray2 (dark)
  700: '#48484A', // systemGray3 (dark)
  800: '#2C2C2E', // tertiarySystemBackground (dark)
  900: '#1C1C1E', // secondarySystemBackground (dark)
  950: '#000000', // systemBackground (dark)
  DEFAULT: '#8E8E93',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Existing palettes re-pointed at Apple system colours.
        slate: systemGray,
        gray: systemGray,
        zinc: systemGray,
        neutral: systemGray,
        stone: systemGray,
        emerald: greenRamp,
        green: greenRamp,
        red: redRamp,
        rose: redRamp,
        blue: blueRamp,
        sky: tealRamp,
        teal: tealRamp,
        amber: orangeRamp,
        orange: orangeRamp,
        yellow: yellowRamp,
        indigo: indigoRamp,
        violet: purpleRamp,
        purple: purpleRamp,
        pink: pinkRamp,

        // Brand accent = systemBlue (Apple's default tint colour).
        brand: blueRamp,

        // Semantic status colours (state page vocabulary).
        // Pointed at the CSS tokens instead of a second copy of the hex values,
        // so `bg-status-up` and `var(--color-up)` can never disagree. Note:
        // Tailwind cannot apply slash-opacity (`bg-status-up/20`) to a `var()`
        // colour — use the `ui-surface-*` / `ui-border-*` utilities for tints.
        status: {
          up: 'var(--color-up)',
          down: 'var(--color-down)',
          maintenance: 'var(--color-maintenance)',
          paused: 'var(--color-paused)',
          unknown: 'var(--color-unknown)',
        },

        // Direct HIG tokens for new markup.
        apple: {
          blue: light.blue,
          green: light.green,
          indigo: light.indigo,
          orange: light.orange,
          pink: light.pink,
          purple: light.purple,
          red: light.red,
          teal: light.teal,
          yellow: light.yellow,
          'blue-dark': dark.blue,
          'green-dark': dark.green,
          'red-dark': dark.red,
          'orange-dark': dark.orange,
        },
        separator: 'var(--color-border)',
        label: 'var(--color-text-primary)',
        'label-secondary': 'var(--color-text-secondary)',
        'label-tertiary': 'var(--color-text-muted)',
        fill: 'var(--color-bg-secondary)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI Variable Text',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei UI',
          'Noto Sans SC',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI Variable Display',
          'Segoe UI',
          'PingFang SC',
          'Noto Sans SC',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SF Mono',
          'SFMono-Regular',
          'JetBrains Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      // HIG text styles (iOS point sizes).
      fontSize: {
        'large-title': ['2.125rem', { lineHeight: '1.15', letterSpacing: '-0.022em' }],
        'title-1': ['1.75rem', { lineHeight: '1.18', letterSpacing: '-0.02em' }],
        'title-2': ['1.375rem', { lineHeight: '1.22', letterSpacing: '-0.016em' }],
        'title-3': ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.012em' }],
        headline: ['1.0625rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
        body: ['1.0625rem', { lineHeight: '1.45' }],
        callout: ['1rem', { lineHeight: '1.45' }],
        subhead: ['0.9375rem', { lineHeight: '1.4' }],
        footnote: ['0.8125rem', { lineHeight: '1.35' }],
        'caption-1': ['0.75rem', { lineHeight: '1.3' }],
        'caption-2': ['0.6875rem', { lineHeight: '1.3' }],
      },
      borderRadius: {
        xl: '1.125rem',
        '2xl': '1.375rem',
        '3xl': '1.75rem',
        apple: '0.625rem',
        'apple-md': '0.75rem',
        'apple-lg': '1.125rem',
        'apple-xl': '1.375rem',
        'apple-2xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 18px -10px rgba(0, 0, 0, 0.16)',
        'soft-lg': '0 2px 6px rgba(0, 0, 0, 0.05), 0 14px 34px -16px rgba(0, 0, 0, 0.22)',
        'glow-green': '0 0 20px -5px color-mix(in srgb, #34C759 45%, transparent)',
        'glow-red': '0 0 20px -5px color-mix(in srgb, #FF3B30 45%, transparent)',
        // Apple elevation: barely-there ambient + soft directional.
        apple: '0 1px 1px rgba(0, 0, 0, 0.03), 0 4px 14px -8px rgba(0, 0, 0, 0.18)',
        'apple-hover': '0 2px 4px rgba(0, 0, 0, 0.05), 0 12px 28px -12px rgba(0, 0, 0, 0.24)',
        'apple-sheet': '0 -2px 24px -6px rgba(0, 0, 0, 0.28)',
        'apple-inset': 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.04)',
      },
      backdropBlur: {
        apple: '20px',
        'apple-thick': '32px',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-out': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slideUp 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-sheet': 'appleSheet 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-pop': 'applePop 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        appleSheet: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        applePop: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      ringWidth: {
        3: '3px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [
    // Semantic status helpers. Declared as Tailwind utilities (not plain CSS
    // classes) so that variants such as `hover:ui-surface-down` or
    // `dark:ui-text-up` are actually generated.
    ({ addUtilities }) => {
      const alpha = (token, pct) =>
        `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

      addUtilities({
        '.ui-text-up': { color: 'var(--color-up)' },
        '.ui-text-down': { color: 'var(--color-down)' },
        '.ui-text-warn': { color: 'var(--color-paused)' },
        '.ui-text-accent': { color: 'var(--color-accent)' },
        '.ui-text-maintenance': { color: 'var(--color-maintenance)' },

        '.ui-border-hairline': { borderColor: 'var(--color-border-light)' },
        '.ui-border-up': { borderColor: alpha('--color-up', 34) },
        '.ui-border-down': { borderColor: alpha('--color-down', 34) },
        '.ui-border-warn': { borderColor: alpha('--color-paused', 34) },
        '.ui-border-accent': { borderColor: alpha('--color-accent', 34) },

        '.ui-surface-up': {
          backgroundColor: alpha('--color-up', 12),
          borderColor: alpha('--color-up', 26),
        },
        '.ui-surface-down': {
          backgroundColor: alpha('--color-down', 12),
          borderColor: alpha('--color-down', 26),
        },
        '.ui-surface-warn': {
          backgroundColor: alpha('--color-paused', 12),
          borderColor: alpha('--color-paused', 26),
        },
        '.ui-surface-accent': {
          backgroundColor: alpha('--color-accent', 12),
          borderColor: alpha('--color-accent', 26),
        },
        '.ui-surface-neutral': {
          backgroundColor: alpha('--color-unknown', 12),
          borderColor: alpha('--color-unknown', 26),
        },
      });
    },
  ],
};
