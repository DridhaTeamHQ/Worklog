import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, AlertOctagon, Trash2, LayoutGrid, List } from 'lucide-react';
import { projectApi, teamApi, ticketApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { TicketList } from '../../components/TicketList';
import { TicketBoard } from '../../components/TicketBoard';
import { TICKET_STATUS_LABEL } from '../../components/Badges';
import {
  EmptyState, ErrorState, LoadingBlock, Modal, PageHeader, SearchInput, StatCard, Select,
} from '../../components/ui';
import type { Project, TeamMember, Ticket, TicketCounts, TicketStatus } from '../../types';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'unresolved', label: 'Needs attention' },
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const MANAGER_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

type View = 'board' | 'list';

export function ManagerTicketsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<TicketCounts | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [view, setView] = useState<View>('board');
  const [status, setStatus] = useState(params.get('status') ?? 'unresolved');
  const [projectId, setProjectId] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('severity_desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [resolving, setResolving] = useState<Ticket | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scrolledTo = useRef<number | null>(null);

  useEffect(() => {
    projectApi.list().then(({ data }) => setProjects(data)).catch(() => setProjects([]));
    teamApi.list().then(({ data }) => setMembers(data)).catch(() => setMembers([]));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data, meta } = await ticketApi.list({
        status: status || undefined,
        projectId: projectId ? Number(projectId) : undefined,
        reporterId: reporterId ? Number(reporterId) : undefined,
        severity: severity || undefined,
        search: search || undefined,
        sort,
        limit: 200,
      }, signal);
      setTickets(data);
      setCounts((meta?.counts as TicketCounts) ?? null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }, [status, projectId, reporterId, severity, search, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // A ticket reached from a notification may not match the default filter, so widen
  // to "All" rather than showing an empty list the person cannot explain. It also
  // drops to the list, which is the view that can scroll one row into sight.
  useEffect(() => {
    if (!highlightId) return;
    setView('list');
    setStatus((prev) => (prev === 'unresolved' ? '' : prev));
  }, [highlightId]);

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
    // Resolving asks for a note — "what did you actually do" is the useful part.
    if (next === 'resolved') {
      setResolutionNote(ticket.resolution_note ?? '');
      setResolving(ticket);
      return;
    }
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

  const confirmResolve = async () => {
    if (!resolving) return;
    setSavingResolution(true);
    try {
      const { data } = await ticketApi.updateStatus(resolving.id, 'resolved', resolutionNote.trim() || undefined);
      setTickets((prev) => prev.map((t) => (t.id === resolving.id ? data : t)));
      toast.success(`${resolving.ticket_key} marked as Resolved.`);
      setResolving(null);
      setResolutionNote('');
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resolve the ticket.');
    } finally {
      setSavingResolution(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await ticketApi.remove(confirmDelete.id);
      setTickets((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      toast.success(`${confirmDelete.ticket_key} was deleted.`);
      setConfirmDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the ticket.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * On the board the columns are the status filter, so a status filter on top of them
   * would silently empty three of the four columns. Switching to the board widens to
   * every status; switching back restores the list's default.
   */
  const changeView = (next: View) => {
    setView(next);
    setStatus(next === 'board' ? '' : 'unresolved');
  };

  const hasFilters = Boolean(search || projectId || reporterId || severity
    || (view === 'list' && status !== 'unresolved'));

  return (
    <div className="space-y-5">
      <PageHeader title="Tickets" subtitle="Bugs reported by the team while working on their tasks." />

      {counts && counts.total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open" value={counts.open} accent="red" icon={<Bug className="h-5 w-5" />} />
          <StatCard label="In Progress" value={counts.in_progress} accent="blue" icon={<Bug className="h-5 w-5" />} />
          <StatCard label="Resolved" value={counts.resolved} accent="emerald" icon={<Bug className="h-5 w-5" />} />
          {/*
            The share of everything reported that is no longer outstanding. `unresolved`
            is what the server counts as still needing work, so the rate is what is left
            over — which keeps this card agreeing with the three beside it rather than
            re-deriving the same thing from a different sum.
          */}
          <StatCard
            label="Resolved rate"
            value={`${Math.round(((counts.total - counts.unresolved) / counts.total) * 100)}%`}
            accent={counts.unresolved === 0 ? 'emerald' : 'blue'}
            hint={`${counts.total - counts.unresolved} of ${counts.total} closed out`}
            icon={<AlertOctagon className="h-5 w-5" />}
          />
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
                onClick={() => changeView('board')}
                className={`segmented-item inline-flex items-center gap-1.5 ${view === 'board' ? 'segmented-item-active' : ''}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => changeView('list')}
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search tickets, key or reporter" className="lg:w-72" />
        </div>

        <div className="filter-bar grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="tf-project">Project</label>
            <Select id="tf-project" value={projectId} onChange={(v) => setProjectId(v)} options={[{ value: '', label: `All projects` }, ...projects.map((p) => ({ value: String(p.id), label: `${p.project_key} · ${p.name}` }))]} />
          </div>
          <div>
            <label className="label" htmlFor="tf-reporter">Reported by</label>
            <Select id="tf-reporter" value={reporterId} onChange={(v) => setReporterId(v)} options={[{ value: '', label: `Everyone` }, ...members.map((m) => ({ value: String(m.id), label: `${m.name}` }))]} />
          </div>
          <div>
            <label className="label" htmlFor="tf-severity">Severity</label>
            <Select id="tf-severity" value={severity} onChange={(v) => setSeverity(v)} options={[{ value: '', label: `Any severity` }, { value: 'critical', label: `Critical` }, { value: 'high', label: `High` }, { value: 'medium', label: `Medium` }, { value: 'low', label: `Low` }]} />
          </div>
          <div>
            <label className="label" htmlFor="tf-sort">Sort</label>
            <Select id="tf-sort" value={sort} onChange={(v) => setSort(v)} options={[{ value: 'severity_desc', label: `Most severe first` }, { value: 'status_asc', label: `By status` }, { value: 'created_desc', label: `Newest first` }, { value: 'created_asc', label: `Oldest first` }]} />
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Loading tickets" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={<Bug className="h-6 w-6" />}
            title={hasFilters ? 'No tickets match these filters' : 'No open tickets'}
            description={
              hasFilters
                ? 'Try another project, a different reporter, or clear the search.'
                : 'Nothing is currently blocking the team. Bugs raised by team members appear here.'
            }
            action={hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch(''); setProjectId(''); setReporterId(''); setSeverity('');
                  setStatus(view === 'board' ? '' : 'unresolved');
                }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            )}
          />
        ) : (
          <>
            <p className="px-4 py-2 text-xs text-muted-foreground">
              {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
              {view === 'board' && ' · drag a card to another column to change its status'}
            </p>
            {view === 'board' ? (
              <TicketBoard
                tickets={tickets}
                allowedStatuses={MANAGER_STATUSES}
                onMove={changeStatus}
                onDelete={setConfirmDelete}
                busyId={updatingId}
              />
            ) : (
              <TicketList
                tickets={tickets}
                highlightId={highlightId}
                updatingId={updatingId}
                allowedStatuses={MANAGER_STATUSES}
                onStatusChange={changeStatus}
                onDelete={setConfirmDelete}
                linkReporter
              />
            )}
          </>
        )}
      </div>

      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title={resolving ? `Resolve ${resolving.ticket_key}` : 'Resolve ticket'}
        description="Tell the reporter what was done. They'll be notified."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setResolving(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={confirmResolve} disabled={savingResolution} className="btn-primary">
              {savingResolution ? 'Saving…' : 'Mark resolved'}
            </button>
          </div>
        )}
      >
        {resolving && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-3.5">
              <p className="font-medium text-foreground">{resolving.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Raised by {resolving.reporter_name} on {resolving.task_key ?? 'a deleted task'}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="resolution">What was done?</label>
              <textarea
                id="resolution"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. Fixed the encoding on the staging table and re-ran the import."
                className="input resize-y"
              />
              <p className="hint">Optional, but it saves the next person asking.</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this ticket?"
        description="This removes the bug report for everyone. It cannot be undone."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={remove} disabled={deleting} className="btn-danger">
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete ticket'}
            </button>
          </div>
        )}
      >
        {confirmDelete && (
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="font-semibold text-foreground">
              <span className="mr-2 font-mono text-xs text-muted-foreground">{confirmDelete.ticket_key}</span>
              {confirmDelete.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Raised by {confirmDelete.reporter_name}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
