import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartGantt, ChevronRight } from 'lucide-react';
import { projectApi, taskApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput } from '../components/ui';
import { StatusBadge } from '../components/Badges';
import { ProjectSwitcher } from '../components/ProjectSwitcher';
import { formatDateShort, taskLabel, todayIso } from '../lib/format';
import { chipTint } from '../lib/tints';
import type { EffectiveStatus, Project, Task } from '../types';
import { isManagerLevel } from '../types';

/* ------------------------------------------------------------------- dates */

const DAY_MS = 86_400_000;

/** Parses a stored date (or timestamp) as local midnight, so day maths never drifts. */
const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/* -------------------------------------------------------------------- zoom */

/**
 * How many pixels one day is worth. Month columns follow from it, so the axis stays
 * honest at every zoom — a February column really is shorter than a March one.
 */
const ZOOMS = {
  weeks: { label: 'Weeks', dayWidth: 12 },
  months: { label: 'Months', dayWidth: 4 },
  quarters: { label: 'Quarters', dayWidth: 1.7 },
} as const;

type Zoom = keyof typeof ZOOMS;

/* -------------------------------------------------------------------- bars */

/**
 * Bars are drawn the way an allocation chart draws them: a soft tinted block with a
 * saturated dot at its head and dark text on top, rather than a solid slab of colour
 * with white text. Across a dense grid the pale fills stay legible where forty solid
 * bars would fight each other, and the dot is what carries the status at a glance.
 *
 * The four meanings are unchanged — these are the same statuses the badges use.
 */
