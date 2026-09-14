import { useMemo, useState } from 'react';

import type { Incident, MaintenanceWindow, Outage } from '../api/types';
import { useI18n } from '../app/I18nContext';
import { Button, MODAL_OVERLAY_CLASS, MODAL_PANEL_CLASS } from './ui';
import { formatDate, formatTime } from '../utils/datetime';
import { computeDayDowntimeIntervals, computeIntervalTotalSeconds } from './UptimeBar30d';

function formatDay(ts: number, timeZone?: string, locale?: string): string {
  return formatDate(ts, timeZone, locale);
}

function formatClock(ts: number, timeZone?: string, locale?: string): string {
  return timeZone
    ? formatTime(ts, { timeZone, hour12: false, ...(locale ? { locale } : {}) })
    : formatTime(ts, { hour12: false, ...(locale ? { locale } : {}) });
}

function formatSec(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

type DayInterval = { start: number; end: number };

type ContextInterval = {
  start: number;
  end: number;
  kind: 'maintenance' | 'incident';
  label: string;
};

type ContextGroup = {
  start: number;
  end: number;
  kind: 'maintenance' | 'incident';
  label: string;
  downtime: DayInterval[];
};

function mergeIntervals(intervals: DayInterval[]): DayInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: DayInterval[] = [];

  for (const it of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ start: it.start, end: it.end });
      continue;
    }

    if (it.start <= prev.end) {
      prev.end = Math.max(prev.end, it.end);
      continue;
    }

    merged.push({ start: it.start, end: it.end });
  }

  return merged;
}

function clipInterval(interval: DayInterval, range: DayInterval): DayInterval | null {
  const start = Math.max(interval.start, range.start);
  const end = Math.min(interval.end, range.end);
  return end > start ? { start, end } : null;
}

