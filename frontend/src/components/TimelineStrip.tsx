import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { PriorityMark } from './Badges';
import { addDaysIso, formatDate, formatTime, taskLabel, todayIso } from '../lib/format';
import type { Task } from '../types';

/** Six weeks at a glance, the same span the strip in the reference covers. */
const DAYS_SHOWN = 42;
const DAY_WIDTH = 22;

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** Monday-first weekday index, so a week on the strip starts where the labels do. */
const weekdayIndex = (iso: string) => (asDate(iso).getDay() + 6) % 7;

const WEEKDAY_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** What a task does on a given day. A task can do more than one thing on the same day. */
type Kind = 'starts' | 'due' | 'completed';

interface Entry { task: Task; kind: Kind; at: string | null }

const KIND_LABEL: Record<Kind, string> = {
  starts: 'Starts',
  due: 'Due',
  completed: 'Completed',
};

interface Props {
  tasks: Task[];
  /** Where an entry links to. Both portals accept ?highlight=. */
  taskHref: (task: Task) => string;
}

/**
 * The horizontal date strip above the board: six weeks of days, with a pin on every
 * day that has something happening and a panel for the day you pick.
 *
 * Deadlines and start dates are stored as plain dates, so those entries have no clock
 * time and do not pretend to — only a completion, which is a real timestamp, shows
 * one. The panel says what happens on a day, and when we genuinely know when.
 */
export function TimelineStrip({ tasks, taskHref }: Props) {
  const today = todayIso();

  /** First day on screen. Starts on the Monday of the week two weeks back. */
  const [anchor, setAnchor] = useState(() => addDaysIso(today, -(weekdayIndex(today) + 14)));
  const [selected, setSelected] = useState<string | null>(today);

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => addDaysIso(anchor, i)),
    [anchor],
  );

  /** Every dated thing a task does, bucketed by the day it happens on. */
  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const push = (day: string | null, entry: Entry) => {
      if (!day) return;
      const list = map.get(day);
      if (list) list.push(entry);
      else map.set(day, [entry]);
    };
    for (const task of tasks) {
      push(dayOf(task.start_date), { task, kind: 'starts', at: null });
      push(dayOf(task.deadline), { task, kind: 'due', at: null });
      push(dayOf(task.completed_at), { task, kind: 'completed', at: task.completed_at });
    }
    return map;
  }, [tasks]);

  /** Most urgent thing on the day decides the pin's colour. */
  const pinTone = (entries: Entry[]) => {
    if (entries.some((e) => e.task.effective_status === 'overdue')) return 'bg-red-500';
    if (entries.some((e) => e.kind === 'due' && e.task.status !== 'completed')) return 'bg-amber-500';
    if (entries.some((e) => e.kind === 'completed')) return 'bg-emerald-500';
    return 'bg-brand-500';
  };

  const selectedEntries = selected ? byDay.get(selected) ?? [] : [];
  const width = DAYS_SHOWN * DAY_WIDTH;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900">
          <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden />
          Schedule
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((a) => addDaysIso(a, -7))}
            aria-label="Show the previous week"
            className="rounded-lg border border-ink-300 p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(addDaysIso(today, -(weekdayIndex(today) + 14)))}
            className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchor((a) => addDaysIso(a, 7))}
            aria-label="Show the next week"
            className="rounded-lg border border-ink-300 p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div style={{ width }}>
          {/* Pin row. Sits above the axis, one pin per day that has something on it. */}
          <div className="relative h-9">
            {days.map((day, i) => {
              const entries = byDay.get(day);
              if (!entries?.length) return null;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  title={`${formatDate(day)} — ${entries.length} item${entries.length === 1 ? '' : 's'}`}
                  style={{ left: i * DAY_WIDTH + DAY_WIDTH / 2 }}
                  className={`absolute bottom-0 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm transition-transform hover:scale-110 ${pinTone(entries)} ${
                    selected === day ? 'ring-2 ring-brand-600 ring-offset-1' : ''
                  }`}
                >
                  {entries.length}
                </button>
              );
            })}

            {/* Today's flag, only while today is on screen. */}
            {days.includes(today) && (
              <span
                style={{ left: days.indexOf(today) * DAY_WIDTH + DAY_WIDTH / 2 }}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 shadow-sm"
              >
                Today
              </span>
            )}
          </div>

          {/* The axis: one cell per day, week boundaries marked underneath. */}
          <div className="flex border-t border-ink-200">
            {days.map((day) => {
              const weekday = weekdayIndex(day);
              const isToday = day === today;
              const isWeekend = weekday >= 5;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={selected === day}
                  aria-label={formatDate(day)}
                  style={{ width: DAY_WIDTH }}
                  className={`shrink-0 border-l border-ink-100 pt-1.5 text-center text-[10px] transition-colors first:border-l-0 ${
                    selected === day ? 'bg-brand-50 font-bold text-brand-700'
                      : isToday ? 'font-bold text-brand-600'
                        : isWeekend ? 'text-ink-300 hover:bg-ink-50' : 'text-ink-400 hover:bg-ink-50'
                  }`}
                >
                  {WEEKDAY_INITIAL[weekday]}
                  <span
                    className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${
                      isToday ? 'bg-brand-600' : 'bg-transparent'
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>

          {/* Date labels, one per week, aligned to the Monday they sit under. */}
          <div className="relative h-5">
            {days.map((day, i) => (weekdayIndex(day) === 0 ? (
              <span
                key={day}
                style={{ left: i * DAY_WIDTH }}
                className="absolute top-0 whitespace-nowrap text-[11px] font-semibold text-ink-600"
              >
                {asDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            ) : null))}
          </div>
        </div>
      </div>

      {/* What happens on the chosen day. */}
      <div className="mt-3 border-t border-ink-100 pt-3">
        <p className="text-xs font-semibold text-ink-700">
          {selected ? formatDate(selected) : 'Pick a day'}
          {selected === today && <span className="ml-1.5 font-normal text-brand-600">· today</span>}
        </p>

        {selectedEntries.length === 0 ? (
          <p className="mt-1.5 text-xs text-ink-400">Nothing scheduled on this day.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {selectedEntries.map((entry) => (
              <li key={`${entry.task.id}-${entry.kind}`}>
                <Link
                  to={taskHref(entry.task)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-50"
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    entry.kind === 'completed' ? 'bg-emerald-50 text-emerald-700'
                      : entry.kind === 'due' ? 'bg-amber-50 text-amber-700'
                        : 'bg-brand-50 text-brand-700'
                  }`}
                  >
                    {KIND_LABEL[entry.kind]}
                  </span>
                  {entry.task.task_key && (
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-ink-500">
                      {entry.task.task_key}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-900">
                    {taskLabel(entry.task)}
                  </span>
                  {/* Only a completion carries a real clock time; the other two are
                      plain dates and are left without one rather than given a fake. */}
                  {entry.at && (
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                      {formatTime(entry.at)}
                    </span>
                  )}
                  <PriorityMark priority={entry.task.priority} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
