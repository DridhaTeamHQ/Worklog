import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, ClipboardCheck, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, Bug,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { dashboardApi, taskApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Avatar, EmptyState, ErrorState, PageLoader, StatCard } from '../../components/ui';
import { TaskBoard } from '../../components/TaskBoard';
import { TimelineStrip } from '../../components/TimelineStrip';
import { formatDate, formatDateShort, reportLines } from '../../lib/format';
import { CHART, STATUS_COLORS, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from '../../lib/chart';
import type { ManagerDashboard as ManagerDashboardData, Task, TaskStatus } from '../../types';

/*
  Drawn at rest, for the same reason as the analytics charts: the library only paints
  a series as its entry animation advances, and that animation stops when the tab is
  not being given frames — leaving a dashboard opened in a background tab showing an
  empty grid.
*/
const STILL = { isAnimationActive: false } as const;

export function ManagerDashboard() {
  const navigate = useNavigate();
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

  const { summary, activity, recent_tasks: tasks, recent_reports: reports } = data;

  const chartData = activity.map((point) => ({
    ...point,
    label: formatDateShort(point.day).replace(/,.*/, ''),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-title text-2xl text-foreground sm:text-4xl">Dashboard overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Team Members" value={summary.total_team_members} accent="brand" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Assigned Today" value={summary.tasks_assigned_today} accent="blush" icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Completed Today" value={summary.tasks_completed_today} accent="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Pending Tasks" value={summary.pending_tasks} accent="amber" icon={<Clock className="h-5 w-5" />} />
        {/*
          Tickets take the fifth slot, and the card is the whole of their presence on
          this page now — so it is a button through to the list, and it says how many
          are critical, which is the part that decides whether the number is urgent.
        */}
        <StatCard
          label="Open Tickets"
          value={summary.open_tickets}
          accent="red"
          icon={<Bug className="h-5 w-5" />}
          hint={summary.critical_tickets > 0
            ? `${summary.critical_tickets} critical`
            : undefined}
          onClick={() => navigate('/manager/tickets')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`card p-5 ${summary.overdue_tasks > 0 ? 'border-destructive/25 bg-destructive/5' : ''}`}>
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              summary.overdue_tasks > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
            }`}
            >
              {summary.overdue_tasks > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className={`font-semibold ${summary.overdue_tasks > 0 ? 'text-foreground' : 'text-foreground'}`}>
                {summary.overdue_tasks > 0
                  ? `${summary.overdue_tasks} overdue task${summary.overdue_tasks === 1 ? '' : 's'}`
                  : 'Nothing overdue'}
              </p>
              <p className={`mt-0.5 text-sm ${summary.overdue_tasks > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {summary.overdue_tasks > 0
                  ? 'These are past their deadline and not yet complete.'
                  : 'Every open task is still within its deadline.'}
              </p>
              {summary.overdue_tasks > 0 && (
                <Link to="/manager/tasks?status=overdue" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-destructive hover:underline">
                  Review them <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {summary.reports_submitted_today} of {summary.total_team_members} reports submitted today
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {summary.reports_pending_today === 0
                  ? 'Everyone has logged their day.'
                  : `${summary.reports_pending_today} still to come.`}
              </p>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
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


      <section className="card p-5">
        <h2 className="font-semibold text-foreground">Activity — last 14 days</h2>
        <p className="text-xs text-muted-foreground">Tasks assigned and completed, plus daily reports submitted.</p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gAssigned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={STATUS_COLORS.completed} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={STATUS_COLORS.completed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ stroke: CHART.axis, strokeOpacity: 0.4 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="assigned" name="Assigned" stroke={CHART.primary} strokeWidth={2} fill="url(#gAssigned)" {...STILL} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke={STATUS_COLORS.completed} strokeWidth={2} fill="url(#gCompleted)" {...STILL} />
              <Area type="monotone" dataKey="reports" name="Reports" stroke={CHART.neutralSoft} strokeWidth={2} fillOpacity={0} {...STILL} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <TimelineStrip
        tasks={tasks}
        taskHref={(task) => `/manager/tasks?highlight=${task.id}`}
      />

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Recently assigned</h2>
            <p className="text-xs text-muted-foreground">
              Drag a card to another column to change its status, or focus one and press
              Ctrl and an arrow key.
            </p>
          </div>
          <Link to="/manager/tasks" className="text-sm font-semibold text-primary-strong hover:text-primary-strong">View all</Link>
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
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">Latest task reports</h2>
          <Link to="/manager/reports" className="text-sm font-semibold text-primary-strong hover:text-primary-strong">View all</Link>
        </header>
        {reports.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No reports submitted yet" description="Daily reports from your team will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <li key={report.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={report.employee_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{report.employee_name}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatDateShort(report.report_date)}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
