import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  NotebookPen, Plus, Trash2, ChevronLeft, ChevronRight, Lock,
} from 'lucide-react';
import { projectApi, taskApi, todoApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  EmptyState, ErrorState, LoadingBlock, PageHeader, Select, Spinner,
} from '../components/ui';
import { addDaysIso, formatDate, taskLabel, todayIso } from '../lib/format';
import type { PersonalTodo, Project, Task } from '../types';
import { isManagerLevel } from '../types';

/**
 * My day — the signed-in person's private list of what they plan to do on a day.
 *
 * Everything here belongs to whoever is reading it. The API answers only from the
 * session, so there is no other list this page could show even if it asked.
 */
export function MyDayPage() {
  const { user } = useAuth();
  const toast = useToast();
  const today = todayIso();

  const [day, setDay] = useState(today);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    projectApi.list().then(({ data }) => setProjects(data)).catch(() => setProjects([]));
    // Role-scoped by the server: a team member gets their own work, a manager their
    // department's. Only the ones this person may file a note against are offered.
    taskApi.list({ limit: 200, sort: 'created_desc' })
      .then(({ data }) => setTasks(data))
      .catch(() => setTasks([]));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await todoApi.list(day, signal);
      setTodos(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load your list.');
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /**
   * Only the tasks this person is actually part of, since the server refuses any
   * other — offering one it would reject is a dead end dressed up as a choice.
   */
  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks.filter((t) => (isManagerLevel(user.role)
      ? t.manager_id === user.id
      : t.employee_id === user.id));
  }, [tasks, user]);

  /** Narrowed to the chosen project, so the two pickers agree. */
  const taskOptions = useMemo(() => {
    const pool = projectId ? myTasks.filter((t) => String(t.project_id) === projectId) : myTasks;
    return pool.map((t) => ({
      value: String(t.id),
      label: taskLabel(t),
      badge: t.task_key ?? undefined,
    }));
  }, [myTasks, projectId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setSaving(true);
    try {
      const { data } = await todoApi.create(text, day, {
        projectId: projectId ? Number(projectId) : undefined,
        taskId: taskId ? Number(taskId) : undefined,
      });
      setTodos((prev) => [...prev, data]);
      setTitle('');
      // The project and task are kept: a day's notes usually sit on the same work.
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (todo: PersonalTodo) => {
    setBusyId(todo.id);
    try {
      const { data } = await todoApi.update(todo.id, { isDone: !todo.is_done });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? data : t)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update that.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (todo: PersonalTodo) => {
    setBusyId(todo.id);
    try {
      await todoApi.remove(todo.id);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove that.');
    } finally {
      setBusyId(null);
    }
  };

  const done = todos.filter((t) => t.is_done).length;
  const taskListHref = isManagerLevel(user?.role) ? '/manager/tasks' : '/employee/tasks-assigned';

  return (
    <div className="space-y-5">
      <PageHeader
        title="My day"
        subtitle="Your own plan for the day. Private to you — these are not assigned tasks."
        actions={(
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDay((d) => addDaysIso(d, -1))}
              aria-label="Previous day"
              className="rounded-lg border border-ink-300 p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDay(today)}
              disabled={day === today}
              className="rounded-lg border border-ink-300 px-2.5 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDay((d) => addDaysIso(d, 1))}
              aria-label="Next day"
              className="rounded-lg border border-ink-300 p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      />

      <div className="card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900">
            <NotebookPen className="h-4 w-4 text-brand-600" aria-hidden />
            {formatDate(day)}
            {day === today && <span className="text-sm font-normal text-brand-600">· today</span>}
          </h2>
          {todos.length > 0 && (
            <span className="text-xs font-semibold text-ink-500 tabular-nums">
              {done} of {todos.length} done
            </span>
          )}
        </header>

        {/* --------------------------------------------------------- add form */}
        <form onSubmit={add} className="filter-bar space-y-3">
          <div>
            <label className="label" htmlFor="todo-title">What do you want to do?</label>
            <input
              id="todo-title"
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Draft the migration plan"
              className="input"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="todo-project">Project</label>
              <Select
                id="todo-project"
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  // A task from the old project would no longer belong to this one.
                  setTaskId('');
                }}
                placeholder="No project"
                options={[
                  { value: '', label: 'No project' },
                  ...projects.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                    badge: p.project_key,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="label" htmlFor="todo-task">Task</label>
              <Select
                id="todo-task"
                value={taskId}
                onChange={setTaskId}
                placeholder="No task"
                options={[{ value: '', label: 'No task' }, ...taskOptions]}
              />
              <p className="hint">
                {myTasks.length === 0
                  ? <>You have no tasks yet — <Link to={taskListHref} className="text-brand-600 hover:underline">your task list</Link> is empty.</>
                  : 'Picking a task files this note under that task’s project.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving || !title.trim()} className="btn-primary">
              {saving
                ? <><Spinner className="h-4 w-4" /> Adding…</>
                : <><Plus className="h-4 w-4" /> Add to my day</>}
            </button>
          </div>
        </form>

        {/* ------------------------------------------------------------- list */}
        {loading ? (
          <LoadingBlock label="Loading your list" rows={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : todos.length === 0 ? (
          <EmptyState
            icon={<NotebookPen className="h-6 w-6" />}
            title={day === today ? 'Nothing planned yet' : 'Nothing was planned for this day'}
            description="Write what you want to get done, and tie it to a project or task if it helps."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {todos.map((todo) => (
              <li key={todo.id} className="group flex items-start gap-3 px-5 py-3.5">
                <input
                  type="checkbox"
                  checked={todo.is_done}
                  disabled={busyId === todo.id}
                  onChange={() => void toggle(todo)}
                  aria-label={todo.is_done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
                />

                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${
                    todo.is_done ? 'text-ink-400 line-through' : 'text-ink-900'
                  }`}
                  >
                    {todo.title}
                  </p>
                  {(todo.project_key || todo.task_key) && (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
                      {todo.project_key && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono font-bold uppercase tracking-wide text-brand-700">
                          {todo.project_key}
                        </span>
                      )}
                      {todo.task_key && (
                        <Link
                          to={`${taskListHref}?highlight=${todo.task_id}`}
                          className="truncate hover:text-brand-600 hover:underline"
                        >
                          <span className="font-mono font-semibold">{todo.task_key}</span>
                          {todo.task_title ? ` ${todo.task_title}` : ''}
                        </Link>
                      )}
                    </p>
                  )}
                </div>

                {busyId === todo.id ? (
                  <Spinner className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void remove(todo)}
                    aria-label={`Remove "${todo.title}"`}
                    className="shrink-0 rounded p-1 text-ink-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
          Private to you. Nothing on this page is visible to your manager, and none of it
          counts towards your task list, daily reports or analytics.
        </p>
      </div>
    </div>
  );
}
