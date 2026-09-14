import { Suspense, lazy } from 'react';
import { useI18n } from '../app/I18nContext';

// Load react-markdown on demand so the status page can render faster.
const ReactMarkdown = lazy(() => import('react-markdown'));

export function Markdown({ text }: { text: string }) {
  const { t } = useI18n();

  return (
    <div className="markdown-preview text-sm leading-relaxed text-[var(--color-text-primary)]">
      <Suspense
        fallback={<div className="text-[var(--color-text-muted)]">{t('common.loading')}</div>}
      >
        <ReactMarkdown>{text}</ReactMarkdown>
      </Suspense>
    </div>
  );
}
