import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  BarChart3, CheckCircle2, CalendarDays, TrendingUp, Clock, Plus,
  Search, FileText, CheckSquare, Sparkles, Filter,
} from 'lucide-react';
import { taskApi, reportApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState, PageLoader, SearchInput } from '../../components/ui';
import { formatDate, formatDateShort, formatWeekday, formatTime, todayIso, addDaysIso, reportLines } from '../../lib/format';
import type { Task, DailyReport } from '../../types';

export type TimeRange = '7days' | '15days' | '30days' | '6months' | '1year' | 'overall';

const RANGE_OPTIONS: { key: TimeRange; label: string; days?: number }[] = [
  { key: '7days', label: '7 Days', days: 7 },
  { key: '15days', label: '15 Days', days: 15 },
  { key: '30days', label: '30 Days', days: 30 },
  { key: '6months', label: '6 Months', days: 180 },
  { key: '1year', label: '1 Year', days: 365 },
  { key: 'overall', label: 'Overall' },
];

export function EmployeeAnalyticsPage() {
  const { user } = useAuth();
  const today = todayIso();

  const [range, setRange] = useState<TimeRange>('30days');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, reportsRes] = await Promise.all([
        taskApi.list({ limit: 1000, sort: 'created_desc' }),
        reportApi.list({ limit: 1000 }),
      ]);
      setTasks(tasksRes.data);
      setReports(reportsRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your work analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Calculate start date based on selected timeframe
  const startDate = useMemo(() => {
    const selected = RANGE_OPTIONS.find((r) => r.key === range);
    if (!selected?.days) return null; // overall = no start boundary
    return addDaysIso(today, -(selected.days - 1));
  }, [range, today]);

  // Filter tasks in range
  const filteredTasks = useMemo(() => {
    if (!startDate) return tasks;
    return tasks.filter((t) => {
      const dateToCheck = t.completed_at ? t.completed_at.slice(0, 10) : t.created_at.slice(0, 10);
      return dateToCheck >= startDate && dateToCheck <= today;
    });
  }, [tasks, startDate, today]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'completed');
  }, [filteredTasks]);

  // Filter reports in range
  const filteredReports = useMemo(() => {
    if (!startDate) return reports;
    return reports.filter((r) => r.report_date >= startDate && r.report_date <= today);
  }, [reports, startDate, today]);

  // Metrics
  const totalCompleted = completedTasks.length;
  const totalAssigned = filteredTasks.length;
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const totalReportsCount = filteredReports.length;

  // Active work days: Set of unique dates where tasks were completed or reports submitted
  const activeDaysSet = useMemo(() => {
    const dates = new Set<string>();
    filteredReports.forEach((r) => dates.add(r.report_date));
    completedTasks.forEach((t) => {
      if (t.completed_at) dates.add(t.completed_at.slice(0, 10));
    });
    return dates;
  }, [filteredReports, completedTasks]);

  // Day-by-Day grouped history ("kis din kya kiya")
  const dailyHistory = useMemo(() => {
    // Map of date -> { report?: DailyReport, tasks: Task[] }
    const map = new Map<string, { date: string; report?: DailyReport; completedTasks: Task[] }>();

    filteredReports.forEach((r) => {
      const existing = map.get(r.report_date) || { date: r.report_date, completedTasks: [] };
      existing.report = r;
      map.set(r.report_date, existing);
    });

    completedTasks.forEach((t) => {
      const d = t.completed_at ? t.completed_at.slice(0, 10) : today;
      const existing = map.get(d) || { date: d, completedTasks: [] };
      existing.completedTasks.push(t);
      map.set(d, existing);
    });

    const list = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));

    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      const dateStr = formatDate(item.date).toLowerCase();
      const reportMatch = item.report?.task_description.toLowerCase().includes(q);
      const taskMatch = item.completedTasks.some(
        (t) => t.title.toLowerCase().includes(q) || (t.task_key && t.task_key.toLowerCase().includes(q))
      );
      return dateStr.includes(q) || reportMatch || taskMatch;
    });
  }, [filteredReports, completedTasks, search, today]);

  // Chart data: daily counts for 7d, 15d, 30d, or monthly aggregation for 6m, 1y, overall
  const chartData = useMemo(() => {
    if (range === '6months' || range === '1year' || range === 'overall') {
      // Monthly aggregation
      const monthsMap = new Map<string, { label: string; tasksDone: number; reports: number }>();
      completedTasks.forEach((t) => {
        const m = (t.completed_at || t.created_at).slice(0, 7); // YYYY-MM
        const curr = monthsMap.get(m) || { label: m, tasksDone: 0, reports: 0 };
        curr.tasksDone += 1;
        monthsMap.set(m, curr);
      });
      filteredReports.forEach((r) => {
        const m = r.report_date.slice(0, 7);
        const curr = monthsMap.get(m) || { label: m, tasksDone: 0, reports: 0 };
        curr.reports += 1;
        monthsMap.set(m, curr);
      });
      return Array.from(monthsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([m, data]) => {
          const d = new Date(`${m}-01T00:00:00`);
          const monthLabel = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          return { name: monthLabel, 'Tasks Done': data.tasksDone, 'Work Reports': data.reports };
        });
    }

    // Daily breakdown for 7d, 15d, 30d
    const numDays = range === '7days' ? 7 : range === '15days' ? 15 : 30;
    const daysArr: { name: string; 'Tasks Done': number; 'Work Reports': number }[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const dIso = addDaysIso(today, -i);
      const dayTasks = completedTasks.filter((t) => (t.completed_at ? t.completed_at.slice(0, 10) === dIso : false)).length;
      const dayReports = filteredReports.filter((r) => r.report_date === dIso).length;
      daysArr.push({
        name: numDays <= 7 ? formatWeekday(`${dIso}T00:00:00`) : formatDateShort(dIso),
        'Tasks Done': dayTasks,
        'Work Reports': dayReports,
      });
    }
    return daysArr;
  }, [range, completedTasks, filteredReports, today]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-7">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <BarChart3 className="h-7 w-7 text-primary" />
            Work Analytics & History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track daily work completed, task completion history, and work reports.
          </p>
        </div>
        <Link
          to="/employee/tasks-done"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Log Today's Work
        </Link>
      </div>

      {/* Timeframe Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="mr-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Period:
        </span>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRange(opt.key)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              range === opt.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Tasks Completed */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tasks Done</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{totalCompleted}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            out of {totalAssigned} assigned tasks
          </p>
        </div>

        {/* Work Reports */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Daily Reports</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{totalReportsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            days work was logged
          </p>
        </div>

        {/* Completion Rate */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completion Rate</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{completionRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            productivity score
          </p>
        </div>

        {/* Active Days */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Workdays</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-500">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{activeDaysSet.size}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            distinct active days
          </p>
        </div>
      </div>

      {/* Activity Chart */}
      {chartData.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">Activity Trend</h2>
              <p className="text-xs text-muted-foreground">Completed tasks and logged daily reports over {RANGE_OPTIONS.find((r) => r.key === range)?.label}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span className="text-muted-foreground">Tasks Done</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                <span className="text-muted-foreground">Work Reports</span>
              </span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#888888" tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#888888" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(23, 23, 23, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Tasks Done" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Work Reports" fill="#f4553c" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Day-by-Day Work History ("kis din kya kiya") */}
      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground text-base">Day-by-Day Work History</h2>
            <p className="text-xs text-muted-foreground">
              {dailyHistory.length} day{dailyHistory.length === 1 ? '' : 's'} with recorded activity in this period
            </p>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search work or task name..."
            className="sm:w-64"
          />
        </header>

        {dailyHistory.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title={search ? 'No matching work records' : 'No activity in this period'}
            description={
              search
                ? `No reports or tasks match "${search}". Try another search term.`
                : 'Start logging your daily work or completing tasks to build your activity history.'
            }
            action={
              search ? (
                <button type="button" onClick={() => setSearch('')} className="btn-secondary">
                  Clear Search
                </button>
              ) : (
                <Link to="/employee/tasks-done" className="btn-primary">
                  Log Today's Work
                </Link>
              )
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {dailyHistory.map((item) => {
              const isToday = item.date === today;
              return (
                <div key={item.date} className="p-5 hover:bg-muted/20 transition-colors">
                  {/* Date Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-base">
                        {formatDate(item.date)}
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.completedTasks.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {item.completedTasks.length} task{item.completedTasks.length === 1 ? '' : 's'} done
                        </span>
                      )}
                      {item.report && (
                        <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Report submitted {formatTime(item.report.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tasks completed on this day */}
                  {item.completedTasks.length > 0 && (
                    <div className="mb-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                        <CheckSquare className="h-4 w-4" /> Completed Assigned Tasks:
                      </p>
                      <ul className="space-y-1.5">
                        {item.completedTasks.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-foreground flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              {t.task_key && <span className="font-mono text-muted-foreground">[{t.task_key}]</span>}
                              {t.title}
                            </span>
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
                              {t.priority}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Daily work report summary ("kya kiya") */}
                  {item.report ? (
                    <div className="rounded-xl bg-muted/40 p-3.5 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary" /> Daily Work Log:
                      </p>
                      <ul className="space-y-1.5">
                        {reportLines(item.report.task_description).map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="min-w-0 leading-relaxed">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    !item.completedTasks.length && (
                      <p className="text-xs text-muted-foreground italic">No details logged for this day.</p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
