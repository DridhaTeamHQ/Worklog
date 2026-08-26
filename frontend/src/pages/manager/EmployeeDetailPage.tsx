import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardPlus, FileText, ClipboardList, Mail, Building2, Phone,
  CheckCircle2, Search, AlertTriangle, Clock, Loader2,
} from 'lucide-react';
import { taskApi, teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { TaskTable } from '../../components/TaskTable';
import { Avatar, EmptyState, ErrorState, PageLoader, SearchInput, StatCard } from '../../components/ui';
import { formatDate, formatTime, reportLines, todayIso, STATUS_LABEL } from '../../lib/format';
import type { DailyReport, Task, TaskStatus, TeamMemberDetail } from '../../types';

type RangeKey = 'all' | 'today' | 'week' | 'month' | 'custom';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

export function EmployeeDetailPage() {
  const toast = useToast();
  const { id } = useParams();
  const employeeId = Number(id);

  const [employee, setEmployee] = useState<TeamMemberDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [tab, setTab] = useState<'reports' | 'tasks'>('reports');

  const [range, setRange] = useState<RangeKey>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await teamApi.detail(employeeId);
      setEmployee(data.employee);
      setTasks(data.tasks);
      setReports(data.reports);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this team member.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (Number.isInteger(employeeId) && employeeId > 0) void load();
    else { setError('Invalid employee.'); setLoading(false); }
  }, [employeeId, load]);

  // Reports are re-fetched server-side whenever a filter changes, so date filtering
  // and text search work across the employee's whole history, not just what is loaded.
  const loadReports = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(employeeId) || employeeId <= 0) return;
    setReportsLoading(true);
    try {
      const { data } = await teamApi.reports(employeeId, {
        range: range === 'all' ? undefined : range,
        from: range === 'custom' ? from || undefined : undefined,
        to: range === 'custom' ? to || undefined : undefined,
        search: search || undefined,
        limit: 100,
      }, signal);
      setReports(data);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof ApiError ? err.message : 'Could not load reports.');
      }
    } finally {
      setReportsLoading(false);
    }
  }, [employeeId, range, from, to, search]);

  useEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadReports(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadReports, loading, search]);

  const counts = useMemo(() => employee?.counts ?? { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 }, [employee]);

  /** Managers can nudge a status from here too, e.g. reopening work sent back for fixes. */
  const changeStatus = async (task: Task, next: TaskStatus) => {
    if (next === task.status) return;
    setUpdatingId(task.id);
    try {
      const { data } = await taskApi.updateStatus(task.id, next);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
      toast.success(`${data.task_key ?? data.title} set to ${STATUS_LABEL[next]}.`);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the task status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !employee) return <ErrorState message={error || 'Team member not found.'} onRetry={load} />;

  return (
    <div className="space-y-6">
      <Link to="/manager/team" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to Team Members
      </Link>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={employee.name} src={employee.profile_image} size="xl" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{employee.name}</h1>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-ink-600">
                  <Mail className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  <dt className="sr-only">Email</dt>
                  <dd className="truncate">{employee.email}</dd>
                </div>
                <div className="flex items-center gap-2 text-ink-600">
                  <Building2 className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  <dt className="sr-only">Department</dt>
                  <dd>{employee.department || 'No department'}{employee.job_title ? ` · ${employee.job_title}` : ''}</dd>
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-2 text-ink-600">
                    <Phone className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    <dt className="sr-only">Phone</dt>
                    <dd>{employee.phone}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <button type="button" onClick={() => setAssignOpen(true)} className="btn-primary shrink-0">
            <ClipboardPlus className="h-4 w-4" /> Assign Task
          </button>
        </div>
      </section>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={counts.pending} accent="amber" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="In Progress" value={counts.in_progress} accent="blue" icon={<Loader2 className="h-5 w-5" />} />
        <StatCard label="Completed" value={counts.completed} accent="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Overdue" value={counts.overdue} accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      {/* The two cards the brief asks for, as tabs so neither is buried below the fold. */}
      <div className="card">
        <div className="border-b border-ink-200 px-4 pt-4">
          <div className="flex gap-1" role="tablist" aria-label="Employee sections">
            {([
              { key: 'reports' as const, label: 'Tasks Done', icon: <FileText className="h-4 w-4" />, count: employee.report_count },
              { key: 'tasks' as const, label: 'Assigned Tasks', icon: <ClipboardList className="h-4 w-4" />, count: counts.total },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-ink-500 hover:text-ink-800'
                }`}
              >
                {t.icon}
                {t.label}
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[11px] tabular-nums text-ink-600">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 'reports' ? (
          <div>
            <div className="flex flex-col gap-3 border-b border-ink-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="table-wrap sm:overflow-visible">
                <div className="flex min-w-max gap-1 rounded-lg bg-ink-100 p-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRange(r.value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        range === r.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search these reports" className="lg:w-72" />
            </div>

            {range === 'custom' && (
              <div className="flex flex-wrap items-end gap-3 border-b border-ink-200 bg-ink-50 p-4">
                <div>
                  <label className="label" htmlFor="r-from">From</label>
                  <input id="r-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="r-to">To</label>
                  <input id="r-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input" />
                </div>
              </div>
            )}

            {reportsLoading ? (
              <div className="p-6"><div className="skeleton h-24 w-full" /></div>
            ) : reports.length === 0 ? (
              <EmptyState
                icon={search ? <Search className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                title={search || range !== 'all' ? 'No reports in this range' : `${employee.name} hasn't submitted any reports yet.`}
                description={
                  search || range !== 'all'
                    ? 'Try a wider date range or a different search term.'
                    : 'Daily work reports will appear here as soon as they are submitted.'
                }
                action={(search || range !== 'all') && (
                  <button type="button" onClick={() => { setSearch(''); setRange('all'); }} className="btn-secondary">
                    Clear filters
                  </button>
                )}
              />
            ) : (
              <ol className="divide-y divide-ink-100">
                {reports.map((report) => (
                  <li key={report.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-ink-900">{formatDate(report.report_date)}</h3>
                      <p className="text-xs text-ink-400">
                        Submitted {formatTime(report.created_at)}
                        {report.updated_at !== report.created_at && ` · last updated ${formatTime(report.updated_at)}`}
                      </p>
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Completed tasks</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {reportLines(report.task_description).map((line, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                          <span className="min-w-0">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div>
            {tasks.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title={`${employee.name} has no assigned tasks.`}
                description="Use Assign Task above to give them something to work on."
                action={<button type="button" onClick={() => setAssignOpen(true)} className="btn-primary"><ClipboardPlus className="h-4 w-4" /> Assign Task</button>}
              />
            ) : (
              <TaskTable
                tasks={tasks}
                updatingId={updatingId}
                onStatusChange={changeStatus}
                showAssignee={false}
              />
            )}
          </div>
        )}
      </div>

      <AssignTaskModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        employee={{ id: employee.id, name: employee.name }}
        onAssigned={(task) => {
          // Show it immediately without waiting for a refetch.
          setTasks((prev) => [task, ...prev]);
          setEmployee((prev) => prev && {
            ...prev,
            counts: { ...prev.counts, total: prev.counts.total + 1, pending: prev.counts.pending + 1 },
          });
          setTab('tasks');
        }}
      />
    </div>
  );
}
