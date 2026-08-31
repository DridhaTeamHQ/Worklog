import { AlertTriangle, CheckCircle2, Circle, CircleDot, CircleSlash, Loader2 } from 'lucide-react';
import type { EffectiveStatus, Priority, TicketSeverity, TicketStatus } from '../types';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';

/**
 * Status is carried by colour *and* an icon *and* a word — colour alone would leave
 * the four states indistinguishable to anyone who cannot separate red from green.
 */
const STATUS_STYLE: Record<EffectiveStatus, { className: string; Icon: typeof Circle }> = {
  pending: { className: 'bg-warning/10 text-warning border-warning/25', Icon: Circle },
  in_progress: { className: 'bg-info/10 text-info border-info/25', Icon: Loader2 },
  completed: { className: 'bg-success/10 text-success border-success/25', Icon: CheckCircle2 },
  overdue: { className: 'bg-destructive/10 text-destructive border-destructive/25', Icon: AlertTriangle },
};

export function StatusBadge({ status, className = '' }: { status: EffectiveStatus | 'idle'; className?: string }) {
  if (status === 'idle') {
    return (
      <span className={`badge bg-muted text-muted-foreground border-border ${className}`}>
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
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-info/10 text-info border-info/25',
  high: 'bg-warning/10 text-warning border-warning/30',
  urgent: 'bg-destructive text-destructive-foreground border-destructive',
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
  low: { className: 'text-muted-foreground', glyph: '↓' },
  medium: { className: 'text-info', glyph: '=' },
  high: { className: 'text-warning', glyph: '↑' },
  urgent: { className: 'text-destructive', glyph: '⇈' },
};

export function PriorityMark({ priority }: { priority: Priority }) {
  const { className, glyph } = PRIORITY_MARK[priority];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-foreground">
      <span aria-hidden className={`font-bold leading-none ${className}`}>{glyph}</span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/* ------------------------------------------------------------------ tickets */

const SEVERITY_STYLE: Record<TicketSeverity, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-info/10 text-info border-info/25',
  high: 'bg-warning/10 text-warning border-warning/30',
  critical: 'bg-destructive text-destructive-foreground border-destructive',
};

const SEVERITY_LABEL: Record<TicketSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function SeverityBadge({ severity }: { severity: TicketSeverity }) {
  return (
    <span className={`badge ${SEVERITY_STYLE[severity]}`}>
      <span className="sr-only">Severity: </span>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

/** Ticket status carries an icon as well as colour, same as task status. */
const TICKET_STATUS_STYLE: Record<TicketStatus, { className: string; Icon: typeof Circle }> = {
  open: { className: 'bg-destructive/10 text-destructive border-destructive/25', Icon: CircleDot },
  in_progress: { className: 'bg-info/10 text-info border-info/25', Icon: Loader2 },
  resolved: { className: 'bg-success/10 text-success border-success/25', Icon: CheckCircle2 },
  closed: { className: 'bg-muted text-muted-foreground border-border', Icon: CircleSlash },
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { className, Icon } = TICKET_STATUS_STYLE[status];
  return (
    <span className={`badge ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {TICKET_STATUS_LABEL[status]}
    </span>
  );
}
