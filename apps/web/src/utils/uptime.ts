import type { UptimeColorTier, UptimeRatingLevel } from '../api/types';

// ──────── Thresholds ────────

export const UPTIME_THRESHOLDS_BY_LEVEL: Record<
  UptimeRatingLevel,
  {
    emerald: number;
    green: number;
    lime: number;
    yellow: number;
    amber: number;
    orange: number;
    red: number;
  }
> = {
  1: { emerald: 99.0, green: 98.0, lime: 97.0, yellow: 96.0, amber: 95.0, orange: 90.0, red: 80.0 },
  2: { emerald: 99.9, green: 99.5, lime: 99.0, yellow: 98.5, amber: 98.0, orange: 97.0, red: 95.0 },
  3: {
    emerald: 99.99,
    green: 99.95,
    lime: 99.9,
    yellow: 99.5,
    amber: 99.0,
    orange: 98.0,
    red: 97.0,
  },
  4: {
    emerald: 99.999,
    green: 99.995,
    lime: 99.99,
    yellow: 99.95,
    amber: 99.9,
    orange: 99.5,
    red: 99.0,
  },
  5: {
    emerald: 100.0,
    green: 99.999,
    lime: 99.995,
    yellow: 99.99,
    amber: 99.95,
    orange: 99.9,
    red: 99.5,
  },
};

// ──────── Tier resolution ────────

export function getUptimeTier(uptimePct: number, level: UptimeRatingLevel): UptimeColorTier {
  if (!Number.isFinite(uptimePct)) return 'slate';

  const t = UPTIME_THRESHOLDS_BY_LEVEL[level] ?? UPTIME_THRESHOLDS_BY_LEVEL[3];

  if (uptimePct >= t.emerald) return 'emerald';
  if (uptimePct >= t.green) return 'green';
  if (uptimePct >= t.lime) return 'lime';
  if (uptimePct >= t.yellow) return 'yellow';
  if (uptimePct >= t.amber) return 'amber';
  if (uptimePct >= t.orange) return 'orange';
  if (uptimePct >= t.red) return 'red';
  return 'rose';
}

// ──────── Tailwind class mappings ────────

export function getUptimeBgClasses(tier: UptimeColorTier): string {
  switch (tier) {
    // ≥ 99.9 % — systemGreen
    case 'emerald':
    case 'green':
      return 'bg-[var(--color-up)]';
    // ≥ 99 % — systemYellow (slight degradation, still healthy)
    case 'lime':
      return 'bg-[var(--chart-tier-good)]';
    // ≥ 95 % — systemOrange (degraded)
    case 'yellow':
    case 'amber':
    case 'orange':
      return 'bg-[var(--color-paused)]';
    // < 95 % — systemRed
    case 'red':
    case 'rose':
      return 'bg-[var(--color-down)]';
    // No data — systemGray
    case 'slate':
    default:
      return 'bg-[var(--color-unknown)]';
  }
}

export function getUptimePillClasses(tier: UptimeColorTier): string {
  switch (tier) {
    case 'emerald':
      return 'ui-surface-up ui-text-up ui-border-up';
    case 'green':
      return 'ui-surface-up ui-text-up ui-border-up';
    case 'lime':
      return 'ui-surface-up ui-text-up ui-border-up';
    case 'yellow':
      return 'ui-surface-warn ui-text-warn ui-border-warn';
    case 'amber':
      return 'ui-surface-warn ui-text-warn ui-border-warn';
    case 'orange':
      return 'ui-surface-warn ui-text-warn ui-border-warn';
    case 'red':
      return 'ui-surface-down ui-text-down ui-border-down';
    case 'rose':
      return 'ui-surface-down ui-text-down ui-border-down';
    case 'slate':
    default:
      return 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] ui-border-hairline dark:bg-[var(--color-bg-secondary)] dark:text-[var(--color-text-primary)] dark:border-[var(--color-border)]';
  }
}

// ──────── Formatting ────────

export function formatPct(v: number): string {
  if (!Number.isFinite(v)) return '-';
  return `${v.toFixed(3)}%`;
}

export function formatLatency(v: number | null): string {
  return v === null ? '-' : `${v}ms`;
}
