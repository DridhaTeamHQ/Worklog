import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle, SlidersHorizontal,
} from 'lucide-react';
import { dashboardApi, teamApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState, Spinner, Select } from '../../components/ui';
import { formatDateShort, formatWeekday, todayIso, addDaysIso } from '../../lib/format';
import { useChartTheme } from '../../lib/chart';
import type { AnalyticsPayload, ActivityPoint, TeamMember } from '../../types';
import { isAdmin } from '../../types';

/**
 * The analytics screen.
 *
 * The layout is the one from the reference — the two figures that matter at the top
 * with their change against the previous period, the week's shape as a row of bars
 * with one picked out, then the breakdown, the trend and the table. What has changed
 * is that none of it is carried by colour: every surface is a card, and the primary
 * appears in three places, on the bar you have selected, on the leading chart series,
 * and on the filter button once a filter is on.
 *
 * The colour that is left is colour that means something — a state on a ring segment
 * or a badge, and destructive where a figure is a problem.
 */

/**
 * Every series on this page is drawn at rest.
 *
 * The chart library draws its shapes by animating them in from nothing, and that
 * animation only advances while the tab is being given frames. A page opened in a
 * background tab, or on a machine throttling its rendering, is therefore left with an
 * empty ring and three flat lines until it happens to be looked at — which is exactly
 * when a dashboard is least able to explain itself. The figures are worth more than
 * the entrance.
 */
const STILL = { isAnimationActive: false } as const;

/* ------------------------------------------------------------------- pieces */

/**
 * The change against the previous period: a small pill beside the figure it belongs to.
 *
 * Both figures here are ones where up is good, so the pill reads the sign directly. A
 * measure where down is the improvement — overdue tasks, say — would need to say so
 * rather than inherit this.
 */
function DeltaPill({ value }: { value: number | null }) {
  if (value === null) return null;
  const good = value >= 0;
  const Icon = good ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        good ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {value > 0 ? '+' : ''}{value}%
    </span>
  );
}

/**
 * The week strip.
 *
 * Drawn as plain elements rather than through the chart library. It is seven values
 * with one of them picked out and a label floating above it — a chart component would
 * have to be fought the whole way to that, and the bars have to stay clickable and
 * keyboard-reachable, which is free here and awkward there.
 *
 * The unselected bars are `muted`, which is all they need to be: the point of the
 * strip is the comparison between heights, and the one bar in primary is the one
 * being read.
 */
