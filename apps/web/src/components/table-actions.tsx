/**
 * Shared building blocks for admin table action columns.
 *
 * Product intent: an operator must be able to read a row's state and fire its
 * actions without dragging the table horizontally. Two mechanisms cooperate:
 *
 * 1. The action cell is pinned to the right edge of the scroll container
 *    (`TABLE_ACTION_CELL_CLASS` / `TABLE_ACTION_HEAD_CLASS` in ./ui), so it
 *    stays on screen no matter how far the other columns scroll.
 * 2. Actions are compact icon buttons with an accessible name; when the
 *    viewport is too narrow to hold them all, the secondary ones fold into a
 *    `⋯` overflow menu instead of being squeezed or clipped.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { MoreIcon } from './action-icons';
import { Spinner, TABLE_ACTION_ICON_BUTTON_CLASS, cn } from './ui';

export type TableActionTone = 'accent' | 'warn' | 'up' | 'down' | 'neutral';

/**
 * Semantic colour per action, mirroring the palette the text buttons used:
 * test = accent, pause = warn, resolve = up, delete = down, edit = neutral.
 */
const TONE_CLASS: Record<TableActionTone, string> = {
  accent: 'ui-text-accent hover:ui-surface-accent',
  warn: 'ui-text-warn hover:ui-surface-warn',
  up: 'ui-text-up hover:ui-surface-up',
  down: 'ui-text-down hover:ui-surface-down',
  neutral:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text-primary)] dark:text-[var(--color-text-muted)] dark:hover:bg-[var(--color-bg-secondary)] dark:hover:text-[var(--color-text-primary)]',
};

/** Whole-pixel geometry used to place the overflow panel without measuring it. */
const MENU_WIDTH = 190;
const MENU_ITEM_HEIGHT = 34;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

const COLLAPSE_CLASS = {
  sm: { inline: 'hidden items-center gap-1 sm:flex', trigger: 'sm:hidden' },
  md: { inline: 'hidden items-center gap-1 md:flex', trigger: 'md:hidden' },
  lg: { inline: 'hidden items-center gap-1 lg:flex', trigger: 'lg:hidden' },
} as const;

export interface TableActionItem {
  /** Stable React key. */
  key: string;
  /** Accessible name + native tooltip; also the menu row label. */
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  tone?: TableActionTone;
  disabled?: boolean;
  /** Swaps the glyph for a spinner while the request is in flight. */
  busy?: boolean;
  /**
   * Stays visible as an icon on narrow viewports; every other action collapses
   * into the overflow menu. Use at most one per table.
   */
  primary?: boolean;
}

export interface TableActionsProps {
  items: TableActionItem[];
  /** Accessible name for the `⋯` trigger. */
  overflowLabel: string;
  /**
   * Breakpoint below which the non-primary actions collapse into the `⋯` menu.
   * Tables with a wide, always-scrolling body keep more icons on small screens.
   */
  collapseBelow?: keyof typeof COLLAPSE_CLASS;
}

function TableActionIconButton({ item }: { item: TableActionItem }) {
  return (
    <button
      type="button"
      onClick={item.onSelect}
      disabled={item.disabled}
      aria-label={item.label}
      aria-busy={item.busy ? true : undefined}
      title={item.label}
      className={cn(
        TABLE_ACTION_ICON_BUTTON_CLASS,
        TONE_CLASS[item.tone ?? 'neutral'],
        item.disabled && 'cursor-not-allowed',
      )}
    >
      {item.busy ? <Spinner className="h-3.5 w-3.5" label={item.label} /> : item.icon}
    </button>
  );
}

/**
 * `⋯` trigger + portal panel.
 *
 * The panel is rendered into `document.body` so the scroll container can never
 * clip it, and it is positioned against the trigger rect. It closes on select,
 * outside pointer-down, Escape (returning focus to the trigger), scroll and
 * resize — the latter two because a fixed panel would otherwise drift away from
 * its row.
 */
function TableActionOverflow({
  items,
  label,
  className,
}: {
  items: TableActionItem[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const handleReflow = () => close();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('scroll', handleReflow, true);
    window.addEventListener('resize', handleReflow);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('scroll', handleReflow, true);
      window.removeEventListener('resize', handleReflow);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  }, [open]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelHeight = items.length * MENU_ITEM_HEIGHT + VIEWPORT_MARGIN;
    const opensUpwards = rect.bottom + MENU_GAP + panelHeight > window.innerHeight - VIEWPORT_MARGIN;

    setPosition({
      top: opensUpwards
        ? Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - panelHeight)
        : rect.bottom + MENU_GAP,
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
      ),
    });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        title={label}
        className={cn(TABLE_ACTION_ICON_BUTTON_CLASS, TONE_CLASS.neutral, className)}
      >
        <MoreIcon />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="menu"
              aria-label={label}
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              className={cn(
                'fixed z-50 animate-fade-in p-1',
                'rounded-apple-md border-[0.5px] border-[var(--color-border)]',
                'bg-[var(--glass-strong)] backdrop-blur-apple shadow-soft-lg',
              )}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-apple px-2.5 py-2 text-left',
                    'text-footnote font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    TONE_CLASS[item.tone ?? 'neutral'],
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Renders a table's action list: primary icons inline, secondary actions either
 * inline (wide viewports) or folded into `⋯` (narrow viewports).
 *
 * Drop it inside a `TABLE_ACTION_CELL_CLASS` cell; the row needs `group` so the
 * pinned cell can follow the row hover state.
 */
export function TableActions({
  items,
  overflowLabel,
  collapseBelow = 'lg',
}: TableActionsProps) {
  const primaryItems = items.filter((item) => item.primary);
  const collapsedItems = items.filter((item) => !item.primary);
  const collapse = COLLAPSE_CLASS[collapseBelow];

  return (
    <div className="flex items-center justify-end gap-1">
      {primaryItems.map((item) => (
        <TableActionIconButton key={item.key} item={item} />
      ))}
      {collapsedItems.length > 0 ? (
        <>
          <div className={collapse.inline}>
            {collapsedItems.map((item) => (
              <TableActionIconButton key={item.key} item={item} />
            ))}
          </div>
          <TableActionOverflow
            items={collapsedItems}
            label={overflowLabel}
            className={collapse.trigger}
          />
        </>
      ) : null}
    </div>
  );
}
