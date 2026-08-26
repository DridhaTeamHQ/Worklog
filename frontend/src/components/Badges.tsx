import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { EffectiveStatus, Priority } from '../types';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';

/**
 * Status is carried by colour *and* an icon *and* a word — colour alone would leave
 * the four states indistinguishable to anyone who cannot separate red from green.
 */
const STATUS_STYLE: Record<EffectiveStatus, { className: string; Icon: typeof Circle }> = {
  pending: { className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Circle },
  in_progress: { className: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Loader2 },
  completed: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  overdue: { className: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle },
};

export function StatusBadge({ status, className = '' }: { status: EffectiveStatus | 'idle'; className?: string }) {
  if (status === 'idle') {
    return (
      <span className={`badge bg-ink-100 text-ink-600 border-ink-200 ${className}`}>
        <Circle className="h-3 w-3" aria-hidden />
        No tasks
      </span>
    );
  }
  const { className: tone, Icon } = STATUS_STYLE[status];
  return (
    <span className={`badge ${tone} ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-ink-100 text-ink-600 border-ink-200',
  medium: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-red-600 text-white border-red-600',
};

export function PriorityBadge({ priority, className = '' }: { priority: Priority; className?: string }) {
  return (
    <span className={`badge ${PRIORITY_STYLE[priority]} ${className}`}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/**
 * Compact priority mark for dense tables: an arrow whose direction and colour encode
 * urgency, plus the word itself so it never depends on colour alone.
 */
const PRIORITY_MARK: Record<Priority, { className: string; glyph: string }> = {
  low: { className: 'text-ink-400', glyph: '↓' },
  medium: { className: 'text-amber-500', glyph: '=' },
  high: { className: 'text-orange-500', glyph: '↑' },
  urgent: { className: 'text-red-600', glyph: '⇈' },
};

export function PriorityMark({ priority }: { priority: Priority }) {
  const { className, glyph } = PRIORITY_MARK[priority];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-700">
      <span aria-hidden className={`font-bold leading-none ${className}`}>{glyph}</span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
