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
  pending: 'bg-warning/10 text-warning border-warning/30',
  in_progress: 'bg-info/10 text-info border-info/25',
  completed: 'bg-success/10 text-success border-success/25',
  overdue: 'bg-destructive/10 text-destructive border-destructive/25',
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
  const columnCount = 7 + (selectable ? 1 : 0) + (showAssignee ? 1 : 0) + (hasActions ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </th>
            )}
            <th scope="col" className="min-w-[22rem] px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Work
            </th>
            {showAssignee && <Th>Assignee</Th>}
            <Th>Reporter</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
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
                  className={`border-b border-border transition-colors duration-200 ease-out ${
                    task.id === highlightId ? 'bg-warning/10' : 'hover:bg-muted/60'
                  }`}
                >
                  {selectable && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected?.has(task.id) ?? false}
                        onChange={() => toggleOne(task.id)}
                        aria-label={`Select ${task.task_key ?? task.title}`}
                        className="h-4 w-4 cursor-pointer accent-primary"
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
                        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-transform hover:bg-muted hover:text-foreground disabled:invisible"
                        style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>

                      {task.task_key && (
                        <span
                          className={`shrink-0 font-mono text-xs font-semibold ${
                            isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                          }`}
                        >
                          {task.task_key}
                        </span>
                      )}

                      <span className="min-w-0 flex-1 truncate text-foreground" title={task.title}>
                        {taskLabel(task)}
                      </span>

                      {task.notes && (
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Has notes" />
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


                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(task.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(task.updated_at)}</td>

                  {hasActions && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-0.5">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(task)}
                            aria-label={`Edit ${task.task_key ?? task.title}`}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(task)}
                            aria-label={`Delete ${task.task_key ?? task.title}`}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>

                {isOpen && (
                  <tr className="border-b border-border bg-muted/50">
                    <td colSpan={columnCount} className="px-3 py-3">
                      <div className="space-y-2.5 pl-8">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{task.description}</p>

                        {task.notes && (
                          <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
                            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <p className="min-w-0 text-sm text-muted-foreground">{task.notes}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                          {task.project_name && (
                            <span><span className="text-muted-foreground">Project: </span>{task.project_name}</span>
                          )}
                          {task.start_date && (
                            <span><span className="text-muted-foreground">Starts: </span>{task.start_date}</span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            <span className={
                              due.tone === 'danger' ? 'font-semibold text-primary-strong'
                                : due.tone === 'warn' ? 'font-semibold text-warning' : ''
                            }
                            >
                              {due.text}
                            </span>
                          </span>
                          {task.completed_at && (
                            <span><span className="text-muted-foreground">Completed: </span>{formatDateTime(task.completed_at)}</span>
                          )}
                          <span className="text-muted-foreground">Status: {STATUS_LABEL[task.effective_status]}</span>
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
    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
      <Link to={to} className="flex items-center gap-2 text-foreground hover:text-primary-strong">
        {body}
      </Link>
    );
  }
  return <span className="flex items-center gap-2 text-foreground">{body}</span>;
}
