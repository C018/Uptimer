import { and, eq, getDb, monitors, monitorSslState, sql } from '@uptimer/db';

import { monitorVisibilityPredicate } from './visibility';

export type PublicSslSummaryStatus = 'ok' | 'expiring' | 'expired' | 'error' | 'unknown';

export type PublicSslSummaryEntry = {
  monitor_id: number;
  status: PublicSslSummaryStatus;
  days_remaining: number | null;
  warn_days: number;
  valid_from: number | null;
  valid_to: number | null;
  issuer: string | null;
  subject: string | null;
  serial_number: string | null;
  /** Hostname the certificate was probed from (monitor_ssl_state.hostname). */
  hostname: string | null;
  /** TCP port the certificate was probed from (monitor_ssl_state.port). */
  port: number | null;
  /** Last probe error, surfaced as the failure reason in the certificate details dialog. */
  last_error: string | null;
  checked_at: number | null;
};

export type PublicSslSummaryPayload = {
  generated_at: number;
  monitors: PublicSslSummaryEntry[];
};

const SECONDS_PER_DAY = 86_400;

/**
 * Public homepage SSL summary: certificate days remaining per status-page monitor.
 * Only monitors with SSL checking enabled and visible on the status page are exposed.
 */
export async function computePublicSslSummary(
  db: D1Database,
  now: number,
): Promise<PublicSslSummaryPayload> {
  const rows = await getDb({ DB: db })
    .select({
      monitorId: monitors.id,
      warnDays: monitors.sslWarnDays,
      status: monitorSslState.status,
      storedDaysRemaining: monitorSslState.daysRemaining,
      validFrom: monitorSslState.validFrom,
      validTo: monitorSslState.validTo,
      issuer: monitorSslState.issuer,
      subject: monitorSslState.subject,
      serialNumber: monitorSslState.serialNumber,
      hostname: monitorSslState.hostname,
      port: monitorSslState.port,
      lastError: monitorSslState.lastError,
      checkedAt: monitorSslState.checkedAt,
    })
    .from(monitors)
    .leftJoin(monitorSslState, eq(monitorSslState.monitorId, monitors.id))
    .where(
      and(
        eq(monitors.sslCheckEnabled, true),
        sql.raw(monitorVisibilityPredicate(false, 'monitors')),
      ),
    )
    .all();

  return {
    generated_at: now,
    monitors: rows.map((row) => {
      const warnDays = row.warnDays ?? 0;
      const checkedAt = row.checkedAt ?? null;

      // Certificate facts always come verbatim from monitor_ssl_state so the
      // details dialog never has to hide a field the probe actually recorded;
      // only the derived status decides how the homepage card renders them.
      const certificate = {
        valid_from: row.validFrom ?? null,
        valid_to: row.validTo ?? null,
        issuer: row.issuer ?? null,
        subject: row.subject ?? null,
        serial_number: row.serialNumber ?? null,
        hostname: row.hostname ?? null,
        port: row.port ?? null,
      };

      if (checkedAt === null) {
        return {
          monitor_id: row.monitorId,
          status: 'unknown' as const,
          days_remaining: null,
          warn_days: warnDays,
          ...certificate,
          last_error: null,
          checked_at: null,
        };
      }

      if (row.lastError) {
        return {
          monitor_id: row.monitorId,
          status: 'error' as const,
          days_remaining: null,
          warn_days: warnDays,
          ...certificate,
          last_error: row.lastError,
          checked_at: checkedAt,
        };
      }

      // Recompute from the stored notAfter so the homepage value stays accurate
      // between SSL scan ticks.
      const daysRemaining =
        row.validTo !== null
          ? Math.floor((row.validTo - now) / SECONDS_PER_DAY)
          : (row.storedDaysRemaining ?? null);

      if (daysRemaining === null) {
        return {
          monitor_id: row.monitorId,
          status: 'unknown' as const,
          days_remaining: null,
          warn_days: warnDays,
          ...certificate,
          last_error: null,
          checked_at: checkedAt,
        };
      }

      return {
        monitor_id: row.monitorId,
        status: resolveSslStatus(daysRemaining, warnDays),
        days_remaining: daysRemaining,
        warn_days: warnDays,
        ...certificate,
        last_error: null,
        checked_at: checkedAt,
      };
    }),
  };
}

function resolveSslStatus(
  daysRemaining: number,
  warnDays: number,
): Exclude<PublicSslSummaryStatus, 'error' | 'unknown'> {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= Math.max(0, warnDays)) return 'expiring';
  return 'ok';
}
