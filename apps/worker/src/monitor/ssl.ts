import { parseTcpTarget } from './targets';
import { probeTlsCertificate } from './tls-cert';

export type SslCheckStatus = 'ok' | 'expiring' | 'expired' | 'error';
export type SslNotifySeverity = 'warning' | 'critical' | 'expired';

export const DEFAULT_SSL_PORT = 443;
export const DEFAULT_SSL_WARN_DAYS = 14;
export const SECONDS_PER_DAY = 86_400;

export type SslMonitorLike = {
  type: string;
  target: string;
};

export type ResolvedSslTarget = {
  hostname: string;
  port: number;
};

export type SslCheckOutcome = {
  hostname: string | null;
  port: number | null;
  status: SslCheckStatus;
  daysRemaining: number | null;
  validFrom: number | null;
  validTo: number | null;
  issuer: string | null;
  subject: string | null;
  serialNumber: string | null;
  error: string | null;
  checkedAt: number;
};

function stripIpv6Brackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/**
 * Resolves the TLS endpoint to probe for a monitor.
 * HTTP monitors default to port 443 (an explicit port in the URL wins),
 * TCP monitors use the host/port of their target.
 */
export function resolveSslTarget(monitor: SslMonitorLike): ResolvedSslTarget | null {
  const rawTarget = monitor.target.trim();
  if (rawTarget.length === 0) return null;

  if (monitor.type === 'tcp') {
    const parsed = parseTcpTarget(rawTarget);
    if (!parsed) return null;
    return { hostname: stripIpv6Brackets(parsed.host), port: parsed.port };
  }

  try {
    const url = new URL(rawTarget);
    const hostname = stripIpv6Brackets(url.hostname);
    if (!hostname) return null;
    const port = url.port ? Number.parseInt(url.port, 10) : DEFAULT_SSL_PORT;
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    return { hostname, port };
  } catch {
    return null;
  }
}

export function computeSslStatus(daysRemaining: number, warnDays: number): SslCheckStatus {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= Math.max(0, warnDays)) return 'expiring';
  return 'ok';
}

export function computeSslNotifySeverity(
  status: SslCheckStatus,
  daysRemaining: number | null,
): SslNotifySeverity | null {
  if (status === 'expired') return 'expired';
  if (status !== 'expiring') return null;
  if (daysRemaining !== null && daysRemaining <= 3) return 'critical';
  return 'warning';
}

export async function runSslCheck(
  monitor: SslMonitorLike,
  opts: { now: number; timeoutMs: number; warnDays: number },
): Promise<SslCheckOutcome> {
  const checkedAt = opts.now;
  const resolved = resolveSslTarget(monitor);

  if (!resolved) {
    return {
      hostname: null,
      port: null,
      status: 'error',
      daysRemaining: null,
      validFrom: null,
      validTo: null,
      issuer: null,
      subject: null,
      serialNumber: null,
      error: 'Unable to resolve a TLS host/port from the monitor target',
      checkedAt,
    };
  }

  const probe = await probeTlsCertificate({
    hostname: resolved.hostname,
    port: resolved.port,
    timeoutMs: opts.timeoutMs,
  });

  if (!probe.ok) {
    return {
      hostname: resolved.hostname,
      port: resolved.port,
      status: 'error',
      daysRemaining: null,
      validFrom: null,
      validTo: null,
      issuer: null,
      subject: null,
      serialNumber: null,
      error: probe.error,
      checkedAt,
    };
  }

  const { notBefore, notAfter, issuer, subject, serialNumber } = probe.certificate;
  if (notAfter === null) {
    return {
      hostname: resolved.hostname,
      port: resolved.port,
      status: 'error',
      daysRemaining: null,
      validFrom: notBefore,
      validTo: null,
      issuer,
      subject,
      serialNumber,
      error: 'Certificate expiry date is missing or could not be parsed',
      checkedAt,
    };
  }

  const daysRemaining = Math.floor((notAfter - checkedAt) / SECONDS_PER_DAY);

  return {
    hostname: resolved.hostname,
    port: resolved.port,
    status: computeSslStatus(daysRemaining, opts.warnDays),
    daysRemaining,
    validFrom: notBefore,
    validTo: notAfter,
    issuer,
    subject,
    serialNumber,
    error: null,
    checkedAt,
  };
}
