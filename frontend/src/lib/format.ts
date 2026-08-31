import type { EffectiveStatus, Priority } from '../types';

/* ------------------------------------------------------------------- dates */

/** Today as 'YYYY-MM-DD' in the viewer's own timezone. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'August 26, 2026' — the long form used for report headings. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** '26 Aug 2026' — the compact form used inside tables. */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The weekday on its own — the label under a bar in a week strip. */
export function formatWeekday(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateShort(iso)}, ${formatTime(iso)}`;
}

/** 'just now' / '4h ago' / '3d ago', falling back to a date beyond a week. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`;
  return formatDateShort(iso);
}

/** Human phrasing for a deadline, plus whether it should read as urgent. */
export function deadlineLabel(deadline: string | null, status: string): { text: string; tone: 'normal' | 'warn' | 'danger' } {
  if (!deadline) return { text: 'No deadline', tone: 'normal' };
  if (status === 'completed') return { text: formatDateShort(deadline), tone: 'normal' };

  const today = todayIso();
  if (deadline < today) {
    const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${deadline}T00:00:00`).getTime()) / 86_400_000);
    return { text: `${days} day${days === 1 ? '' : 's'} overdue`, tone: 'danger' };
  }
  if (deadline === today) return { text: 'Due today', tone: 'warn' };
  if (deadline === addDaysIso(today, 1)) return { text: 'Due tomorrow', tone: 'warn' };
  return { text: `Due ${formatDateShort(deadline)}`, tone: 'normal' };
}

/* ------------------------------------------------------------------ labels */

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** Splits a free-text daily report into the individual lines the employee typed. */
export function reportLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}



/**
 * What to show where a task is named.
 *
 * A title is optional at assignment time, so an untitled task falls back to its key —
 * which is how people refer to it anyway — and only reaches the generic wording when
 * it has neither.
 */
export function taskLabel(task: { title?: string | null; task_key?: string | null }): string {
  const title = task.title?.trim();
  if (title) return title;
  return task.task_key?.trim() || 'Untitled task';
}

export const pluralize = (n: number, singular: string, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;
