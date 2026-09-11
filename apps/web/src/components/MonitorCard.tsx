import { useMemo } from 'react';

import type {
  HomepageHeartbeatStrip,
  HomepageMonitorCard,
  PublicMonitor,
  PublicSslSummaryEntry,
  UptimeRatingLevel,
} from '../api/types';
import { useI18n } from '../app/I18nContext';
import { statusLabel } from '../i18n/labels';
import { HeartbeatBar } from './HeartbeatBar';
import { UptimeBar30d } from './UptimeBar30d';
import { Badge, Card, StatusDot } from './ui';
import { formatTime } from '../utils/datetime';
import {
  formatLatency,
  formatPct,
  getUptimeBgClasses,
  getUptimePillClasses,
  getUptimeTier,
} from '../utils/uptime';

const HEARTBEAT_BARS = 60;
const AVAILABILITY_BARS = 60;

type PublicMonitorLike = Pick<
  PublicMonitor,
  | 'id'
  | 'name'
  | 'type'
  | 'display_url'
  | 'status'
  | 'is_stale'
  | 'last_checked_at'
  | 'heartbeats'
  | 'uptime_30d'
  | 'uptime_days'
>;

type HomepageMonitorLike = Pick<
  HomepageMonitorCard,
  | 'id'
  | 'name'
  | 'type'
  | 'display_url'
  | 'status'
  | 'is_stale'
  | 'last_checked_at'
  | 'heartbeat_strip'
  | 'uptime_30d'
  | 'uptime_day_strip'
>;

type MonitorLike = PublicMonitorLike | HomepageMonitorLike;

export interface MonitorCardProps {
  monitor: MonitorLike;
  ratingLevel: UptimeRatingLevel;
  timeZone: string;
  onSelect: () => void;
  onDayClick: (dayStartAt: number) => void;
  /** Optional TLS certificate summary (days remaining) shown as a badge. */
  ssl?: PublicSslSummaryEntry | null;
}

function hasHomepageStrips(monitor: MonitorLike): monitor is HomepageMonitorLike {
  return 'heartbeat_strip' in monitor && 'uptime_day_strip' in monitor;
}

function hasPublicTimeseries(monitor: MonitorLike): monitor is PublicMonitorLike {
  return 'heartbeats' in monitor && 'uptime_days' in monitor;
}

function getHeartbeatLatencyStats(
  heartbeats: PublicMonitor['heartbeats'] | undefined,
  heartbeatStrip: HomepageHeartbeatStrip | undefined,
): {
  fastestMs: number | null;
  avgMs: number | null;
  slowestMs: number | null;
} {
  let fastestMs = Number.POSITIVE_INFINITY;
  let slowestMs = Number.NEGATIVE_INFINITY;
  let latencySum = 0;
  let latencyCount = 0;

  if (Array.isArray(heartbeats)) {
    for (const hb of heartbeats) {
      if (hb.status !== 'up') continue;
      if (typeof hb.latency_ms !== 'number' || !Number.isFinite(hb.latency_ms)) continue;

      const latency = hb.latency_ms;
      if (latency < fastestMs) fastestMs = latency;
      if (latency > slowestMs) slowestMs = latency;
      latencySum += latency;
      latencyCount++;
    }
  } else if (heartbeatStrip) {
    for (let index = 0; index < heartbeatStrip.status_codes.length; index += 1) {
      if (heartbeatStrip.status_codes[index] !== 'u') continue;
      const latency = heartbeatStrip.latency_ms[index];
      if (typeof latency !== 'number' || !Number.isFinite(latency)) continue;

      if (latency < fastestMs) fastestMs = latency;
      if (latency > slowestMs) slowestMs = latency;
      latencySum += latency;
      latencyCount++;
    }
  }

  if (latencyCount === 0) {
    return { fastestMs: null, avgMs: null, slowestMs: null };
  }

  const avgMs = Math.round(latencySum / latencyCount);

  return { fastestMs, avgMs, slowestMs };
}

