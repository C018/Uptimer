import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../app/I18nContext';
import { useApplyServerLocaleSetting } from '../app/useApplyServerLocaleSetting';
import { ApiError, fetchPublicMaintenanceWindows, fetchStatus } from '../api/client';
import type { MaintenanceWindow } from '../api/types';
import { Markdown } from '../components/Markdown';
import { Button, Card, ThemeToggle } from '../components/ui';
import { formatDateTime, getBrowserTimeZone } from '../utils/datetime';

function formatError(err: unknown): string | undefined {
  if (!err) return undefined;
  if (err instanceof ApiError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function MaintenanceHistoryPage() {
  const { locale, t } = useI18n();
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [all, setAll] = useState<MaintenanceWindow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const statusQuery = useQuery({ queryKey: ['status'], queryFn: fetchStatus });
  const timeZone = getBrowserTimeZone() ?? statusQuery.data?.site_timezone ?? 'UTC';
  useApplyServerLocaleSetting(statusQuery.data?.site_locale);
  const monitorNames = useMemo(
    () => new Map((statusQuery.data?.monitors ?? []).map((m) => [m.id, m.name] as const)),
    [statusQuery.data?.monitors],
  );

  const query = useQuery({
    queryKey: ['public-maintenance-windows', 'history', cursor],
    queryFn: () => fetchPublicMaintenanceWindows(20, cursor),
  });

  useEffect(() => {
    document.title = t('maintenance_history.title');
  }, [t]);

  useEffect(() => {
    if (!query.data) return;
    setAll((prev) => {
      const merged = [...prev];
      const seen = new Set(prev.map((it) => it.id));
      for (const it of query.data.maintenance_windows) {
        if (seen.has(it.id)) continue;
        merged.push(it);
      }
      return merged;
    });
    setNextCursor(query.data.next_cursor);
  }, [query.data]);

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
              {t('maintenance_history.title')}
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
              {formatError(query.error) ?? t('history.failed_load_maintenance')}
            </p>
          </Card>
        ) : all.length > 0 ? (
          <>
            <div className="space-y-3">
              {all.map((w) => (
                <Card key={w.id} className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
                    <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{w.title}</h4>
                    <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatDateTime(w.starts_at, timeZone, locale)} –{' '}
                      {formatDateTime(w.ends_at, timeZone, locale)}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-primary)] mb-2">
                    {t('common.affected')}:{' '}
                    {w.monitor_ids.map((id) => monitorNames.get(id) ?? `#${id}`).join(', ')}
                  </div>
                  {w.message && <Markdown text={w.message} />}
                </Card>
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
              {t('status_page.no_past_maintenance')}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
