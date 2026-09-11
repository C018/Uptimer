import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';

import { useI18n } from '../app/I18nContext';
import { useTheme } from '../app/ThemeContext';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ *
 * Shared class contracts
 *
 * Kept as exported constants so every page keeps composing the same
 * primitives; only the visual language changed (Apple HIG).
 * ------------------------------------------------------------------ */

export const PANEL_BASE_CLASS = 'ui-panel';

export const PANEL_INTERACTIVE_CLASS =
  'ui-panel-hover hover:ui-border-hairline dark:hover:border-[var(--color-border)]';

export const TABLE_ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-apple px-2.5 py-1.5 text-footnote font-medium transition-colors focus-visible:outline-none';

export const MODAL_OVERLAY_CLASS = 'ui-modal-overlay animate-fade-in';

export const MODAL_PANEL_CLASS = 'ui-modal-panel animate-apple-sheet';

export const INPUT_CLASS = cn('ui-input', 'text-callout');

export const SELECT_CLASS = cn('ui-select', 'text-callout');

export const TEXTAREA_CLASS = cn('ui-textarea', 'text-callout', 'resize-y');

export const FIELD_LABEL_CLASS = 'ui-label';

export const FIELD_HELP_CLASS = 'ui-help';

/* ------------------------------------------------------------------ *
 * Badges — Apple tinted capsules (system colour @ ~12% fill)
 * ------------------------------------------------------------------ */

interface BadgeProps {
  variant: 'up' | 'down' | 'maintenance' | 'paused' | 'unknown' | 'info';
  children: ReactNode;
  size?: 'sm' | 'md';
}

const badgeStyles = {
  up: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  down: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/25',
  maintenance:
    'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
  paused:
    'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
  unknown:
    'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/25',
  info: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
};

export function Badge({ variant, children, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset',
        'apple-numeric',
        badgeStyles[variant],
        size === 'sm' ? 'px-2.5 py-0.5 text-caption-1' : 'px-3 py-1 text-footnote',
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Status indicator
 * ------------------------------------------------------------------ */

interface StatusDotProps {
  status: 'up' | 'down' | 'maintenance' | 'paused' | 'unknown';
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const dotColors = {
  up: 'bg-[var(--color-up)]',
  down: 'bg-[var(--color-down)]',
  maintenance: 'bg-[var(--color-maintenance)]',
  paused: 'bg-[var(--color-paused)]',
  unknown: 'bg-[var(--color-unknown)]',
};

export function StatusDot({ status, pulse = false, size = 'md' }: StatusDotProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <span className={cn('relative inline-flex', dotSize)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            dotColors[status],
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex h-full w-full rounded-full',
          'shadow-[0_0_0_2px_rgba(255,255,255,0.65)] dark:shadow-none',
          dotColors[status],
        )}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  const clickProps = onClick
    ? {
        onClick,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onClick();
          }
        },
        role: 'button',
        tabIndex: 0,
      }
    : {};

  return (
    <div
      className={cn(
        PANEL_BASE_CLASS,
        hover && PANEL_INTERACTIVE_CLASS,
        hover && onClick && 'cursor-pointer',
        'transition-base',
        className,
      )}
      {...clickProps}
    >
      {children}
    </div>
  );
}

/** Inset-grouped list container (iOS "Grouped List" appearance). */
export function ListGroup({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <section className={className}>
      {title ? (
        <h3 className="mb-2 px-1 text-footnote font-semibold uppercase tracking-wide text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)]">
          {title}
        </h3>
      ) : null}
      <div className="apple-list">{children}</div>
    </section>
  );
}

export function ListRow({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn('apple-list-row w-full text-left', className)}>
        {children}
      </button>
    );
  }

  return <div className={cn('apple-list-row', className)}>{children}</div>;
}

/** Section heading for dashboard/analytics content. */
export function SectionHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="apple-title-3 text-[var(--color-text-primary)]">{title}</h2>
        {subtitle ? <p className="apple-footnote mt-0.5 truncate">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
}

const buttonVariants = {
  // Filled tint (systemBlue) — the default Apple action.
  primary: 'ui-accent-fill hover:brightness-[1.06] active:brightness-95',
  // Tinted / grey fill — secondary actions.
  secondary:
    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:brightness-[1.03] active:brightness-95 shadow-none',
  // Plain text button — tertiary, no chrome.
  ghost:
    'text-[var(--color-accent)] hover:ui-surface-accent active:ui-surface-accent',
  // Destructive (systemRed).
  danger:
    'bg-[var(--color-down)] text-white hover:brightness-[1.06] active:brightness-95 shadow-sm',
};

const buttonSizes = {
  sm: 'h-8 px-3 text-footnote',
  md: 'h-10 px-4 text-callout',
  lg: 'h-11 px-5 text-body',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-apple-md font-medium',
        'transition-[background-color,box-shadow,transform] duration-200 ease-apple',
        'active:scale-[0.97] focus-visible:outline-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Segmented control (UISegmentedControl). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('apple-segmented', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className="apple-segment"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Switch (UISwitch). */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  className = '',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('apple-switch', disabled && 'cursor-not-allowed opacity-40', className)}
      data-on={checked}
    />
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 ui-border-hairline border-t-blue-500 dark:border-[var(--color-border)] dark:border-t-blue-400',
        className,
      )}
      role="status"
      aria-live="polite"
    />
  );
}

/* ------------------------------------------------------------------ *
 * Theme switcher
 * ------------------------------------------------------------------ */

const SunIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const MoonIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const SystemIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const themeLabel = t(`theme.${theme}`);
  const title = t('theme.title', { value: themeLabel });

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-apple',
        'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)] active:bg-[var(--color-bg)]',
        'dark:text-[var(--color-text-muted)] dark:hover:bg-[var(--color-bg-secondary)] dark:hover:text-[var(--color-text-primary)]',
        'transition-colors duration-150 focus-visible:outline-none',
      )}
      title={title}
      aria-label={title}
    >
      {theme === 'light' && <SunIcon />}
      {theme === 'dark' && <MoonIcon />}
      {theme === 'system' && <SystemIcon />}
    </button>
  );
}
