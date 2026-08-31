import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckSquare, Clock, AlertTriangle, ArrowRight, CalendarCheck,
  FileText, Loader2, PenLine, Bug,
} from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState, PageLoader, StatCard } from '../../components/ui';
import { TimelineStrip } from '../../components/TimelineStrip';
import { formatDate, formatTime, reportLines } from '../../lib/format';
import type { EmployeeDashboard as EmployeeDashboardData } from '../../types';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardApi.load();
      setData(res.data as EmployeeDashboardData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'No data available.'} onRetry={load} />;

  const { summary, upcoming_tasks: tasks, recent_reports: reports, today_report: todayReport } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white drop-shadow-sm sm:text-2xl">
          Welcome, {user?.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-white/85">
          {formatDate(new Date().toISOString())} · Here's where your work stands today.
        </p>
      </div>

      {/* The two large cards the portal is built around. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/employee/tasks-done')}
          className="card card-hover group p-6 text-left"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckSquare className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-600" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-bold text-ink-900">Tasks Done</h2>
          <p className="mt-1 text-sm text-ink-500">Write up what you completed today.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {summary.submitted_today ? (
              <span className="badge border-emerald-200 bg-emerald-50 text-emerald-700">
                <CalendarCheck className="h-3 w-3" aria-hidden /> Submitted today
              </span>
            ) : (
              <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                <Clock className="h-3 w-3" aria-hidden /> Not submitted yet
              </span>
            )}
            <span className="text-xs text-ink-500">
              {summary.total_reports} report{summary.total_reports === 1 ? '' : 's'} submitted overall
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/employee/tasks-assigned')}
          className="card card-hover group p-6 text-left"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ClipboardList className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-600" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-bold text-ink-900">Tasks Assigned</h2>
          <p className="mt-1 text-sm text-ink-500">Everything your manager has assigned to you.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-ink-900">{summary.total_tasks}</span>
            <span className="text-xs text-ink-500">
              {summary.pending_tasks} pending · {summary.in_progress_tasks} in progress
            </span>
            {summary.overdue_tasks > 0 && (
              <span className="badge border-red-200 bg-red-50 text-red-700">
                <AlertTriangle className="h-3 w-3" aria-hidden /> {summary.overdue_tasks} overdue
              </span>
            )}
          </div>
        </button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={summary.pending_tasks} accent="amber" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="In Progress" value={summary.in_progress_tasks} accent="blue" icon={<Loader2 className="h-5 w-5" />} />
        <StatCard label="Completed" value={summary.completed_tasks} accent="emerald" icon={<CheckSquare className="h-5 w-5" />} hint={`${summary.completed_today} today`} />
        <StatCard label="Overdue" value={summary.overdue_tasks} accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Link
        to="/employee/tickets"
        className="card card-hover flex items-center gap-3 p-4 sm:p-5"
      >
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          summary.open_tickets > 0 ? 'bg-red-50 text-red-600' : 'bg-ink-100 text-ink-500'
        }`}
        >
          <Bug className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">
            {summary.open_tickets > 0
              ? `${summary.open_tickets} open ticket${summary.open_tickets === 1 ? '' : 's'}`
              : 'No open tickets'}
          </p>
          <p className="mt-0.5 text-sm text-ink-500">
            {summary.total_tickets > 0
              ? `You have raised ${summary.total_tickets} in total.`
              : 'Hit a bug while working on a task? Raise a ticket so your manager knows.'}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-ink-300" aria-hidden />
      </Link>

      {!summary.submitted_today && (
        <div className="card flex flex-col gap-3 border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="font-semibold text-amber-900">You haven't submitted your task report for today.</p>
              <p className="mt-0.5 text-sm text-amber-800">Take a minute to log what you got done.</p>
            </div>
          </div>
          <Link to="/employee/tasks-done" className="btn-primary shrink-0">
            <PenLine className="h-4 w-4" /> Write today's report
          </Link>
        </div>
      )}

      <TimelineStrip
        tasks={tasks}
        taskHref={(task) => `/employee/tasks-assigned?highlight=${task.id}`}
      />


      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Recent task reports</h2>
          <Link to="/employee/tasks-done" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </header>
        {reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No reports yet"
            description="Your daily task reports will be listed here once you submit one."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {reports.map((report) => (
              <li key={report.id} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-ink-900">{formatDate(report.report_date)}</p>
                  <p className="shrink-0 text-xs text-ink-400">{formatTime(report.created_at)}</p>
                </div>
                <ul className="mt-2 space-y-1">
                  {reportLines(report.task_description).slice(0, 3).map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                  {reportLines(report.task_description).length > 3 && (
                    <li className="pl-3.5 text-xs text-ink-400">
                      +{reportLines(report.task_description).length - 3} more
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>


      {todayReport && (
        <p className="text-center text-xs text-white/75">
          Today's report last updated {formatTime(todayReport.updated_at)}
        </p>
      )}
    </div>
  );
}
