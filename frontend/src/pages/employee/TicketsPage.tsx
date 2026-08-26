import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, Plus } from 'lucide-react';
import { ticketApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { RaiseTicketModal } from '../../components/RaiseTicketModal';
import { TicketList } from '../../components/TicketList';
import { TICKET_STATUS_LABEL } from '../../components/Badges';
import {
  EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput, StatCard,
} from '../../components/ui';
import type { Ticket, TicketCounts, TicketStatus } from '../../types';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

/** A reporter may withdraw their own ticket or reopen it, but not declare it resolved. */
const EMPLOYEE_STATUSES: TicketStatus[] = ['open', 'closed'];

export function TicketsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const scrolledTo = useRef<number | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data, meta } = await ticketApi.list({
        status: status || undefined,
        search: search || undefined,
        sort: 'created_desc',
        limit: 200,
      }, signal);
      setTickets(data);
      setCounts((meta?.counts as TicketCounts) ?? null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load your tickets.');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // Arriving from a notification: bring the ticket into view once, then drop the marker.
  useEffect(() => {
    if (!highlightId || loading || scrolledTo.current === highlightId) return;
    const el = document.getElementById(`ticket-${highlightId}`);
    if (!el) return;
    scrolledTo.current = highlightId;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      }, { replace: true });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [highlightId, loading, tickets, setParams]);

  const changeStatus = async (ticket: Ticket, next: TicketStatus) => {
    if (next === ticket.status) return;
    setUpdatingId(ticket.id);
    try {
      const { data } = await ticketApi.updateStatus(ticket.id, next);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? data : t)));
      toast.success(`${ticket.ticket_key} set to ${TICKET_STATUS_LABEL[next]}.`);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the ticket.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = Boolean(search || status);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tickets"
        subtitle="Bugs you have hit while working on your tasks."
        actions={(
          <button type="button" onClick={() => setRaiseOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Raise a ticket
          </button>
        )}
      />

      {counts && counts.total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open" value={counts.open} accent="red" icon={<Bug className="h-5 w-5" />} />
          <StatCard label="In Progress" value={counts.in_progress} accent="blue" icon={<Bug className="h-5 w-5" />} />
          <StatCard label="Resolved" value={counts.resolved} accent="emerald" icon={<Bug className="h-5 w-5" />} />
          <StatCard label="Raised in total" value={counts.total} accent="ink" icon={<Bug className="h-5 w-5" />} />
        </div>
      )}

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-1 rounded-lg bg-ink-100 p-1" role="tablist" aria-label="Filter tickets by status">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    status === tab.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search your tickets" className="lg:w-64" />
        </div>

        {loading ? (
          <LoadingBlock label="Loading your tickets" rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<Bug className="h-6 w-6" />}
            title={filtered ? 'No matching tickets' : "You haven't raised any tickets yet."}
            description={
              filtered
                ? 'Try a different search term or clear the status filter.'
                : 'If you hit a bug while working on a task, raise a ticket so your manager knows about it.'
            }
            action={filtered ? (
              <button type="button" onClick={() => { setSearch(''); setStatus(''); }} className="btn-secondary">
                Clear filters
              </button>
            ) : (
              <button type="button" onClick={() => setRaiseOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Raise a ticket
              </button>
            )}
          />
        ) : (
          <>
            <p className="px-4 py-2 text-xs text-ink-500">
              {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            </p>
            <TicketList
              tickets={tickets}
              highlightId={highlightId}
              updatingId={updatingId}
              allowedStatuses={EMPLOYEE_STATUSES}
              onStatusChange={changeStatus}
              showReporter={false}
            />
            <p className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
              You can reopen or close your own tickets. Marking one <strong>Resolved</strong> is
              your manager's call.
            </p>
          </>
        )}
      </div>

      <RaiseTicketModal
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        onRaised={() => void load()}
      />
    </div>
  );
}
