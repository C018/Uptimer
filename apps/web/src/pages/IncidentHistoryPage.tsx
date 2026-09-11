import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../app/I18nContext';
import { useApplyServerLocaleSetting } from '../app/useApplyServerLocaleSetting';
import { ApiError, fetchPublicIncidents, fetchStatus } from '../api/client';
import type { Incident } from '../api/types';
import { Markdown } from '../components/Markdown';
import {
  Badge,
  Button,
  Card,
  MODAL_OVERLAY_CLASS,
  MODAL_PANEL_CLASS,
  ThemeToggle,
} from '../components/ui';
import { incidentImpactLabel, incidentStatusLabel } from '../i18n/labels';
import { formatDateTime, getBrowserTimeZone } from '../utils/datetime';

function formatError(err: unknown): string | undefined {
  if (!err) return undefined;
  if (err instanceof ApiError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

function IncidentCard({
  incident,
  onClick,
  timeZone,
}: {
  incident: Incident;
  onClick: () => void;
  timeZone: string;
}) {
  const { locale, t } = useI18n();

  return (
    <button onClick={onClick} className="ui-panel ui-panel-hover w-full text-left rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{incident.title}</h4>
        <Badge
          variant={
            incident.impact === 'critical' || incident.impact === 'major' ? 'down' : 'paused'
          }
        >
          {incidentImpactLabel(incident.impact, t)}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-3">
        <Badge variant="info">{incidentStatusLabel(incident.status, t)}</Badge>
        <span>{formatDateTime(incident.started_at, timeZone, locale)}</span>
      </div>
      {incident.message && (
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)] line-clamp-2">
          {incident.message}
        </p>
      )}
    </button>
  );
}

function IncidentDetail({
  incident,
  monitorNames,
  onClose,
  timeZone,
}: {
  incident: Incident;
  monitorNames: Map<number, string>;
  onClose: () => void;
  timeZone: string;
}) {
  const { locale, t } = useI18n();

  return (
    <div className={MODAL_OVERLAY_CLASS} onClick={onClose}>
      <div
        className={`${MODAL_PANEL_CLASS} sm:max-w-2xl p-5 sm:p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] mb-2">
              {incident.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  incident.impact === 'critical' || incident.impact === 'major' ? 'down' : 'paused'
                }
              >
                {incidentImpactLabel(incident.impact, t)}
              </Badge>
              <Badge variant="info">{incidentStatusLabel(incident.status, t)}</Badge>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full !p-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] dark:hover:text-[var(--color-text-primary)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        <div className="space-y-2 sm:space-y-3 text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)] mb-4 sm:mb-6 pb-4 sm:pb-6 border-b ui-border-hairline dark:border-[var(--color-border)]">
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] sm:w-20 text-xs sm:text-sm">
              {t('common.affected')}:
            </span>
            <span className="text-sm">
              {incident.monitor_ids.map((id) => monitorNames.get(id) ?? `#${id}`).join(', ')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] sm:w-20 text-xs sm:text-sm">
              {t('common.started')}:
            </span>
            <span className="text-sm">{formatDateTime(incident.started_at, timeZone, locale)}</span>
          </div>
          {incident.resolved_at && (
            <div className="flex flex-col sm:flex-row sm:gap-2">
              <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] sm:w-20 text-xs sm:text-sm">
                {t('common.resolved')}:
              </span>
              <span className="text-sm">
                {formatDateTime(incident.resolved_at, timeZone, locale)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {incident.message && (
            <div className="bg-[var(--color-bg)] dark:bg-[var(--color-bg-secondary)] rounded-lg p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] mb-2">
                {t('status_page.initial_report')}
              </div>
              <Markdown text={incident.message} />
            </div>
          )}

          {incident.updates.map((u) => (
            <div key={u.id} className="border-l-2 ui-border-hairline dark:border-[var(--color-border)] pl-4">
              <div className="flex items-center gap-3 mb-2">
                {u.status && <Badge variant="info">{incidentStatusLabel(u.status, t)}</Badge>}
                <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
                  {formatDateTime(u.created_at, timeZone, locale)}
                </span>
              </div>
              <Markdown text={u.message} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IncidentHistoryPage() {
  const { t } = useI18n();
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [all, setAll] = useState<Incident[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const statusQuery = useQuery({ queryKey: ['status'], queryFn: fetchStatus });
  const timeZone = getBrowserTimeZone() ?? statusQuery.data?.site_timezone ?? 'UTC';
  useApplyServerLocaleSetting(statusQuery.data?.site_locale);

  const query = useQuery({
    queryKey: ['public-incidents', 'resolved', cursor],
    queryFn: () => fetchPublicIncidents(20, cursor, { resolvedOnly: true }),
  });

  useEffect(() => {
    document.title = t('incident_history.title');
  }, [t]);

  useEffect(() => {
    if (!query.data) return;
    setAll((prev) => {
      const merged = [...prev];
      const seen = new Set(prev.map((it) => it.id));
      for (const it of query.data.incidents) {
        if (it.status !== 'resolved') continue;
        if (seen.has(it.id)) continue;
        merged.push(it);
      }
      return merged;
    });
    setNextCursor(query.data.next_cursor);
  }, [query.data]);

  const monitorNames = useMemo(() => {
    const monitors = statusQuery.data?.monitors ?? [];
    return new Map(monitors.map((m) => [m.id, m.name] as const));
  }, [statusQuery.data?.monitors]);

  const isInitialLoading = query.isLoading && all.length === 0;

  return (
    <div className="min-h-screen app-canvas">
      <header className="sticky top-0 z-20 apple-nav">
        <div className="mx-auto max-w-[88rem] px-4 py-3 sm:px-6 sm:py-4 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] dark:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label={t('history.back_aria')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">
              {t('incident_history.title')}
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {isInitialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="ui-skeleton h-28 rounded-xl border ui-border-hairline dark:border-[var(--color-border)]"
              />
            ))}
          </div>
        ) : query.isError ? (
          <Card className="p-6 text-center">
            <p className="text-sm ui-text-down dark:ui-text-down">
              {formatError(query.error) ?? t('history.failed_load_incidents')}
            </p>
          </Card>
        ) : all.length > 0 ? (
          <>
            <div className="space-y-3">
              {all.map((it) => (
                <IncidentCard
                  key={it.id}
                  incident={it}
                  timeZone={timeZone}
                  onClick={() => setSelectedIncident(it)}
                />
              ))}
            </div>

            {nextCursor && (
              <div className="mt-4">
                <Button
                  onClick={() => setCursor(nextCursor)}
                  disabled={query.isFetching}
                  variant="secondary"
                >
                  {query.isFetching ? t('common.loading_ellipsis') : t('common.load_more')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
              {t('status_page.no_past_incidents')}
            </p>
          </Card>
        )}
      </main>

      {selectedIncident && (
        <IncidentDetail
          incident={selectedIncident}
          monitorNames={monitorNames}
          timeZone={timeZone}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
