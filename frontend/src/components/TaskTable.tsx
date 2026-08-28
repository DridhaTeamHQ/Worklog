import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, StickyNote, Trash2, CalendarClock, Pencil } from 'lucide-react';
import { Avatar } from './ui';
import { PriorityMark } from './Badges';
import { deadlineLabel, formatDateTime, STATUS_LABEL, taskLabel } from '../lib/format';
import type { Task, TaskStatus } from '../types';

/**
 * Inline status control. Rendered as a native select so it stays keyboard-operable and
 * screen-reader friendly, but painted as a coloured chip to read like a status badge.
 */
const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-300',
  in_progress: 'bg-blue-50 text-blue-800 border-blue-300',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  overdue: 'bg-red-50 text-red-800 border-red-300',
};

function StatusSelect({
  task, disabled, onChange,
}: { task: Task; disabled?: boolean; onChange: (next: TaskStatus) => void }) {
  // The chip is coloured by the *effective* status so an overdue task reads red, while
  // the select's value stays the stored status the user can actually choose from.
  const tone = STATUS_CHIP[task.effective_status] ?? STATUS_CHIP.pending;
  return (
    <select
      value={task.status}
      disabled={disabled}
      aria-label={`Status for ${task.task_key ?? task.title}`}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      className={`cursor-pointer appearance-none rounded border px-2 py-1 pr-6 text-xs font-semibold
                  transition-colors disabled:cursor-wait disabled:opacity-60 ${tone}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.35rem center',
      }}
    >
      <option value="pending">Pending</option>
      <option value="in_progress">In Progress</option>
      <option value="completed">Completed</option>
    </select>
  );
}

export interface TaskTableProps {
  tasks: Task[];
  /** Highlighted row, e.g. when arriving from a notification. */
  highlightId?: number | null;
  updatingId?: number | null;
  onStatusChange: (task: Task, next: TaskStatus) => void;
  /** Manager-only affordances. Omitted for team members. */
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  selectable?: boolean;
  selected?: Set<number>;
  onSelectedChange?: (next: Set<number>) => void;
  /** Hide the assignee column when every row is the same person. */
  showAssignee?: boolean;
  /** Link the assignee through to their detail page (managers only). */
  linkAssignee?: boolean;
  rowRef?: (id: number) => ((el: HTMLTableRowElement | null) => void) | undefined;
}

export function TaskTable({
  tasks, highlightId, updatingId, onStatusChange, onDelete, onEdit,
  selectable = false, selected, onSelectedChange,
  showAssignee = true, linkAssignee = false, rowRef,
}: TaskTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = useMemo(
    () => tasks.length > 0 && tasks.every((t) => selected?.has(t.id)),
    [tasks, selected],
  );
  const someSelected = useMemo(
    () => tasks.some((t) => selected?.has(t.id)) && !allSelected,
    [tasks, selected, allSelected],
  );

  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  };

  const toggleOne = (id: number) => {
    if (!onSelectedChange || !selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedChange(next);
  };

  const hasActions = Boolean(onDelete || onEdit);
  const columnCount = 8 + (selectable ? 1 : 0) + (showAssignee ? 1 : 0) + (hasActions ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-100 bg-brand-50">
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
                  className="h-4 w-4 cursor-pointer accent-brand-600"
                />
              </th>
            )}
            <th scope="col" className="min-w-[22rem] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-brand-800">
              Work
            </th>
            {showAssignee && <Th>Assignee</Th>}
            <Th>Reporter</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>Resolution</Th>
            <Th>Created</Th>
            <Th>Updated</Th>
            {hasActions && <th scope="col" className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isDone = task.status === 'completed';
            const isOpen = expanded.has(task.id);
            const due = deadlineLabel(task.deadline, task.status);
            const hasDetail = Boolean(task.description || task.notes || task.deadline);

            return (
              <Fragment key={task.id}>
                <tr
                  ref={rowRef?.(task.id)}
                  className={`border-b border-ink-100 transition-colors duration-200 ease-out ${
                    task.id === highlightId ? 'bg-cream-100' : 'hover:bg-brand-50/70'
                  }`}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected?.has(task.id) ?? false}
                        onChange={() => toggleOne(task.id)}
                        aria-label={`Select ${task.task_key ?? task.title}`}
                        className="h-4 w-4 cursor-pointer accent-brand-600"
                      />
                    </td>
                  )}

                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(task.id)}
                        disabled={!hasDetail}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Hide details' : 'Show details'}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-ink-400 transition-transform hover:bg-ink-100 hover:text-ink-700 disabled:invisible"
                        style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>

                      {task.task_key && (
                        <span
                          className={`shrink-0 font-mono text-xs font-semibold ${
                            isDone ? 'text-ink-400 line-through' : 'text-brand-700'
                          }`}
                        >
                          {task.task_key}
                        </span>
                      )}

                      <span className="min-w-0 flex-1 truncate text-ink-900" title={task.title}>
                        {taskLabel(task)}
                      </span>

                      {task.notes && (
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" aria-label="Has notes" />
                      )}
                    </div>
                  </td>

                  {showAssignee && (
                    <td className="px-3 py-2.5">
                      <Person
                        name={task.employee_name}
                        image={task.employee_profile_image}
                        to={linkAssignee ? `/manager/team/${task.employee_id}` : undefined}
                      />
                    </td>
                  )}

                  <td className="px-3 py-2.5">
                    <Person name={task.manager_name} image={task.manager_profile_image} />
                  </td>

                  <td className="px-3 py-2.5"><PriorityMark priority={task.priority} /></td>

                  <td className="px-3 py-2.5">
                    <StatusSelect
                      task={task}
                      disabled={updatingId === task.id}
                      onChange={(next) => onStatusChange(task, next)}
                    />
                  </td>

                  {/* Jira's Resolution: set once the work is actually finished. */}
                  <td className="px-3 py-2.5 text-ink-600">{isDone ? 'Done' : <span className="text-ink-300">—</span>}</td>

                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-500">{formatDateTime(task.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-500">{formatDateTime(task.updated_at)}</td>

                  {hasActions && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(task)}
                            aria-label={`Edit ${task.task_key ?? task.title}`}
                            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(task)}
                            aria-label={`Delete ${task.task_key ?? task.title}`}
                            className="rounded p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>

                {isOpen && (
                  <tr className="border-b border-ink-100 bg-brand-50/50">
                    <td colSpan={columnCount} className="px-3 py-3">
                      <div className="space-y-2.5 pl-8">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{task.description}</p>

                        {task.notes && (
                          <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2">
                            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                            <p className="min-w-0 text-sm text-ink-600">{task.notes}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-500">
                          {task.project_name && (
                            <span><span className="text-ink-400">Project: </span>{task.project_name}</span>
                          )}
                          {task.start_date && (
                            <span><span className="text-ink-400">Starts: </span>{task.start_date}</span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                            <span className={
                              due.tone === 'danger' ? 'font-semibold text-red-600'
                                : due.tone === 'warn' ? 'font-semibold text-amber-600' : ''
                            }
                            >
                              {due.text}
                            </span>
                          </span>
                          {task.completed_at && (
                            <span><span className="text-ink-400">Completed: </span>{formatDateTime(task.completed_at)}</span>
                          )}
                          <span className="text-ink-400">Status: {STATUS_LABEL[task.effective_status]}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-brand-800">
      {children}
    </th>
  );
}

function Person({ name, image, to }: { name: string; image?: string | null; to?: string }) {
  const body = (
    <>
      <Avatar name={name} src={image} size="sm" />
      <span className="min-w-0 truncate">{name}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
        {body}
      </Link>
    );
  }
  return <span className="flex items-center gap-2 text-ink-700">{body}</span>;
}
