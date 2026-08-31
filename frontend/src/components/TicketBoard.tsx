import { Trash2 } from 'lucide-react';
import { Avatar } from './ui';
import { SeverityBadge } from './Badges';
import { Board, type BoardColumn } from './Board';
import { formatDateTime, relativeTime } from '../lib/format';
import type { Ticket, TicketStatus } from '../types';

const COLUMNS: { key: TicketStatus; label: string; dot: string }[] = [
  { key: 'open', label: 'Open', dot: 'bg-red-500' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { key: 'resolved', label: 'Resolved', dot: 'bg-emerald-500' },
  { key: 'closed', label: 'Closed', dot: 'bg-ink-400' },
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
}

/** Tickets as a board, one column per status, dragged to change status. */
export function TicketBoard({
  tickets, allowedStatuses, onMove, onDelete, busyId = null, showReporter = true,
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
            <span className="min-w-0 truncate font-mono text-[11px] font-semibold text-brand-700">
              {ticket.ticket_key}
            </span>
            <SeverityBadge severity={ticket.severity} />
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink-900">
            {ticket.title}
          </p>

          <p className="mt-1 truncate text-[11px] text-ink-500">
            {ticket.project_name}
            {ticket.task_key
              ? <> · on <span className="font-mono">{ticket.task_key}</span></>
              : <span className="italic text-ink-400"> · linked task deleted</span>}
          </p>

          {ticket.resolution_note && (
            <p className="mt-2 line-clamp-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] leading-snug text-emerald-900">
              {ticket.resolution_note}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
            {showReporter ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar name={ticket.reporter_name} src={ticket.reporter_profile_image} size="sm" />
                <span className="truncate text-xs text-ink-600">{ticket.reporter_name}</span>
              </span>
            ) : (
              <span className="text-[11px] text-ink-400" title={formatDateTime(ticket.created_at)}>
                raised {relativeTime(ticket.created_at)}
              </span>
            )}

            <span className="flex shrink-0 items-center gap-1">
              {showReporter && (
                <span className="text-[11px] text-ink-400" title={formatDateTime(ticket.created_at)}>
                  {relativeTime(ticket.created_at)}
                </span>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(ticket)}
                  aria-label={`Delete ${ticket.ticket_key}`}
                  className="rounded p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
