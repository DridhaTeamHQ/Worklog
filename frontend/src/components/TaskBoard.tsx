import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Avatar } from './ui';
import { PriorityMark } from './Badges';
import { Board, type BoardColumn } from './Board';
import { deadlineLabel, taskLabel, todayIso } from '../lib/format';
import type { EffectiveStatus, Task, TaskStatus } from '../types';

/**
 * Four columns, but only three of them are statuses anyone can set.
 *
 * `overdue` is derived by the server from the deadline — nothing sets it — so its
 * column is a read-out, not a destination: cards can be dragged out of it into a real
 * status, and never into it. An overdue task appears there and nowhere else, so the
 * columns still partition the board rather than showing the same card twice.
 */
const COLUMNS: { key: EffectiveStatus; label: string; dot: string }[] = [
  { key: 'pending', label: 'To Do', dot: 'bg-amber-400' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-brand-500' },
  { key: 'overdue', label: 'Overdue', dot: 'bg-red-500' },
  { key: 'completed', label: 'Done', dot: 'bg-emerald-500' },
];

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

/**
 * How far through its own schedule a task is, as a percentage.
 *
 * This is elapsed calendar time between the start date and the deadline — not a claim
 * about how much of the work is done, which is not something the app records. A task
 * with no schedule has nothing to show and returns null rather than a made-up figure.
 */
function elapsedPercent(task: Task): number | null {
  if (task.status === 'completed') return 100;
  if (!task.start_date || !task.deadline) return null;
  const start = asDate(task.start_date).getTime();
  const end = asDate(task.deadline).getTime();
  if (end <= start) return null;
  const now = asDate(todayIso()).getTime();
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

interface Props {
  tasks: Task[];
  onMove: (task: Task, next: TaskStatus) => void;
  busyId?: number | null;
  /** Hide the assignee where every card is the same person. */
  showAssignee?: boolean;
  /** Where a card's key links to. Both portals accept ?highlight=. */
  taskHref: (task: Task) => string;
}

/** Tasks as a board, one column per status, dragged to change status. */
export function TaskBoard({
  tasks, onMove, busyId = null, showAssignee = true, taskHref,
}: Props) {
  const columns: BoardColumn<Task>[] = COLUMNS.map((column) => ({
    ...column,
    droppable: column.key !== 'overdue',
    items: column.key === 'overdue'
      ? tasks.filter((t) => t.effective_status === 'overdue')
      // Overdue work is shown in its own column, so it is not repeated here.
      : tasks.filter((t) => t.status === column.key && t.effective_status !== 'overdue'),
  }));

  return (
    <Board
      columns={columns}
      getId={(task) => task.id}
      getLabel={(task) => taskLabel(task)}
      onMove={(task, next) => {
        // Belt and braces: the Overdue column is not droppable, so this cannot fire
        // for it — but nothing downstream should ever be handed a derived status.
        if (next === 'overdue') return;
        onMove(task, next as TaskStatus);
      }}
      busyId={busyId}
      emptyLabel="No tasks"
      renderCard={(task) => {
        const due = deadlineLabel(task.deadline, task.status);
        const percent = elapsedPercent(task);
        const isOverdue = task.effective_status === 'overdue';
        const isDone = task.status === 'completed';

        return (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {task.project_key && (
                  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-brand-700">
                    {task.project_key}
                  </span>
                )}
                {task.task_key && (
                  <Link
                    to={taskHref(task)}
                    draggable={false}
                    className="shrink-0 font-mono text-[11px] font-semibold text-ink-500 hover:text-brand-600 hover:underline"
                  >
                    {task.task_key}
                  </Link>
                )}
              </span>
              <PriorityMark priority={task.priority} />
            </div>

            <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-ink-900">
              {taskLabel(task)}
            </p>

            {percent !== null && (
              <div className="mt-2.5">
                <p className={`text-[11px] font-medium ${
                  isDone ? 'text-emerald-700' : isOverdue ? 'text-red-600' : 'text-ink-500'
                }`}
                >
                  {isDone ? 'Task finished' : `${percent}% of the time elapsed`}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isDone ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
              {showAssignee ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar name={task.employee_name} src={task.employee_profile_image} size="sm" />
                  <span className="truncate text-xs text-ink-600">{task.employee_name}</span>
                </span>
              ) : <span />}

              <span
                className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${
                  isDone ? 'text-emerald-700'
                    : due.tone === 'danger' ? 'text-red-600'
                      : due.tone === 'warn' ? 'text-amber-600' : 'text-ink-500'
                }`}
              >
                {isDone
                  ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  : due.tone === 'danger' ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : null}
                {due.text}
              </span>
            </div>
          </>
        );
      }}
    />
  );
}