export function MonitorCard({
  monitor,
  ratingLevel,
  onSelect,
  onDayClick,
  timeZone,
  ssl,
}: MonitorCardProps) {
  const { locale, t } = useI18n();
  const uptime30d = monitor.uptime_30d;
  const checkedAt = monitor.last_checked_at
    ? timeZone
      ? formatTime(monitor.last_checked_at, { timeZone, locale })
      : formatTime(monitor.last_checked_at, { locale })
    : t('monitor_card.never_checked');
  const heartbeatStrip = hasHomepageStrips(monitor) ? monitor.heartbeat_strip : undefined;
  const uptimeDayStrip = hasHomepageStrips(monitor) ? monitor.uptime_day_strip : undefined;
  const heartbeats = hasPublicTimeseries(monitor) ? monitor.heartbeats : undefined;
  const uptimeDays = hasPublicTimeseries(monitor) ? monitor.uptime_days : undefined;
  const latencyStats = useMemo(
    () => getHeartbeatLatencyStats(heartbeats, heartbeatStrip),
    [heartbeatStrip, heartbeats],
  );

  const tier = uptime30d ? getUptimeTier(uptime30d.uptime_pct, ratingLevel) : null;

  const sslPill = useMemo(() => {
    if (!ssl || ssl.status === 'unknown') return null;

    const className =
      ssl.status === 'expired'
        ? 'ui-surface-down ui-text-down ui-border-down dark:ui-surface-down dark:ui-text-down dark:ui-border-down'
        : ssl.status === 'expiring'
          ? 'ui-surface-warn ui-text-warn ui-border-warn dark:ui-surface-warn dark:ui-text-warn dark:ui-border-warn'
          : ssl.status === 'error'
            ? 'ui-surface-neutral ui-text-muted ui-border-hairline'
            : 'ui-surface-up ui-text-up ui-border-up dark:ui-surface-up dark:ui-text-up dark:ui-border-up';

    const label =
      ssl.status === 'expired'
        ? t('monitor_card.ssl_expired')
        : ssl.status === 'error'
          ? t('monitor_card.ssl_error')
          : t('monitor_card.ssl_days', { days: Math.max(0, ssl.days_remaining ?? 0) });

    const title = [
      t('monitor_card.ssl_title'),
      ssl.valid_to
        ? `${t('monitor_form.ssl_valid_to_label')} ${formatTime(ssl.valid_to, { timeZone, locale })}`
        : null,
      ssl.issuer,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ');

    return { className, label, title };
  }, [locale, ssl, t, timeZone]);

  return (
    <Card hover onClick={onSelect} className="p-3 sm:p-4">
      {/* Header */}
      <div className="mb-2.5 sm:mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <StatusDot status={monitor.status} pulse={monitor.status === 'down'} size="sm" />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold leading-tight text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">
              {monitor.name}
            </h3>
            {monitor.display_url && (
              <a
                href={monitor.display_url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)] underline decoration-[var(--color-border)] underline-offset-2 transition-colors duration-200 ease-apple hover:text-[var(--color-text-primary)]"
                title={monitor.display_url}
              >
                {monitor.display_url}
              </a>
            )}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
              <span>{monitor.type}</span>
              {monitor.is_stale && (
                <span className="rounded ui-surface-warn px-1.5 py-px text-[10px] font-semibold ui-text-warn dark:ui-surface-warn dark:ui-text-warn">
                  {t('monitor_card.stale')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {uptime30d && tier ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${getUptimePillClasses(tier)}`}
              title={t('monitor_card.uptime_title')}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${getUptimeBgClasses(tier)}`} />
              {formatPct(uptime30d.uptime_pct)}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">-</span>
          )}
          {sslPill && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${sslPill.className}`}
              title={sslPill.title}
            >
              {sslPill.label}
            </span>
          )}
          <Badge variant={monitor.status}>{statusLabel(monitor.status, t)}</Badge>
        </div>
      </div>

      {/* Availability (60d) */}
      <div>
        <div className="mb-2 text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
          {t('monitor_card.availability_30d')}
        </div>
        <UptimeBar30d
          days={uptimeDays}
          strip={uptimeDayStrip}
          ratingLevel={ratingLevel}
          maxBars={AVAILABILITY_BARS}
          timeZone={timeZone}
          onDayClick={onDayClick}
          density="compact"
        />
      </div>

      {/* Heartbeat */}
      <div className="mt-2">
        <div className="mb-2 text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
          {t('monitor_card.last_checks', { count: HEARTBEAT_BARS })}
        </div>
        <HeartbeatBar
          heartbeats={heartbeats}
          strip={heartbeatStrip}
          maxBars={HEARTBEAT_BARS}
          density="compact"
        />
      </div>

      {/* Latency + timestamp footer */}
      <div className="mt-2 sm:mt-2.5 flex flex-wrap items-baseline justify-between gap-y-1 text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
        <div className="flex items-baseline gap-2 sm:gap-3 tabular-nums">
          <span>
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{t('monitor_card.fast')}</span>{' '}
            {formatLatency(latencyStats.fastestMs)}
          </span>
          <span>
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{t('monitor_card.avg')}</span>{' '}
            {formatLatency(latencyStats.avgMs)}
          </span>
          <span>
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">{t('monitor_card.slow')}</span>{' '}
            {formatLatency(latencyStats.slowestMs)}
          </span>
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
          {monitor.last_checked_at ? checkedAt : t('monitor_card.never_checked')}
        </span>
      </div>
    </Card>
  );
}
