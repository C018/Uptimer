import type { ReactNode } from 'react';

import type { MonitorSslState, MonitorSslStatus, SslCertificateDetail } from '../api/types';
import { useI18n, type MessageKey } from '../app/I18nContext';
import { formatDateTime } from '../utils/datetime';
import { Badge, Button, MODAL_OVERLAY_CLASS, MODAL_PANEL_CLASS } from './ui';

/** Placeholder for certificate facts the worker has not recorded yet. */
const EMPTY_VALUE = '—';

const SSL_STATUS_BADGE_VARIANT: Record<MonitorSslStatus, 'up' | 'down' | 'paused' | 'unknown'> = {
  ok: 'up',
  expiring: 'paused',
  expired: 'down',
  error: 'down',
  unknown: 'unknown',
};

const SSL_STATUS_MESSAGE_KEY: Record<MonitorSslStatus, MessageKey> = {
  ok: 'monitor_form.ssl_status_valid',
  expiring: 'monitor_form.ssl_status_expiring',
  expired: 'monitor_form.ssl_status_expired',
  error: 'monitor_form.ssl_status_error',
  unknown: 'monitor_form.ssl_status_unknown',
};

interface DetailRowProps {
  label: string;
  value: ReactNode;
  /** Use tabular figures for timestamps, serial numbers and day counts. */
  numeric?: boolean;
}

function DetailRow({ label, value, numeric = false }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t ui-border-hairline py-2 first:border-t-0 dark:border-[var(--color-border)]">
      <dt className="shrink-0 text-caption-1 text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right text-footnote text-[var(--color-text-primary)]${
          numeric ? ' apple-numeric' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export interface SslCertificateDetailsProps {
  /** Display name of the monitor the certificate belongs to. */
  monitorName: string;
  ssl: SslCertificateDetail;
  /** Site timezone used for the certificate timestamps (optional). */
  timeZone?: string | undefined;
  onClose: () => void;
}

/**
 * Read-only dialog rendering the TLS certificate snapshot stored in
 * `monitor_ssl_state`. Shared by the public status page and the admin dashboard,
 * so both surfaces show the exact same facts.
 */
export function SslCertificateDetails({
  monitorName,
  ssl,
  timeZone,
  onClose,
}: SslCertificateDetailsProps) {
  const { locale, t } = useI18n();

  const formatTimestamp = (value: number | null): string =>
    value === null ? EMPTY_VALUE : formatDateTime(value, timeZone, locale);

  const probeTarget = ssl.hostname
    ? ssl.port === null
      ? ssl.hostname
      : `${ssl.hostname}:${ssl.port}`
    : ssl.port === null
      ? EMPTY_VALUE
      : `:${ssl.port}`;

  return (
    <div className={MODAL_OVERLAY_CLASS} role="presentation" onClick={onClose}>
      <div
        className={`${MODAL_PANEL_CLASS} sm:max-w-md p-5 sm:p-6`}
        role="dialog"
        aria-modal="true"
        aria-label={t('ssl_detail.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {t('ssl_detail.title')}
          </h2>
          <Badge variant={SSL_STATUS_BADGE_VARIANT[ssl.status]} size="md">
            {t(SSL_STATUS_MESSAGE_KEY[ssl.status])}
          </Badge>
        </div>

        <dl className="mt-5">
          <DetailRow label={t('ssl_detail.monitor_label')} value={monitorName} />
          <DetailRow label={t('ssl_detail.issuer_label')} value={ssl.issuer ?? EMPTY_VALUE} />
          <DetailRow label={t('ssl_detail.subject_label')} value={ssl.subject ?? EMPTY_VALUE} />
          <DetailRow
            label={t('ssl_detail.serial_number_label')}
            value={ssl.serial_number ?? EMPTY_VALUE}
            numeric
          />
          <DetailRow
            label={t('ssl_detail.valid_from_label')}
            value={formatTimestamp(ssl.valid_from)}
            numeric
          />
          <DetailRow
            label={t('ssl_detail.valid_to_label')}
            value={formatTimestamp(ssl.valid_to)}
            numeric
          />
          <DetailRow
            label={t('ssl_detail.days_remaining_label')}
            value={
              ssl.days_remaining === null
                ? EMPTY_VALUE
                : t('ssl_detail.days_remaining_value', { days: ssl.days_remaining })
            }
            numeric
          />
          {ssl.warn_days !== null && (
            <DetailRow
              label={t('ssl_detail.warn_days_label')}
              value={t('ssl_detail.days_remaining_value', { days: ssl.warn_days })}
              numeric
            />
          )}
          <DetailRow label={t('ssl_detail.probe_label')} value={probeTarget} />
          <DetailRow
            label={t('ssl_detail.checked_at_label')}
            value={formatTimestamp(ssl.checked_at)}
            numeric
          />
        </dl>

        {ssl.last_error && (
          <div className="mt-4 rounded-apple border ui-border-down ui-surface-down px-3 py-2 text-caption-1 ui-text-down">
            <div className="font-medium">{t('ssl_detail.error_label')}</div>
            <div className="mt-0.5 break-words">{ssl.last_error}</div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Normalises an admin monitor certificate snapshot into the shared dialog payload. */
export function fromMonitorSslState(
  ssl: MonitorSslState,
  warnDays: number | null,
): SslCertificateDetail {
  return {
    status: ssl.status,
    hostname: ssl.hostname,
    port: ssl.port,
    days_remaining: ssl.days_remaining,
    warn_days: warnDays,
    valid_from: ssl.valid_from,
    valid_to: ssl.valid_to,
    issuer: ssl.issuer,
    subject: ssl.subject,
    serial_number: ssl.serial_number,
    checked_at: ssl.checked_at,
    last_error: ssl.last_error,
  };
}

/** Normalises a public summary entry into the shared dialog payload. */
export function toSslCertificateDetail(ssl: {
  status: MonitorSslStatus;
  days_remaining: number | null;
  warn_days: number | null;
  valid_from: number | null;
  valid_to: number | null;
  issuer: string | null;
  subject: string | null;
  serial_number: string | null;
  hostname: string | null;
  port: number | null;
  last_error: string | null;
  checked_at: number | null;
}): SslCertificateDetail {
  return {
    status: ssl.status,
    hostname: ssl.hostname,
    port: ssl.port,
    days_remaining: ssl.days_remaining,
    warn_days: ssl.warn_days,
    valid_from: ssl.valid_from,
    valid_to: ssl.valid_to,
    issuer: ssl.issuer,
    subject: ssl.subject,
    serial_number: ssl.serial_number,
    checked_at: ssl.checked_at,
    last_error: ssl.last_error,
  };
}
