import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { Avatar, Spinner } from './ui';
import { SeverityBadge, TicketStatusBadge, TICKET_STATUS_LABEL } from './Badges';
import { formatDateTime, relativeTime } from '../lib/format';
import type { Ticket, TicketStatus } from '../types';

interface Props {
  tickets: Ticket[];
  highlightId?: number | null;
  updatingId?: number | null;
  /** Which statuses this viewer may set. Managers get all four. */
  allowedStatuses: TicketStatus[];
  onStatusChange: (ticket: Ticket, next: TicketStatus) => void;
  onDelete?: (ticket: Ticket) => void;
  /** Hide the reporter when every row is the same person. */
  showReporter?: boolean;
  /** Link the reporter through to their detail page (managers only). */
  linkReporter?: boolean;
}

export function TicketList({
  tickets, highlightId, updatingId, allowedStatuses, onStatusChange, onDelete,
  showReporter = true, linkReporter = false,
}: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <ul className="divide-y divide-ink-100">
      {tickets.map((ticket) => {
        const isOpen = expanded.has(ticket.id);
        const settled = ticket.status === 'resolved' || ticket.status === 'closed';

        return (
          <li
            key={ticket.id}
            id={`ticket-${ticket.id}`}
            className={`px-4 py-3.5 transition-colors sm:px-5 ${
              ticket.id === highlightId ? 'bg-brand-50' : ''
            }`}
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => toggle(ticket.id)}
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Hide details' : 'Show details'}
                className="mt-0.5 shrink-0 rounded p-0.5 text-ink-400 transition-transform hover:bg-ink-100 hover:text-ink-700"
                style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      settled ? 'text-ink-400 line-through' : 'text-brand-700'
                    }`}
                  >
                    {ticket.ticket_key}
                  </span>
                  <span className="min-w-0 font-medium text-ink-900">{ticket.title}</span>
                  <SeverityBadge severity={ticket.severity} />
                  <TicketStatusBadge status={ticket.status} />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span>
                    <span className="text-ink-400">Project </span>{ticket.project_name}
                  </span>
                  {ticket.task_key ? (
                    <span>
                      <span className="text-ink-400">on </span>
                      <span className="font-mono">{ticket.task_key}</span> {ticket.task_title}
                    </span>
                  ) : (
                    <span className="italic text-ink-400">the linked task was deleted</span>
                  )}
                  <span title={formatDateTime(ticket.created_at)}>
                    <span className="text-ink-400">raised </span>{relativeTime(ticket.created_at)}
                  </span>
                </div>

                {showReporter && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Avatar name={ticket.reporter_name} src={ticket.reporter_profile_image} size="sm" />
                    {linkReporter ? (
                      <Link
                        to={`/manager/team/${ticket.reporter_id}`}
                        className="text-ink-700 hover:text-brand-600"
                      >
                        {ticket.reporter_name}
                      </Link>
                    ) : (
                      <span className="text-ink-700">{ticket.reporter_name}</span>
                    )}
                    {ticket.reporter_department && (
                      <span className="text-xs text-ink-400">· {ticket.reporter_department}</span>
                    )}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                        {ticket.description}
                      </p>
                    </div>

                    {ticket.resolution_note && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Resolution
                          </p>
                          <p className="mt-0.5 text-sm text-emerald-900">{ticket.resolution_note}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        Raised {formatDateTime(ticket.created_at)}
                      </span>
                      {ticket.updated_at !== ticket.created_at && (
                        <span>Updated {formatDateTime(ticket.updated_at)}</span>
                      )}
                      {ticket.resolved_at && <span>Resolved {formatDateTime(ticket.resolved_at)}</span>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <div className="relative">
                  <select
                    value={ticket.status}
                    disabled={updatingId === ticket.id}
                    aria-label={`Status for ${ticket.ticket_key}`}
                    onChange={(e) => onStatusChange(ticket, e.target.value as TicketStatus)}
                    className="input w-36 py-1.5 text-xs"
                  >
                    {/* The current status is always listed so the control reads correctly,
                        even when this viewer is not allowed to set it again. */}
                    {(allowedStatuses.includes(ticket.status)
                      ? allowedStatuses
                      : [ticket.status, ...allowedStatuses]
                    ).map((s) => (
                      <option key={s} value={s}>{TICKET_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  {updatingId === ticket.id && (
                    <span className="absolute right-7 top-1/2 -translate-y-1/2 text-ink-400">
                      <Spinner className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(ticket)}
                    aria-label={`Delete ${ticket.ticket_key}`}
                    className="rounded p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