function WeekBars({ points, selected, onSelect, unit }: {
  points: { label: string; value: number; key: string }[];
  selected: number;
  onSelect: (index: number) => void;
  unit: string;
}) {
  const peak = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="mt-6">
      <div className="flex h-40 items-end gap-1.5 sm:gap-2">
        {points.map((p, i) => {
          const active = i === selected;
          /* A floor, so a day with no activity is still a bar to aim at rather than
             a sliver that cannot be clicked. */
          const height = Math.max(6, Math.round((p.value / peak) * 100));
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={active}
              aria-label={`${p.label}: ${p.value} ${unit}`}
              className="group relative flex h-full flex-1 flex-col justify-end rounded-md"
            >
              {active && (
                <span className="fade-in pointer-events-none absolute inset-x-0 -top-1 z-10 mx-auto w-max rounded-md bg-foreground px-2 py-1 text-[11px] font-medium tabular-nums text-background">
                  {p.value} {unit}
                </span>
              )}
              <span
                style={{ height: `${height}%` }}
                className={`w-full rounded-md transition-all duration-300 ease-out ${
                  active ? 'bg-primary' : 'bg-muted group-hover:bg-border'
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex gap-1.5 sm:gap-2">
        {points.map((p, i) => (
          <span
            key={p.key}
            className={`flex-1 text-center text-xs ${
              i === selected ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

/** Sums a window of the activity series, so a period can be compared with the one before it. */
function windowTotal(points: ActivityPoint[], from: number, to: number, key: 'assigned' | 'completed') {
  return points.slice(from, to).reduce((sum, p) => sum + p[key], 0);
}

/**
 * Percentage change between two totals, rounded to one place.
 *
 * Growth from nothing is not a percentage, so a previous period of zero returns null
 * and the pill is simply not drawn — showing "+100%" there would read as a real
 * measurement of something that was never measured.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function AnalyticsPage() {
  const {
    CHART, STATUS_COLORS, TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE,
  } = useChartTheme();
  const { user } = useAuth();
  /** Only an admin spans more than one department, so only they get the filter. */
  const canSeeAllDepartments = isAdmin(user?.role);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [filtersOpen, setFiltersOpen] = useState(false);
  /**
    Which day the reader has picked out in the week strip, held as the day itself
    rather than as a position. An index would silently point at a different day the
    moment a filter changed the week underneath it.
  */
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  useEffect(() => {
    teamApi.list().then(({ data: d }) => setMembers(d)).catch(() => setMembers([]));
    teamApi.departments().then(({ data: d }) => setDepartments(d)).catch(() => setDepartments([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: payload } = await dashboardApi.analytics({
        employeeId: employeeId ? Number(employeeId) : undefined,
        department: department || undefined,
        from: from || undefined,
        to: to || undefined,
        days: 30,
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, department, from, to]);

  useEffect(() => { void load(); }, [load]);

  const { summary, productivity, breakdown, daily, weekly } = data ?? {
    summary: null, productivity: [], breakdown: null, daily: [], weekly: [],
  };

  /** The last seven days, which is what the strip under the headline figures shows. */
  const week = useMemo(() => daily.slice(-7).map((d) => ({
    key: d.day,
    label: formatWeekday(d.day),
    value: d.assigned,
  })), [daily]);

  /*
    The busiest day is the one worth looking at, so that is where the marker sits until
    the reader moves it — and it follows the data when a filter reshapes the week. A
    pick that no longer matches any day in the week falls back to the peak rather than
    leaving nothing highlighted.
  */
  const selectedDay = useMemo(() => {
    if (week.length === 0) return -1;
    const picked = pickedDay ? week.findIndex((d) => d.key === pickedDay) : -1;
    if (picked >= 0) return picked;
    return week.reduce((peak, d, i) => (d.value > week[peak].value ? i : peak), 0);
  }, [week, pickedDay]);

  /*
    Both headline figures are shown against the fortnight before them: the trailing
    seven days of the series against the seven before that. It is the same comparison
    the reference makes, and it is the only one the series can actually support.
  */
  const deltas = useMemo(() => {
    if (daily.length < 14) return { assigned: null, completed: null };
    const n = daily.length;
    return {
      assigned: percentChange(windowTotal(daily, n - 7, n, 'assigned'), windowTotal(daily, n - 14, n - 7, 'assigned')),
      completed: percentChange(windowTotal(daily, n - 7, n, 'completed'), windowTotal(daily, n - 14, n - 7, 'completed')),
    };
  }, [daily]);

  const pieData = breakdown ? [
    { name: 'Pending', value: breakdown.pending, color: STATUS_COLORS.pending },
    { name: 'In Progress', value: breakdown.in_progress, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: breakdown.completed, color: STATUS_COLORS.completed },
    { name: 'Overdue', value: breakdown.overdue, color: STATUS_COLORS.overdue },
  ].filter((slice) => slice.value > 0) : [];
  const pieTotal = pieData.reduce((sum, slice) => sum + slice.value, 0);

  const trend = view === 'daily'
    ? daily.map((d) => ({ label: formatDateShort(d.day).replace(/,.*/, ''), ...d }))
    : weekly.map((w) => ({ label: `w/c ${formatDateShort(w.week_start).replace(/,.*/, '')}`, ...w }));

  const productivityChart = productivity.map((p) => ({
    ...p,
    // Keep the axis readable when several people share a surname.
    label: p.employee_name.split(' ')[0],
  }));

  const hasTasks = productivity.some((p) => p.assigned > 0);
  const completionRate = summary && summary.total_tasks > 0
    ? Math.round((summary.completed_tasks / summary.total_tasks) * 100)
    : 0;
  /** Whoever is carrying the most overdue work — the card is only worth drawing for them. */
  const mostOverdue = productivity.reduce<typeof productivity[number] | null>(
    (worst, p) => (p.overdue > (worst?.overdue ?? 0) ? p : worst), null,
  );
  const filtersApplied = Boolean(employeeId || department || from || to);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      {/* Title row — the screen name, then the controls that change what it shows. */}
      <header className="flex flex-wrap items-center gap-3">
        <span className="icon-btn" aria-hidden><BarChart3 className="h-5 w-5" /></span>
        <h1 className="display-title text-3xl text-foreground sm:text-4xl">Analytics</h1>

        <div className="ml-auto flex items-center gap-2">
          {/*
            The one control that changes what everything below means, so it is the one
            that takes the primary — and only once a filter is actually on.
          */}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className={filtersApplied ? 'btn-primary' : 'btn-secondary'}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
          <div className="segmented">
            {(['daily', 'weekly'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`segmented-item capitalize ${view === v ? 'segmented-item-active' : ''}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* The filters stay collapsed by default: on the reference this row is two
          controls, and four permanent form fields would be the first thing on the page. */}
      {filtersOpen && (
        <div className="card fade-in grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="a-employee">Employee</label>
            <Select id="a-employee" value={employeeId} onChange={(v) => setEmployeeId(v)} options={[{ value: '', label: `All employees` }, ...members.map((m) => ({ value: String(m.id), label: `${m.name}` }))]} />
          </div>
          {/* A manager spans one department, so there is nothing to choose between;
              the server confines their figures to it regardless. */}
          {canSeeAllDepartments && (
            <div>
              <label className="label" htmlFor="a-dept">Department</label>
              <Select id="a-dept" value={department} onChange={(v) => setDepartment(v)} options={[{ value: '', label: `All departments` }, ...departments.map((d) => ({ value: String(d), label: `${d}` }))]} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="a-from">From</label>
            <input
              id="a-from"
              type="date"
              value={from}
              max={to || todayIso()}
              onChange={(e) => setFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="a-to">To</label>
            <input
              id="a-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="button"
              onClick={() => { setFrom(addDaysIso(todayIso(), -30)); setTo(todayIso()); }}
              className="btn-secondary btn-sm"
            >
              Last 30 days
            </button>
            {filtersApplied && (
              <button
                type="button"
                onClick={() => { setEmployeeId(''); setDepartment(''); setFrom(''); setTo(''); }}
                className="btn-ghost btn-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        The header and filters above stay mounted while this reloads — taking them away
        and putting them back is what made changing one feel like the page had jumped.
        The reserved height keeps the stack from collapsing behind the loader.
      */}
      {loading || !summary ? (
        <div className="card flex min-h-[560px] items-center justify-center" aria-busy="true" aria-live="polite">
          <Spinner className="h-8 w-8 text-muted-foreground" />
          <span className="sr-only">Loading analytics</span>
        </div>
      ) : (
      <div className="fade-in space-y-5">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* ------------------------------------------- the headline figures */}
          <section className="card p-5 sm:p-6 lg:col-span-7">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Total tasks</p>
                  <DeltaPill value={deltas.assigned} />
                </div>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-[-0.03em] text-foreground">
                  {summary.total_tasks.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.tasks_assigned_today} assigned today
                </p>
              </div>
              <div className="sm:border-l sm:border-border sm:pl-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Completion rate</p>
                  <DeltaPill value={deltas.completed} />
                </div>
                <p className="mt-2 text-4xl font-bold tabular-nums tracking-[-0.03em] text-foreground">
                  {completionRate}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.completed_tasks.toLocaleString()} completed, vs. previous week
                </p>
              </div>
            </div>

            {/* The week strip. Assignments per day, with the busiest picked out. */}
            {week.length > 0 && selectedDay >= 0 && (
              <WeekBars points={week} selected={selectedDay} onSelect={(i) => setPickedDay(week[i].key)} unit="tasks" />
            )}
          </section>

          {/* -------------------------------------------- the status breakdown */}
          <section className="card flex flex-col p-5 sm:p-6 lg:col-span-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Status breakdown</h2>
              <p className="mt-1 text-xs text-muted-foreground">Where every task currently stands.</p>
            </div>

            {pieData.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Nothing to chart yet" />
            ) : (
              <>
                <div className="relative mt-4 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="66%"
                        outerRadius="92%"
                        paddingAngle={2}
                        stroke="none"
                        {...STILL}
                      >
                        {pieData.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* The total sits in the hole rather than in a caption, which is
                      what makes the ring read as a share of something. */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums tracking-[-0.02em] text-foreground">{pieTotal}</span>
                    <span className="text-xs text-muted-foreground">tasks</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {pieData.map((slice) => (
                    <li key={slice.name} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden />
                      <span className="flex-1 text-muted-foreground">{slice.name}</span>
                      <span className="font-medium tabular-nums text-foreground">{slice.value}</span>
                      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round((slice.value / pieTotal) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {/* --------------------------------------------- activity, and overdue */}
        <div className="grid gap-5 lg:grid-cols-12">
          <section className="card p-5 sm:p-6 lg:col-span-8">
            <div>
              <h2 className="text-base font-semibold text-foreground">Activity over time</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {view === 'daily' ? 'Last 30 days' : 'Last 8 weeks'} — assignments, completions and reports.
              </p>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
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
                  {/* Assignments are what the chart is about; the other two are context. */}
                  <Line type="monotone" dataKey="assigned" name="Assigned" stroke={CHART.primary} strokeWidth={2} dot={false} {...STILL} />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke={STATUS_COLORS.completed} strokeWidth={2} dot={false} {...STILL} />
                  <Line type="monotone" dataKey="reports" name="Reports" stroke={CHART.neutralSoft} strokeWidth={2} dot={false} {...STILL} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Overdue gets its own card rather than a row in a table: it is the one
              figure on this page that is a call to do something, and so the one place
              destructive is warranted. */}
          <section className="card flex flex-col p-5 sm:p-6 lg:col-span-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">Needs attention</p>
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                  summary.overdue_tasks > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}
                aria-hidden
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3">
              <p className={`text-4xl font-bold tabular-nums tracking-[-0.03em] ${
                summary.overdue_tasks > 0 ? 'text-destructive' : 'text-foreground'
              }`}
              >
                {summary.overdue_tasks}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.overdue_tasks === 1 ? 'task is overdue' : 'tasks are overdue'}
              </p>
            </div>
            <div className="mt-5 rounded-lg border border-border bg-muted/50 px-4 py-3">
              {mostOverdue && mostOverdue.overdue > 0 ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Most affected</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{mostOverdue.employee_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {mostOverdue.overdue} of {mostOverdue.assigned} assigned
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-foreground">Nothing is running late.</p>
              )}
            </div>
            <p className="mt-auto pt-4 text-xs text-muted-foreground">
              {summary.pending_tasks + summary.in_progress_tasks} still open · {summary.reports_pending_today} reports outstanding today
            </p>
          </section>
        </div>

        {/* ------------------------------------------------------ productivity */}
        <section className="card p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Employee productivity</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tasks assigned against tasks completed, per person.</p>
          </div>
          {!hasTasks ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No task data for these filters" description="Try widening the date range." />
          ) : (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/*
                  `maxBarSize` caps how wide a bar may be drawn. Without it recharts
                  divides the plot between however many people there are, so a team of
                  two gets bars a couple of hundred pixels across — which reads as a
                  block of colour rather than as a measurement, and makes two people
                  look like a fuller chart than twenty.

                  `barGap` is the space between one person's three bars, halved from
                  the default so they read as a group belonging to that person; the
                  space between people is left alone, and is what separates the groups.
                */}
                <BarChart data={productivityChart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }} barCategoryGap="24%" barGap={2} maxBarSize={26}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    cursor={{ fill: 'rgba(9,9,11,0.04)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Completed and overdue are task states, so they carry the same
                      colours here as in the breakdown's legend, the badges and the
                      table. Assigned is not a state — it is the baseline the other two
                      are read against — so it stays neutral. */}
                  <Bar dataKey="assigned" name="Assigned" fill={CHART.neutralFaint} radius={[6, 6, 0, 0]} {...STILL} />
                  <Bar dataKey="completed" name="Completed" fill={STATUS_COLORS.completed} radius={[6, 6, 0, 0]} {...STILL} />
                  <Bar dataKey="overdue" name="Overdue" fill={STATUS_COLORS.overdue} radius={[6, 6, 0, 0]} {...STILL} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center gap-2.5 px-5 py-4 sm:px-6">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">Productivity table</h2>
          </header>
          {productivity.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No team members match these filters" />
          ) : (
            <div className="table-wrap p-4 sm:p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Department</th>
                    <th scope="col" className="text-right">Assigned</th>
                    <th scope="col" className="text-right">Pending</th>
                    <th scope="col" className="text-right">In Progress</th>
                    <th scope="col" className="text-right">Completed</th>
                    <th scope="col" className="text-right">Overdue</th>
                    <th scope="col">Completion rate</th>
                  </tr>
                </thead>
                <tbody>
                  {productivity.map((p) => (
                    <tr key={p.employee_id}>
                      <td className="font-medium text-foreground">{p.employee_name}</td>
                      <td className="text-muted-foreground">{p.department || '—'}</td>
                      <td className="text-right tabular-nums">{p.assigned}</td>
                      <td className="text-right tabular-nums">{p.pending}</td>
                      <td className="text-right tabular-nums">{p.in_progress}</td>
                      <td className="text-right font-medium tabular-nums text-success">{p.completed}</td>
                      <td className={`text-right tabular-nums ${p.overdue > 0 ? 'font-medium text-destructive' : ''}`}>{p.overdue}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p.completion_rate}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{p.completion_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
