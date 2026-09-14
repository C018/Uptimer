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

/**
 * Tint comes from the `ui-surface-*` / `ui-text-*` token utilities instead of
 * per-variant Tailwind palette pairs, so light and dark appearance (and any
 * future palette change) are handled by the design tokens alone.
 * The fill/border classes are the only ones setting `border-color`, which
 * keeps the capsule deterministic.
 */
const badgeStyles = {
  up: 'ui-surface-up ui-text-up',
  down: 'ui-surface-down ui-text-down',
  maintenance: 'ui-surface-accent ui-text-maintenance',
  paused: 'ui-surface-warn ui-text-warn',
  unknown: 'ui-surface-neutral text-[var(--color-text-secondary)]',
  info: 'ui-surface-neutral text-[var(--color-text-secondary)]',
};

export function Badge({ variant, children, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
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
  /** Accessible name; omit when a visible status label sits right next to the dot. */
  label?: string;
}

const dotColors = {
  up: 'bg-[var(--color-up)]',
  down: 'bg-[var(--color-down)]',
  maintenance: 'bg-[var(--color-maintenance)]',
  paused: 'bg-[var(--color-paused)]',
  unknown: 'bg-[var(--color-unknown)]',
};

export function StatusDot({ status, pulse = false, size = 'md', label }: StatusDotProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const accessibleName = label ? { role: 'img' as const, 'aria-label': label } : {};

  return (
    <span className={cn('relative inline-flex', dotSize)} {...accessibleName}>
      {pulse && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            dotColors[status],
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex h-full w-full rounded-full',
          'shadow-[0_0_0_2px_var(--status-dot-halo)]',
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
        <h3 className="mb-2 px-1 text-footnote font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
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

/**
 * Segmented control (UISegmentedControl).
 * Follows the ARIA tabs keyboard pattern: one tab stop for the group plus
 * Left/Right/Up/Down/Home/End to move between segments.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  label,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Accessible name for the group (e.g. "Range", "Appearance"). */
  label?: string;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex((option) => option.value === value);
    if (currentIndex < 0) return;

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    const next = options[nextIndex];
    if (!next) return;

    event.preventDefault();
    onChange(next.value);
    event.currentTarget.querySelectorAll('button')[nextIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn('apple-segmented', className)}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
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

export function Spinner({
  className = '',
  label = 'Loading',
}: {
  className?: string;
  /** Accessible name announced while the indicator is on screen. */
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2',
        'ui-border-hairline border-t-[var(--color-accent)]',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
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
