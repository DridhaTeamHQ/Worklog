import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bug, Info } from 'lucide-react';
import { taskApi, ticketApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import { taskLabel } from '../lib/format';
import type { Task, Ticket, TicketSeverity } from '../types';

const SEVERITIES: { value: TicketSeverity; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Cosmetic or minor' },
  { value: 'medium', label: 'Medium', hint: 'Annoying, has a workaround' },
  { value: 'high', label: 'High', hint: 'Blocks part of the work' },
  { value: 'critical', label: 'Critical', hint: 'Blocks everything' },
];

const DESCRIPTION_PLACEHOLDER = `What went wrong, and how to see it again. For example:

Steps: open the reports page and filter to last week
Expected: the totals match the table
Actual: the totals are double-counted`;

interface Props {
  open: boolean;
  onClose: () => void;
  onRaised: (ticket: Ticket) => void;
  /** Pre-selects the task (and its project) when raised from a specific task. */
  defaultTaskId?: number | null;
}

/**
 * Raise a bug ticket. Project is chosen first and the task list narrows to that
 * project, which keeps the second choice short and makes the pairing obvious. Only
 * tasks assigned to the signed-in person are ever offered — and the server checks that
 * again rather than trusting the form.
 */
export function RaiseTicketModal({ open, onClose, onRaised, defaultTaskId }: Props) {
  const toast = useToast();

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<TicketSeverity>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTasks(true);

    // The signed-in member's own tasks — the API scopes this to them automatically.
    taskApi.list({ limit: 200, sort: 'created_desc' })
      .then(({ data }) => {
        if (cancelled) return;
        setMyTasks(data);
        const preset = defaultTaskId ? data.find((t) => t.id === defaultTaskId) : undefined;
        if (preset) {
          setProjectId(String(preset.project_id ?? ''));
          setTaskId(String(preset.id));
        }
      })
      .catch(() => { if (!cancelled) setMyTasks([]); })
      .finally(() => { if (!cancelled) setLoadingTasks(false); });

    return () => { cancelled = true; };
  }, [open, defaultTaskId]);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setSeverity('medium');
    setErrors({});
    if (!defaultTaskId) {
      setProjectId('');
      setTaskId('');
    }
  }, [open, defaultTaskId]);

  /** Distinct projects the person actually has work in — nothing else is selectable. */
  const projects = useMemo(() => {
    const seen = new Map<number, { id: number; key: string; name: string; count: number }>();
    for (const t of myTasks) {
      if (!t.project_id) continue;
      const existing = seen.get(t.project_id);
      if (existing) existing.count += 1;
      else {
        seen.set(t.project_id, {
          id: t.project_id,
          key: t.project_key ?? '',
          name: t.project_name ?? 'Project',
          count: 1,
        });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [myTasks]);

  const tasksInProject = useMemo(
    () => (projectId ? myTasks.filter((t) => String(t.project_id) === projectId) : []),
    [myTasks, projectId],
  );

  const selectedTask = myTasks.find((t) => String(t.id) === taskId);

  const changeProject = (value: string) => {
    setProjectId(value);
    // The old task almost certainly belongs to the previous project, so clear it.
    setTaskId('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!projectId) next.projectId = 'Choose the project you were working on.';
    if (!taskId) next.taskId = 'Choose the task you hit this on.';
    if (!title.trim()) next.title = 'Give the bug a short summary.';
    if (!description.trim()) next.description = 'Describe what went wrong.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { data } = await ticketApi.create({
        projectId: Number(projectId),
        taskId: Number(taskId),
        title: title.trim(),
        description: description.trim(),
        severity,
      });
      toast.success(data.message);
      onRaised(data.ticket);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not raise the ticket. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const noTasks = !loadingTasks && myTasks.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise a ticket"
      description="Report a bug you hit while working on one of your tasks."
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="raise-ticket-form" disabled={submitting || noTasks} className="btn-primary">
            {submitting ? <><Spinner className="h-4 w-4" /> Raising…</> : <><Bug className="h-4 w-4" /> Raise ticket</>}
          </button>
        </div>
      )}
    >
      {noTasks ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-amber-900">You have no assigned tasks yet</p>
            <p className="mt-0.5 text-sm text-amber-800">
              Tickets are raised against a task you are working on, so there is nothing to
              report against until your manager assigns you something.
            </p>
          </div>
        </div>
      ) : (
        <form id="raise-ticket-form" onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="tk-project">Project <span className="text-red-500">*</span></label>
            <select
              id="tk-project"
              value={projectId}
              onChange={(e) => changeProject(e.target.value)}
              disabled={loadingTasks}
              aria-invalid={!!errors.projectId}
              className={`input ${errors.projectId ? 'input-error' : ''}`}
            >
              <option value="">{loadingTasks ? 'Loading your work…' : 'Select a project…'}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name} ({p.count} task{p.count === 1 ? '' : 's'})
                </option>
              ))}
            </select>
            {errors.projectId && <p className="field-error">{errors.projectId}</p>}
          </div>

          <div>
            <label className="label" htmlFor="tk-task">Task <span className="text-red-500">*</span></label>
            <select
              id="tk-task"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={!projectId}
              aria-invalid={!!errors.taskId}
              className={`input ${errors.taskId ? 'input-error' : ''}`}
            >
              <option value="">
                {projectId ? 'Select the task you were working on…' : 'Choose a project first'}
              </option>
              {tasksInProject.map((t) => (
                <option key={t.id} value={t.id}>{t.task_key} · {taskLabel(t)}</option>
              ))}
            </select>
            {errors.taskId
              ? <p className="field-error">{errors.taskId}</p>
              : <p className="hint">Only tasks assigned to you appear here.</p>}
          </div>

          {selectedTask && (
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Working on</p>
              <p className="mt-1 text-sm text-ink-700">
                <span className="font-mono text-xs font-semibold text-brand-700">{selectedTask.task_key}</span>
                {' '}{taskLabel(selectedTask)}
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="tk-title">Summary <span className="text-red-500">*</span></label>
            <input
              id="tk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="e.g. Login fails when the password contains a colon"
              aria-invalid={!!errors.title}
              className={`input ${errors.title ? 'input-error' : ''}`}
            />
            {errors.title && <p className="field-error">{errors.title}</p>}
          </div>

          <div>
            <label className="label" htmlFor="tk-desc">
              What happened? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="tk-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={7}
              maxLength={6000}
              placeholder={DESCRIPTION_PLACEHOLDER}
              aria-invalid={!!errors.description}
              className={`input resize-y leading-relaxed ${errors.description ? 'input-error' : ''}`}
            />
            {errors.description
              ? <p className="field-error">{errors.description}</p>
              : <p className="hint">Steps, what you expected, and what actually happened.</p>}
          </div>

          <fieldset>
            <legend className="label">Severity</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SEVERITIES.map((sv) => (
                <label
                  key={sv.value}
                  className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                    severity === sv.value
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-ink-300 hover:border-ink-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="severity"
                      value={sv.value}
                      checked={severity === sv.value}
                      onChange={() => setSeverity(sv.value)}
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                    <span className="text-sm font-semibold text-ink-900">{sv.label}</span>
                  </span>
                  <span className="mt-0.5 pl-5.5 text-[11px] text-ink-500">{sv.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