const BAR_TONE: Record<EffectiveStatus, { bar: string; dot: string }> = {
  pending: { bar: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
  in_progress: { bar: 'bg-brand-100 border-brand-300 text-brand-800', dot: 'bg-brand-500' },
  completed: { bar: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' },
  overdue: { bar: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-500' },
};

interface Span { start: string; end: string }

/**
 * The stretch of calendar a task occupies.
 *
 * One date on its own still describes a point in time worth drawing, so a task with
 * only a start or only a deadline gets a single-day bar there. A task with neither is
 * not on the calendar at all and returns null — it keeps its row, but no bar, rather
 * than being invented a position it does not have.
 */
function spanOf(task: Task): Span | null {
  const start = task.start_date?.slice(0, 10) || null;
  const end = task.deadline?.slice(0, 10) || null;
  if (!start && !end) return null;
  const a = start ?? (end as string);
  const b = end ?? (start as string);
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/* ------------------------------------------------------------------ layout */

const COL = { scope: 280, status: 120, assignee: 150, date: 104 };
const LEFT_WIDTH = COL.scope + COL.status + COL.assignee + COL.date;
const ROW_H = 44;

interface Group {
  key: string;
  name: string;
  projectKey: string | null;
  tasks: Task[];
}

/**
 * Timeline — every task drawn against the calendar, grouped by project.
 *
 * Shared by both portals because the API already answers per role: a manager gets
 * their department's work and a team member gets their own, from the same request.
 * Nothing here re-derives who may see what.
 */
export function TimelinePage() {
  const { user } = useAuth();
  const isManager = isManagerLevel(user?.role);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState<Zoom>('months');
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    projectApi.list().then(({ data }) => setProjects(data)).catch(() => setProjects([]));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      // 200 is the server's ceiling on this endpoint; asking for more is a 400.
      const { data } = await taskApi.list({ sort: 'deadline_asc', limit: 200 }, signal);
      setTasks(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load the timeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* Filtering is local: the whole set is already in hand, and a timeline that
     re-fetches on every keystroke would redraw the axis under the reader. */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectId !== null && t.project_id !== projectId) return false;
      if (hideDone && t.status === 'completed') return false;
      if (!needle) return true;
      return `${t.task_key ?? ''} ${t.title} ${t.employee_name}`.toLowerCase().includes(needle);
    });
  }, [tasks, projectId, hideDone, search]);

  const groups = useMemo<Group[]>(() => {
    const byProject = new Map<string, Group>();
    for (const task of visible) {
      const key = task.project_id === null ? 'none' : String(task.project_id);
      let group = byProject.get(key);
      if (!group) {
        group = {
          key,
          name: task.project_name ?? 'No project',
          projectKey: task.project_key,
          tasks: [],
        };
        byProject.set(key, group);
      }
      group.tasks.push(task);
    }
    return [...byProject.values()].sort((a, b) => {
      // The catch-all bucket sits last; real projects sort by name.
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [visible]);

  const undated = visible.filter((t) => spanOf(t) === null).length;

  /**
   * The axis. Padded out to whole months at both ends, always containing today, and
   * never shorter than three months — a two-week project should not render as one
   * enormous bar filling the pane.
   */
  const axis = useMemo(() => {
    const today = asDate(todayIso());
    let min = today;
    let max = today;
    for (const task of visible) {
      const span = spanOf(task);
      if (!span) continue;
      const s = asDate(span.start);
      const e = asDate(span.end);
      if (s < min) min = s;
      if (e > max) max = e;
    }

    let first = startOfMonth(min);
    let last = startOfMonth(max);
    // A month of breathing room each side, so bars never start flush against an edge.
    first = addMonths(first, -1);
    last = addMonths(last, 1);
    while (daysBetween(first, addMonths(last, 1)) < 92) last = addMonths(last, 1);

    const months: { key: string; label: string; year: number; days: number; offset: number }[] = [];
    let cursor = first;
    let offset = 0;
    while (cursor <= last) {
      const days = daysInMonth(cursor);
      months.push({
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label: cursor.toLocaleDateString(undefined, { month: 'short' }),
        year: cursor.getFullYear(),
        days,
        offset,
      });
      offset += days;
      cursor = addMonths(cursor, 1);
    }
    return { start: first, months, totalDays: offset };
  }, [visible]);

  const { dayWidth } = ZOOMS[zoom];
  const chartWidth = axis.totalDays * dayWidth;
  const todayX = daysBetween(axis.start, asDate(todayIso())) * dayWidth;

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** Where a bar leads. Both portals have a task list that accepts ?highlight=. */
  const taskHref = (task: Task) =>
    `${isManager ? '/manager/tasks' : '/employee/tasks-assigned'}?highlight=${task.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        subtitle={isManager
          ? "Every task drawn against the calendar, grouped by project."
          : 'Your tasks drawn against the calendar, grouped by project.'}
        actions={(
          <div className="flex items-center gap-1 rounded-lg border border-ink-300 bg-white p-1">
            {(Object.keys(ZOOMS) as Zoom[]).map((z, i) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={`rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${chipTint(i, zoom === z)}`}
              >
                {ZOOMS[z].label}
              </button>
            ))}
          </div>
        )}
      />

      <ProjectSwitcher
        projects={projects}
        value={projectId}
        onChange={setProjectId}
        countFor={(p) => tasks.filter((t) => t.project_id === p.id).length}
        totalCount={tasks.length}
      />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={isManager ? 'Search work, key or assignee' : 'Search work or key'}
            className="sm:w-80"
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            Hide completed
          </label>
        </div>

        {loading ? (
          <LoadingBlock label="Loading timeline" rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<ChartGantt className="h-6 w-6" />}
            title={search || projectId !== null || hideDone ? 'Nothing matches' : 'No tasks yet'}
            description={search || projectId !== null || hideDone
              ? 'Try a different search, or clear the filters.'
              : 'Once work is assigned it will appear here against the calendar.'}
            action={search || projectId !== null || hideDone ? (
              <button
                type="button"
                onClick={() => { setSearch(''); setProjectId(null); setHideDone(false); }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ width: LEFT_WIDTH + chartWidth }}>
              {/* ------------------------------------------------------ header */}
              <div className="flex border-b border-brand-100 bg-brand-50 text-xs font-semibold uppercase tracking-wide text-brand-800">
                <div
                  className="sticky left-0 z-20 flex shrink-0 items-center bg-brand-50"
                  style={{ width: LEFT_WIDTH }}
                >
                  <span className="px-3 py-2.5" style={{ width: COL.scope }}>Scope</span>
                  <span className="px-3 py-2.5" style={{ width: COL.status }}>Status</span>
                  <span className="px-3 py-2.5" style={{ width: COL.assignee }}>Assignee</span>
                  <span className="px-3 py-2.5" style={{ width: COL.date }}>Start date</span>
                </div>
                <div className="relative flex shrink-0" style={{ width: chartWidth }}>
                  {axis.months.map((m) => (
                    <span
                      key={m.key}
                      className="shrink-0 truncate border-l border-brand-100 px-2 py-2.5"
                      style={{ width: m.days * dayWidth }}
                    >
                      {/* The year is only worth repeating where it actually changes. */}
                      {m.label}{m.key.endsWith('-0') ? ` ${m.year}` : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* -------------------------------------------------------- body */}
              <div className="relative">
                {/* Month gridlines and today, drawn once over every row so they stay
                    perfectly straight regardless of how the rows are grouped. */}
                <div className="pointer-events-none absolute inset-0 z-10">
                  {axis.months.map((m) => (
                    <span
                      key={m.key}
                      className="absolute top-0 bottom-0 w-px bg-ink-100"
                      style={{ left: LEFT_WIDTH + m.offset * dayWidth }}
                    />
                  ))}
                  {todayX >= 0 && todayX <= chartWidth && (
                    <span
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500/70"
                      style={{ left: LEFT_WIDTH + todayX }}
                      title="Today"
                    />
                  )}
                </div>

                {groups.map((group) => {
                  const isOpen = !collapsed.has(group.key);
                  return (
                    <div key={group.key}>
                      <div className="flex border-b border-ink-100 bg-ink-50">
                        <div
                          className="sticky left-0 z-20 flex shrink-0 items-center bg-ink-50"
                          style={{ width: LEFT_WIDTH, height: ROW_H }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            aria-expanded={isOpen}
                            className="flex min-w-0 flex-1 items-center gap-1.5 px-3 text-left"
                          >
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-ink-400 transition-transform"
                              style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
                              aria-hidden
                            />
                            {group.projectKey && (
                              <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-700">
                                {group.projectKey}
                              </span>
                            )}
                            <span className="truncate text-sm font-bold text-ink-900">{group.name}</span>
                            <span className="shrink-0 rounded-full bg-ink-200 px-1.5 text-[11px] font-semibold tabular-nums text-ink-600">
                              {group.tasks.length}
                            </span>
                          </button>
                        </div>
                        <div className="shrink-0" style={{ width: chartWidth, height: ROW_H }} />
                      </div>

                      {isOpen && group.tasks.map((task) => {
                        const span = spanOf(task);
                        const left = span ? daysBetween(axis.start, asDate(span.start)) * dayWidth : 0;
                        // Inclusive of the end day, and never thinner than a visible nub.
                        const width = span
                          ? Math.max(dayWidth * 2, (daysBetween(asDate(span.start), asDate(span.end)) + 1) * dayWidth)
                          : 0;

                        return (
                          <div key={task.id} className="group flex border-b border-ink-100 hover:bg-ink-50">
                            <div
                              className="sticky left-0 z-20 flex shrink-0 items-center bg-white transition-colors group-hover:bg-ink-50"
                              style={{ width: LEFT_WIDTH, height: ROW_H }}
                            >
                              <span
                                className="flex min-w-0 items-center gap-1.5 px-3 pl-8"
                                style={{ width: COL.scope }}
                              >
                                {task.task_key && (
                                  <Link
                                    to={taskHref(task)}
                                    className="shrink-0 font-mono text-xs font-semibold text-brand-700 hover:underline"
                                  >
                                    {task.task_key}
                                  </Link>
                                )}
                                <span className="truncate text-sm text-ink-900" title={task.title}>
                                  {taskLabel(task)}
                                </span>
                              </span>
                              <span className="px-3" style={{ width: COL.status }}>
                                <StatusBadge status={task.effective_status} />
                              </span>
                              <span className="flex min-w-0 items-center gap-2 px-3" style={{ width: COL.assignee }}>
                                <Avatar name={task.employee_name} src={task.employee_profile_image} size="sm" />
                                <span className="truncate text-sm text-ink-700">{task.employee_name}</span>
                              </span>
                              <span className="px-3 text-xs text-ink-500" style={{ width: COL.date }}>
                                {task.start_date ? formatDateShort(task.start_date) : '—'}
                              </span>
                            </div>

                            <div className="relative shrink-0" style={{ width: chartWidth, height: ROW_H }}>
                              {span ? (
                                <Link
                                  to={taskHref(task)}
                                  title={`${taskLabel(task)} · ${formatDateShort(span.start)} → ${formatDateShort(span.end)}`}
                                  className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-md border px-1.5 text-[11px] font-semibold shadow-sm transition-shadow hover:shadow-md ${BAR_TONE[task.effective_status].bar}`}
                                  style={{ left, width, height: 20 }}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${BAR_TONE[task.effective_status].dot}`}
                                    aria-hidden
                                  />
                                  <span className="truncate">{width > 72 ? taskLabel(task) : ''}</span>
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-ink-200 px-4 py-3 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex flex-wrap items-center gap-3">
              {(Object.keys(BAR_TONE) as EffectiveStatus[]).map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className={`inline-flex h-3 w-5 items-center justify-center rounded-sm border ${BAR_TONE[status].bar}`} aria-hidden>
                    <span className={`h-1.5 w-1.5 rounded-full ${BAR_TONE[status].dot}`} />
                  </span>
                  {status === 'in_progress' ? 'In progress' : status[0].toUpperCase() + status.slice(1)}
                </span>
              ))}
            </span>
            {undated > 0 && (
              <span>
                {undated} {undated === 1 ? 'task has' : 'tasks have'} no start date or deadline, so
                {undated === 1 ? ' it is' : ' they are'} listed without a bar.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
