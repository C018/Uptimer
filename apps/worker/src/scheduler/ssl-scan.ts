import {
  computeSslNotifySeverity,
  DEFAULT_SSL_WARN_DAYS,
  runSslCheck,
  type SslCheckOutcome,
} from '../monitor/ssl';
import type { Env } from '../env';
import { acquireLease, releaseLease } from './lock';
import { createNotifyContext } from './notifications';

/**
 * Scheduled SSL certificate expiry scan.
 *
 * This runs from the Cron trigger (never from a monitor probe path) so a fully
 * offline target cannot silence certificate alerts.
 */

const SSL_SCAN_LOCK_NAME = 'ssl-scan';
const SSL_SCAN_LOCK_SECONDS = 180;

const DEFAULT_SCAN_INTERVAL_SECONDS = 6 * 60 * 60;
const MIN_SCAN_INTERVAL_SECONDS = 15 * 60;
const MAX_SCAN_INTERVAL_SECONDS = 7 * 24 * 60 * 60;

const DEFAULT_SCAN_BATCH_SIZE = 10;
const MAX_SCAN_BATCH_SIZE = 25;

const DEFAULT_CHECK_TIMEOUT_MS = 10_000;
const MIN_CHECK_TIMEOUT_MS = 2_000;
const MAX_CHECK_TIMEOUT_MS = 30_000;

const DEFAULT_NOTIFY_COOLDOWN_SECONDS = 24 * 60 * 60;
const MIN_NOTIFY_COOLDOWN_SECONDS = 60 * 60;
const MAX_NOTIFY_COOLDOWN_SECONDS = 30 * 24 * 60 * 60;

const SCAN_CONCURRENCY = 3;

const LIST_DUE_SSL_MONITORS_SQL = `
  SELECT
    m.id,
    m.name,
    m.type,
    m.target,
    m.display_url,
    m.ssl_warn_days,
    s.checked_at,
    s.status,
    s.days_remaining,
    s.last_notified_at,
    s.last_notified_severity
  FROM monitors m
  LEFT JOIN monitor_ssl_state s ON s.monitor_id = m.id
  WHERE m.ssl_check_enabled = 1
    AND m.is_active = 1
    AND (s.checked_at IS NULL OR s.checked_at <= ?1)
  ORDER BY (s.checked_at IS NULL) DESC, s.checked_at ASC, m.id ASC
  LIMIT ?2
`;

const UPSERT_SSL_STATE_SQL = `
  INSERT INTO monitor_ssl_state (
    monitor_id,
    hostname,
    port,
    status,
    days_remaining,
    valid_from,
    valid_to,
    issuer,
    subject,
    serial_number,
    last_error,
    checked_at,
    last_notified_at,
    last_notified_severity,
    updated_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
  ON CONFLICT(monitor_id) DO UPDATE SET
    hostname = excluded.hostname,
    port = excluded.port,
    status = excluded.status,
    days_remaining = excluded.days_remaining,
    valid_from = excluded.valid_from,
    valid_to = excluded.valid_to,
    issuer = excluded.issuer,
    subject = excluded.subject,
    serial_number = excluded.serial_number,
    last_error = excluded.last_error,
    checked_at = excluded.checked_at,
    last_notified_at = excluded.last_notified_at,
    last_notified_severity = excluded.last_notified_severity,
    updated_at = excluded.updated_at
`;

type DueSslMonitorRow = {
  id: number;
  name: string;
  type: string;
  target: string;
  display_url: string | null;
  ssl_warn_days: number | null;
  checked_at: number | null;
  status: string | null;
  days_remaining: number | null;
  last_notified_at: number | null;
  last_notified_severity: string | null;
};

export type SslScanSummary = {
  scanned: number;
  expiring: number;
  expired: number;
  errored: number;
  notified: number;
};