function groupDowntimeByContext(
  downtime: DayInterval[],
  contexts: ContextInterval[],
): { groups: ContextGroup[]; outside: DayInterval[] } {
  if (downtime.length === 0) return { groups: [], outside: [] };

  const mergedDowntime = mergeIntervals(downtime);

  const mergedContexts: Array<ContextInterval & DayInterval> = contexts
    .map((c) => ({ ...c, start: c.start, end: c.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const groups: ContextGroup[] = [];
  for (const ctx of mergedContexts) {
    const overlappedDowntime = mergedDowntime
      .map((d) => clipInterval(d, ctx))
      .filter((x): x is DayInterval => x !== null);
    if (overlappedDowntime.length === 0) continue;
    groups.push({
      start: ctx.start,
      end: ctx.end,
      kind: ctx.kind,
      label: ctx.label,
      downtime: overlappedDowntime,
    });
  }

  const outside: DayInterval[] = [];
  for (const d of mergedDowntime) {
    let cursor = d.start;
    for (const ctx of mergedContexts) {
      if (ctx.end <= cursor) continue;
      if (ctx.start >= d.end) break;

      if (ctx.start > cursor) {
        outside.push({ start: cursor, end: Math.min(ctx.start, d.end) });
      }

      cursor = Math.max(cursor, ctx.end);
      if (cursor >= d.end) break;
    }

    if (cursor < d.end) {
      outside.push({ start: cursor, end: d.end });
    }
  }

  return { groups, outside };
}

function buildContextIntervals(
  dayStartAt: number,
  nowSec: number,
  maintenanceWindows: MaintenanceWindow[],
  incidents: Incident[],
): ContextInterval[] {
  const dayEndAt = dayStartAt + 86400;
  const capEndAt = dayStartAt <= nowSec && nowSec < dayEndAt ? nowSec : dayEndAt;

  const out: ContextInterval[] = [];

  for (const mw of maintenanceWindows) {
    const clipped = clipInterval(
      { start: mw.starts_at, end: mw.ends_at },
      { start: dayStartAt, end: capEndAt },
    );
    if (!clipped) continue;
    out.push({ start: clipped.start, end: clipped.end, kind: 'maintenance', label: mw.title });
  }

  for (const it of incidents) {
    const clipped = clipInterval(
      { start: it.started_at, end: it.resolved_at ?? capEndAt },
      { start: dayStartAt, end: capEndAt },
    );
    if (!clipped) continue;
    out.push({ start: clipped.start, end: clipped.end, kind: 'incident', label: it.title });
  }

  return out.sort(
    (a, b) => a.start - b.start || (a.kind === b.kind ? 0 : a.kind === 'maintenance' ? -1 : 1),
  );
}

// NOTE: Downtime is grouped separately for maintenance and incidents.

function contextTagClasses(kind: ContextInterval['kind']): string {
  return kind === 'maintenance'
    ? 'ui-surface-accent ui-text-accent'
    : 'ui-surface-warn ui-text-warn';
}

export function DayDowntimeModal({
  dayStartAt,
  outages,
  maintenanceWindows,
  incidents,
  onClose,
  timeZone,
}: {
  dayStartAt: number;
  outages: Outage[];
  maintenanceWindows: MaintenanceWindow[];
  incidents: Incident[];
  onClose: () => void;
  timeZone?: string;
}) {
  const { locale, t } = useI18n();
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  const intervals = useMemo(
    () => computeDayDowntimeIntervals(dayStartAt, outages, nowSec),
    [dayStartAt, nowSec, outages],
  );

  const totalDowntimeSec = useMemo(() => computeIntervalTotalSeconds(intervals), [intervals]);

  const contextIntervals = useMemo(
    () => buildContextIntervals(dayStartAt, nowSec, maintenanceWindows, incidents),
    [dayStartAt, nowSec, maintenanceWindows, incidents],
  );

  const allGrouped = useMemo(
    () => groupDowntimeByContext(intervals, contextIntervals),
    [intervals, contextIntervals],
  );

  // Build a unified time-sorted list: context groups + outside intervals.
  const sortedEntries = useMemo(() => {
    const entries: Array<
      { kind: 'group'; group: ContextGroup } | { kind: 'outside'; interval: DayInterval }
    > = [];
    for (const g of allGrouped.groups) entries.push({ kind: 'group', group: g });
    for (const it of allGrouped.outside) entries.push({ kind: 'outside', interval: it });
    return entries.sort((a, b) => {
      const aStart = a.kind === 'group' ? a.group.start : a.interval.start;
      const bStart = b.kind === 'group' ? b.group.start : b.interval.start;
      return aStart - bStart;
    });
  }, [allGrouped]);

  return (
    <div className={MODAL_OVERLAY_CLASS} onClick={onClose}>
      <div
        className={`${MODAL_PANEL_CLASS} sm:max-w-xl p-5 sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
              {t('day_downtime.title')}
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)]">
              {formatDay(dayStartAt, timeZone, locale)}
            </h2>
            <div className="mt-1 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
              {t('common.total')}: {formatSec(totalDowntimeSec)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>

        {intervals.length === 0 ? (
          <div className="text-[var(--color-text-muted)]">{t('day_downtime.no_downtime')}</div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry, idx) => {
              if (entry.kind === 'outside') {
                const it = entry.interval;
                return (
                  <div
                    key={`outside-${idx}`}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--color-bg)] dark:bg-[var(--color-bg-secondary)]"
                  >
                    <div className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
                      {formatClock(it.start, timeZone, locale)} –{' '}
                      {formatClock(it.end, timeZone, locale)}
                    </div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      {formatSec(it.end - it.start)}
                    </div>
                  </div>
                );
              }

              const g = entry.group;
              const isMaintenance = g.kind === 'maintenance';
              return (
                <div
                  key={`group-${idx}`}
                  className={
                    isMaintenance
                      ? 'p-3 rounded-lg border ui-border-accent ui-surface-accent'
                      : 'p-3 rounded-lg border ui-border-warn ui-surface-warn'
                  }
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div
                      className={`text-sm font-medium ${isMaintenance ? 'ui-text-accent' : 'ui-text-warn'}`}
                    >
                      {isMaintenance
                        ? t('day_downtime.kind_maintenance')
                        : t('day_downtime.kind_incident')}
                    </div>
                    <div
                      className={`text-xs tabular-nums ${isMaintenance ? 'ui-text-accent' : 'ui-text-warn'}`}
                    >
                      {formatClock(g.start, timeZone, locale)} –{' '}
                      {formatClock(g.end, timeZone, locale)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${contextTagClasses(g.kind)}`}
                    >
                      {g.label}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {g.downtime.map((it, didx) => (
                      <div
                        key={`d-${didx}`}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--material-thick)] dark:bg-[var(--color-bg-secondary)] border ui-border-hairline dark:border-[var(--color-border)]"
                      >
                        <div className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)]">
                          {formatClock(it.start, timeZone, locale)} –{' '}
                          {formatClock(it.end, timeZone, locale)}
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                          {formatSec(it.end - it.start)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
