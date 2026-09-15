/**
 * Inline icon set for the admin table action columns.
 *
 * The web app intentionally ships no icon dependency (see package.json), so the
 * action column draws its own 24×24 stroke glyphs. Every glyph renders with
 * `currentColor` — the semantic colour comes from the surrounding button tone —
 * and scales through the shared `h-4 w-4` box.
 */
import type { ReactNode } from 'react';

function Glyph({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
    >
      {children}
    </svg>
  );
}

/** Run an on-demand probe (monitor / notification channel). */
export function TestIcon() {
  return (
    <Glyph>
      <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </Glyph>
  );
}

/** Suspend a monitor. */
export function PauseIcon() {
  return (
    <Glyph>
      <path d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </Glyph>
  );
}

/** Bring a suspended monitor back online. */
export function ResumeIcon() {
  return (
    <Glyph>
      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </Glyph>
  );
}

/** Open the edit form. */
export function EditIcon() {
  return (
    <Glyph>
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </Glyph>
  );
}

/** Destructive action. */
export function TrashIcon() {
  return (
    <Glyph>
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </Glyph>
  );
}

/** Publish a new progress note on an incident. */
export function UpdateIcon() {
  return (
    <Glyph>
      <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Glyph>
  );
}

/** Close an incident. */
export function ResolveIcon() {
  return (
    <Glyph>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Glyph>
  );
}

/** Overflow trigger that reveals the actions collapsed on narrow viewports. */
export function MoreIcon() {
  return (
    <Glyph>
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Glyph>
  );
}
