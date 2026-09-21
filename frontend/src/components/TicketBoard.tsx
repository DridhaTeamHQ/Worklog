import { Trash2, UserCheck } from 'lucide-react';
import { Avatar, Select, Spinner } from './ui';
import { SeverityBadge } from './Badges';
import { Board, type BoardColumn } from './Board';
import { formatDateTime, relativeTime } from '../lib/format';
import type { TeamMember, Ticket, TicketStatus } from '../types';

const COLUMNS: { key: TicketStatus; label: string; dot: string }[] = [
  { key: 'open', label: 'Open', dot: 'bg-destructive' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-info' },
  { key: 'resolved', label: 'Resolved', dot: 'bg-success' },
  { key: 'closed', label: 'Closed', dot: 'bg-muted-foreground' },
];

interface Props {
  tickets: Ticket[];
  /** Which columns this viewer may drop into. A reporter cannot declare Resolved. */
  allowedStatuses: TicketStatus[];
  onMove: (ticket: Ticket, next: TicketStatus) => void;
  onDelete?: (ticket: Ticket) => void;
  busyId?: number | null;
  /** Hide the reporter where every card is the same person. */
  showReporter?: boolean;
  members?: TeamMember[];
  onAssign?: (ticket: Ticket, assigneeId: number | null) => void;
  assigningId?: number | null;
}

/** Tickets as a board, one column per status, dragged to change status. */
export function TicketBoard({
  tickets,
  allowedStatuses,
  onMove,
  onDelete,
  busyId = null,
  showReporter = true,
  members = [],
  onAssign,
  assigningId = null,
}: Props) {
  const columns: BoardColumn<Ticket>[] = COLUMNS.map((column) => ({
    ...column,
    items: tickets.filter((t) => t.status === column.key),
    droppable: allowedStatuses.includes(column.key),
  }));

  return (
    <Board
      columns={columns}
      getId={(ticket) => ticket.id}
      getLabel={(ticket) => `${ticket.ticket_key} ${ticket.title}`}
      onMove={(ticket, next) => onMove(ticket, next as TicketStatus)}
      busyId={busyId}
      emptyLabel="No tickets"
      renderCard={(ticket) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[11px] font-semibold text-primary-strong">
              {ticket.ticket_key}
            </span>
            <SeverityBadge severity={ticket.severity} />
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {ticket.title}
          </p>

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {ticket.project_name}
            {ticket.task_key
              ? <> · on <span className="font-mono">{ticket.task_key}</span></>
              : <span className="italic text-muted-foreground"> · linked task deleted</span>}
          </p>

          {ticket.resolution_note && (
            <p className="mt-2 line-clamp-2 rounded border border-success/25 bg-success/10 px-2 py-1.5 text-[11px] leading-snug text-success">
              {ticket.resolution_note}
            </p>
          )}

          {/* Assignee section: editable for managers if onAssign provided, or badge if read-only */}
          {onAssign ? (
            <div
              className="mt-2.5 rounded-lg border border-border bg-muted/40 p-2 text-xs"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-primary" /> Assign to:
                </span>
                {ticket.assignee_department && (
                  <span className="text-[10px] text-muted-foreground">
                    {ticket.assignee_department}
                  </span>
                )}
              </div>
              <div className="relative">
                <Select
                  value={ticket.assignee_id ? String(ticket.assignee_id) : ''}
                  disabled={assigningId === ticket.id}
                  ariaLabel={`Assign ticket ${ticket.ticket_key}`}
                  onChange={(v) => onAssign(ticket, v ? Number(v) : null)}
                  className="w-full text-xs py-1"
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...(members || [])
                      .filter((m) => !ticket.reporter_department || (m.department && m.department.trim().toLowerCase() === ticket.reporter_department.trim().toLowerCase()) || m.id === ticket.assignee_id)
                      .map((m) => ({
                        value: String(m.id),
                        label: m.job_title ? `${m.name} (${m.job_title})` : m.name,
                      })),
                  ]}
                />
                {assigningId === ticket.id && (
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Spinner className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Assignee:</span>
                {ticket.assignee_name ? (
                  <span className="font-medium text-foreground">{ticket.assignee_name}</span>
                ) : (
                  <span className="italic text-muted-foreground">Unassigned</span>
                )}
              </span>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
            {showReporter ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar name={ticket.reporter_name} src={ticket.reporter_profile_image} size="sm" />
                <span className="truncate text-xs text-muted-foreground">{ticket.reporter_name}</span>
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground" title={formatDateTime(ticket.created_at)}>
                raised {relativeTime(ticket.created_at)}
              </span>
            )}

            <span className="flex shrink-0 items-center gap-1">
              {showReporter && (
                <span className="text-[11px] text-muted-foreground" title={formatDateTime(ticket.created_at)}>
                  {relativeTime(ticket.created_at)}
                </span>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(ticket)}
                  aria-label={`Delete ${ticket.ticket_key}`}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </div>
        </>
      )}
    />
  );
}
