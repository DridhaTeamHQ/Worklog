import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, Plus, LayoutGrid, List } from 'lucide-react';
import { ticketApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { RaiseTicketModal } from '../../components/RaiseTicketModal';
import { TicketList } from '../../components/TicketList';
import { TicketBoard } from '../../components/TicketBoard';
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

type View = 'board' | 'list';

export function TicketsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const [view, setView] = useState<View>('board');
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

  useEffect(() => { if (highlightId) setView('list'); }, [highlightId]);

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
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="segmented" role="tablist" aria-label="How to show tickets">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'board'}
                onClick={() => { setView('board'); setStatus(''); }}
                className={`segmented-item inline-flex items-center gap-1.5 ${view === 'board' ? 'segmented-item-active' : ''}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => setView('list')}
                className={`segmented-item inline-flex items-center gap-1.5 ${view === 'list' ? 'segmented-item-active' : ''}`}
              >
                <List className="h-3.5 w-3.5" aria-hidden /> List
              </button>
            </div>

            {/* Only the list needs a status filter; the board's columns are one. */}
            {view === 'list' && (
              <div className="overflow-x-auto">
                <div className="segmented min-w-max" role="tablist" aria-label="Filter tickets by status">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.value || 'all'}
                      type="button"
                      role="tab"
                      aria-selected={status === tab.value}
                      onClick={() => setStatus(tab.value)}
                      className={`segmented-item ${status === tab.value ? 'segmented-item-active' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            <p className="px-4 py-2 text-xs text-muted-foreground">
              {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            </p>
            {view === 'board' ? (
              <TicketBoard
                tickets={tickets}
                allowedStatuses={EMPLOYEE_STATUSES}
                onMove={changeStatus}
                busyId={updatingId}
                showReporter={false}
              />
            ) : (
              <TicketList
                tickets={tickets}
                highlightId={highlightId}
                updatingId={updatingId}
                allowedStatuses={EMPLOYEE_STATUSES}
                onStatusChange={changeStatus}
                showReporter={false}
              />
            )}
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              You can reopen or close your own tickets — on the board, that is the Open and
              Closed columns. Marking one <strong>Resolved</strong> is your manager's call.
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