function readBoundedPositiveIntegerEnv(
  env: Env,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = (env as unknown as Record<string, unknown>)[key];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function isSslScanDisabled(env: Env): boolean {
  const raw = (env as unknown as Record<string, unknown>).UPTIMER_SSL_CHECK_ENABLED;
  return typeof raw === 'string' && raw.trim() === '0';
}

function readWarnDays(row: DueSslMonitorRow): number {
  const value = row.ssl_warn_days;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SSL_WARN_DAYS;
  return Math.max(0, Math.min(365, Math.trunc(value)));
}

function shouldNotifySsl(
  row: DueSslMonitorRow,
  status: SslCheckOutcome['status'],
  severity: 'warning' | 'critical' | 'expired',
  now: number,
  cooldownSeconds: number,
): boolean {
  if (status === 'expired') {
    // Always announce a fresh expiry, then stay on the cooldown cadence.
    if (row.last_notified_severity !== severity) return true;
  } else if (row.last_notified_severity === severity && row.last_notified_at !== null) {
    // Same band already announced: only repeat after the cooldown.
    return now - row.last_notified_at >= cooldownSeconds;
  } else if (row.last_notified_at !== null && now - row.last_notified_at < cooldownSeconds) {
    // Band changed but we alerted very recently - keep the noise down.
    return false;
  }

  if (row.last_notified_at === null) return true;
  return now - row.last_notified_at >= cooldownSeconds;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function persistSslState(
  db: D1Database,
  monitorId: number,
  outcome: SslCheckOutcome,
  notify: { lastNotifiedAt: number | null; lastNotifiedSeverity: string | null },
): Promise<void> {
  await db
    .prepare(UPSERT_SSL_STATE_SQL)
    .bind(
      monitorId,
      outcome.hostname,
      outcome.port,
      outcome.status,
      outcome.daysRemaining,
      outcome.validFrom,
      outcome.validTo,
      outcome.issuer,
      outcome.subject,
      outcome.serialNumber,
      outcome.error,
      outcome.checkedAt,
      notify.lastNotifiedAt,
      notify.lastNotifiedSeverity,
      outcome.checkedAt,
    )
    .run();
}

/**
 * Runs one certificate check for a single monitor and persists the result.
 * Returns the outcome (used by the admin "check now" endpoint).
 */
export async function checkMonitorSslNow(
  env: Env,
  monitor: { id: number; type: string; target: string; sslWarnDays?: number | null },
  now: number,
): Promise<SslCheckOutcome> {
  const timeoutMs = readBoundedPositiveIntegerEnv(
    env,
    'UPTIMER_SSL_CHECK_TIMEOUT_MS',
    DEFAULT_CHECK_TIMEOUT_MS,
    MIN_CHECK_TIMEOUT_MS,
    MAX_CHECK_TIMEOUT_MS,
  );

  const outcome = await runSslCheck(monitor, {
    now,
    timeoutMs,
    warnDays:
      typeof monitor.sslWarnDays === 'number'
        ? Math.max(0, Math.min(365, Math.trunc(monitor.sslWarnDays)))
        : DEFAULT_SSL_WARN_DAYS,
  });

  const existing = await env.DB.prepare(
    'SELECT last_notified_at, last_notified_severity FROM monitor_ssl_state WHERE monitor_id = ?1',
  )
    .bind(monitor.id)
    .first<{ last_notified_at: number | null; last_notified_severity: string | null }>();

  await persistSslState(env.DB, monitor.id, outcome, {
    lastNotifiedAt: existing?.last_notified_at ?? null,
    lastNotifiedSeverity: existing?.last_notified_severity ?? null,
  });

  return outcome;
}

export async function runSslScanPhase(args: {
  env: Env;
  ctx: ExecutionContext;
  now: number;
}): Promise<SslScanSummary | null> {
  const { env, ctx, now } = args;
  const summary: SslScanSummary = { scanned: 0, expiring: 0, expired: 0, errored: 0, notified: 0 };

  if (isSslScanDisabled(env)) return null;

  const intervalSeconds = readBoundedPositiveIntegerEnv(
    env,
    'UPTIMER_SSL_CHECK_INTERVAL_SECONDS',
    DEFAULT_SCAN_INTERVAL_SECONDS,
    MIN_SCAN_INTERVAL_SECONDS,
    MAX_SCAN_INTERVAL_SECONDS,
  );
  const batchSize = readBoundedPositiveIntegerEnv(
    env,
    'UPTIMER_SSL_SCAN_BATCH_SIZE',
    DEFAULT_SCAN_BATCH_SIZE,
    1,
    MAX_SCAN_BATCH_SIZE,
  );
  const timeoutMs = readBoundedPositiveIntegerEnv(
    env,
    'UPTIMER_SSL_CHECK_TIMEOUT_MS',
    DEFAULT_CHECK_TIMEOUT_MS,
    MIN_CHECK_TIMEOUT_MS,
    MAX_CHECK_TIMEOUT_MS,
  );
  const cooldownSeconds = readBoundedPositiveIntegerEnv(
    env,
    'UPTIMER_SSL_NOTIFY_COOLDOWN_SECONDS',
    DEFAULT_NOTIFY_COOLDOWN_SECONDS,
    MIN_NOTIFY_COOLDOWN_SECONDS,
    MAX_NOTIFY_COOLDOWN_SECONDS,
  );

  const dueThreshold = now - intervalSeconds;

  const firstPass = await env.DB.prepare(LIST_DUE_SSL_MONITORS_SQL)
    .bind(dueThreshold, batchSize)
    .all<DueSslMonitorRow>();
  const candidates = firstPass.results ?? [];
  if (candidates.length === 0) return summary;

  const acquired = await acquireLease(env.DB, SSL_SCAN_LOCK_NAME, now, SSL_SCAN_LOCK_SECONDS);
  if (!acquired) return null;

  const leaseExpiresAt = now + SSL_SCAN_LOCK_SECONDS;

  try {
    const outcomes = await mapWithConcurrency(candidates, SCAN_CONCURRENCY, async (row) => {
      const outcome = await runSslCheck(row, {
        now,
        timeoutMs,
        warnDays: readWarnDays(row),
      });
      return { row, outcome };
    });

    const notify = await createNotifyContext(env, ctx);

    for (const { row, outcome } of outcomes) {
      summary.scanned += 1;
      if (outcome.status === 'expiring') summary.expiring += 1;
      else if (outcome.status === 'expired') summary.expired += 1;
      else if (outcome.status === 'error') summary.errored += 1;

      let lastNotifiedAt = row.last_notified_at;
      let lastNotifiedSeverity = row.last_notified_severity;

      const severity = computeSslNotifySeverity(outcome.status, outcome.daysRemaining);
      if (
        notify &&
        severity &&
        outcome.validTo !== null &&
        shouldNotifySsl(row, severity, now, cooldownSeconds)
      ) {
        const eventKey = `monitor:${row.id}:ssl:${severity}:${now}`;
        const payload = {
          event: 'monitor.ssl_expiring',
          event_id: eventKey,
          timestamp: now,
          monitor: {
            id: row.id,
            name: row.name,
            type: row.type,
            target: row.target,
            display_url: row.display_url ?? null,
          },
          ssl: {
            hostname: outcome.hostname,
            port: outcome.port,
            status: outcome.status,
            severity,
            days_remaining: outcome.daysRemaining,
            warn_days: readWarnDays(row),
            valid_from: toIsoString(outcome.validFrom),
            valid_to: toIsoString(outcome.validTo),
            valid_from_epoch: outcome.validFrom,
            valid_to_epoch: outcome.validTo,
            days_until_expiry: outcome.daysRemaining,
            issuer: outcome.issuer,
            subject: outcome.subject,
          },
        };

        lastNotifiedAt = now;
        lastNotifiedSeverity = severity;
        summary.notified += 1;

        ctx.waitUntil(
          import('../notify/webhook')
            .then(({ dispatchWebhookToChannels }) =>
              dispatchWebhookToChannels({
                db: env.DB,
                env: env as unknown as Record<string, unknown>,
                channels: notify.channels,
                eventType: 'monitor.ssl_expiring',
                eventKey,
                payload,
              }),
            )
            .catch((err) => {
              console.error('ssl-scan: failed to dispatch certificate notifications', err);
            }),
        );
      }

      await persistSslState(env.DB, row.id, outcome, {
        lastNotifiedAt,
        lastNotifiedSeverity,
      }).catch((err) => {
        console.warn('ssl-scan: failed to persist certificate state', err);
      });
    }
  } catch (err) {
    console.warn('ssl-scan: scan failed', err);
  } finally {
    await releaseLease(env.DB, SSL_SCAN_LOCK_NAME, leaseExpiresAt).catch(() => {
      // ignore
    });
  }

  if (summary.scanned > 0) {
    console.log(
      `ssl-scan: scanned=${summary.scanned} expiring=${summary.expiring} expired=${summary.expired} errored=${summary.errored} notified=${summary.notified}`,
    );
  }

  return summary;
}

function toIsoString(epochSeconds: number | null): string | null {
  if (epochSeconds === null || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000).toISOString();
}
