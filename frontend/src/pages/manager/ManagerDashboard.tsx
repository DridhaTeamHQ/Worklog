import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ClipboardCheck, CheckCircle2, Clock, Loader2, AlertTriangle, FileText, ArrowRight, Bug,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { dashboardApi, taskApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Avatar, EmptyState, ErrorState, PageLoader, StatCard } from '../../components/ui';
import { SeverityBadge } from '../../components/Badges';
import { TaskBoard } from '../../components/TaskBoard';
import { TimelineStrip } from '../../components/TimelineStrip';
import { formatDate, formatDateShort, reportLines } from '../../lib/format';
import type { ManagerDashboard as ManagerDashboardData, Task, TaskStatus } from '../../types';

export function ManagerDashboard() {
  const toast = useToast();
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  /** The card waiting on a status change, so the board can show it as busy. */
  const [movingId, setMovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardApi.load();
      setData(res.data as ManagerDashboardData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * A card dropped in another column. The board is updated straight away and the
   * summary is reloaded afterwards, since moving a task changes the counts above it.
   */
  const moveTask = async (task: Task, next: TaskStatus) => {
    if (next === task.status) return;
    setMovingId(task.id);
    try {
      const { data: updated } = await taskApi.updateStatus(task.id, next);
      setData((prev) => (prev ? {
        ...prev,
        recent_tasks: prev.recent_tasks.map((t) => (t.id === task.id ? updated : t)),
      } : prev));
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not move the task.');
    } finally {
      setMovingId(null);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error || 'No data available.'} onRetry={load} />;

  const { summary, activity, recent_tasks: tasks, recent_reports: reports, open_tickets: tickets } = data;

  const chartData = activity.map((point) => ({
    ...point,
    label: formatDateShort(point.day).replace(/,.*/, ''),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white drop-shadow-sm sm:text-2xl">Dashboard overview</h1>
        <p className="mt-1 text-sm text-white/85">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Team Members" value={summary.total_team_members} accent="brand" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Assigned Today" value={summary.tasks_assigned_today} accent="blush" icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Completed Today" value={summary.tasks_completed_today} accent="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Pending Tasks" value={summary.pending_tasks} accent="amber" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="In Progress" value={summary.in_progress_tasks} accent="blue" icon={<Loader2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`card p-5 ${summary.overdue_tasks > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              summary.overdue_tasks > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}
            >
              {summary.overdue_tasks > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className={`font-semibold ${summary.overdue_tasks > 0 ? 'text-red-900' : 'text-ink-900'}`}>
                {summary.overdue_tasks > 0
                  ? `${summary.overdue_tasks} overdue task${summary.overdue_tasks === 1 ? '' : 's'}`
                  : 'Nothing overdue'}
              </p>
              <p className={`mt-0.5 text-sm ${summary.overdue_tasks > 0 ? 'text-red-800' : 'text-ink-500'}`}>
                {summary.overdue_tasks > 0
                  ? 'These are past their deadline and not yet complete.'
                  : 'Every open task is still within its deadline.'}
              </p>
              {summary.overdue_tasks > 0 && (
                <Link to="/manager/tasks?status=overdue" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-red-700 hover:text-red-800">
                  Review them <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink-900">
                {summary.reports_submitted_today} of {summary.total_team_members} reports submitted today
              </p>
              <p className="mt-0.5 text-sm text-ink-500">
                {summary.reports_pending_today === 0
                  ? 'Everyone has logged their day.'
                  : `${summary.reports_pending_today} still to come.`}
              </p>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{
                    width: `${summary.total_team_members
                      ? Math.round((summary.reports_submitted_today / summary.total_team_members) * 100)
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {summary.open_tickets > 0 && (
        <section className="card">
          <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Bug className="h-5 w-5 text-red-600" aria-hidden />
              <h2 className="font-semibold text-ink-900">
                {summary.open_tickets} open ticket{summary.open_tickets === 1 ? '' : 's'}
                {summary.critical_tickets > 0 && (
                  <span className="ml-2 font-normal text-red-600">
                    · {summary.critical_tickets} critical
                  </span>
                )}
              </h2>
            </div>
            <Link to="/manager/tickets" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </header>
          <ul className="divide-y divide-ink-100">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={ticket.reporter_name} src={ticket.reporter_profile_image} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    <span className="mr-1.5 font-mono text-xs text-brand-700">{ticket.ticket_key}</span>
                    {ticket.title}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {ticket.reporter_name} · {ticket.project_name}
                    {ticket.task_key && ` · on ${ticket.task_key}`}
                  </p>
                </div>
                <SeverityBadge severity={ticket.severity} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold text-ink-900">Activity — last 14 days</h2>
        <p className="text-xs text-ink-500">Tasks assigned and completed, plus daily reports submitted.</p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gAssigned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#808cfa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#808cfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8a71bb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8a71bb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6a6a88' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#6a6a88' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e4e4f0', fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: '#191924' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="assigned" name="Assigned" stroke="#808cfa" strokeWidth={2} fill="url(#gAssigned)" />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#8a71bb" strokeWidth={2} fill="url(#gCompleted)" />
              <Area type="monotone" dataKey="reports" name="Reports" stroke="#d488ae" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <TimelineStrip
        tasks={tasks}
        taskHref={(task) => `/manager/tasks?highlight=${task.id}`}
      />

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink-900">Recently assigned</h2>
            <p className="text-xs text-ink-500">
              Drag a card to another column to change its status, or focus one and press
              Ctrl and an arrow key.
            </p>
          </div>
          <Link to="/manager/tasks" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
        </header>
        {tasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="No tasks assigned yet"
            description="Assign work from a team member's page to get started."
          />
        ) : (
          <TaskBoard
            tasks={tasks}
            onMove={moveTask}
            busyId={movingId}
            taskHref={(task) => `/manager/tasks?highlight=${task.id}`}
          />
        )}
      </section>

      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Latest task reports</h2>
          <Link to="/manager/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all</Link>
        </header>
        {reports.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No reports submitted yet" description="Daily reports from your team will appear here." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {reports.map((report) => (
              <li key={report.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={report.employee_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink-900">{report.employee_name}</p>
                    <p className="shrink-0 text-xs text-ink-400">{formatDateShort(report.report_date)}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {reportLines(report.task_description).slice(0, 2).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
