import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardPlus } from 'lucide-react';
import { projectApi, taskApi, teamApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Avatar, Modal, Spinner } from './ui';
import { todayIso } from '../lib/format';
import type { Priority, Project, Task, TeamMember } from '../types';

const PRIORITIES: { value: Priority; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Whenever there is time' },
  { value: 'medium', label: 'Medium', hint: 'Normal priority' },
  { value: 'high', label: 'High', hint: 'Needs attention soon' },
  { value: 'urgent', label: 'Urgent', hint: 'Drop everything' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAssigned: (task: Task) => void;
  /**
   * Fixes the assignee — set when the dialog is opened from one employee's page.
   * Leave it out and the manager picks the assignee from a list instead.
   */
  employee?: { id: number; name: string };
  /** Pre-selects the project, e.g. the one currently being viewed. */
  defaultProjectId?: number | null;
}

export function AssignTaskModal({ open, onClose, onAssigned, employee, defaultProjectId }: Props) {
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projectId, setProjectId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState(todayIso());
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const assigneeIsFixed = Boolean(employee);

  // Load the reference data once the dialog is actually opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    projectApi.list()
      .then(({ data }) => {
        if (cancelled) return;
        setProjects(data);
        // Prefer the project being viewed; otherwise fall back to the first one.
        const preferred = defaultProjectId && data.some((p) => p.id === defaultProjectId)
          ? defaultProjectId
          : data[0]?.id;
        setProjectId(preferred ? String(preferred) : '');
      })
      .catch(() => { if (!cancelled) setProjects([]); });

    // Only needed when the manager still has to choose someone.
    if (!assigneeIsFixed) {
      teamApi.list()
        .then(({ data }) => { if (!cancelled) setMembers(data); })
        .catch(() => { if (!cancelled) setMembers([]); });
    }

    return () => { cancelled = true; };
  }, [open, defaultProjectId, assigneeIsFixed]);

  // Reset to a clean form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    // No pre-selected assignee when the manager is choosing: picking someone should be
    // a deliberate act, not whoever happens to sort first.
    setEmployeeId(employee ? String(employee.id) : '');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStartDate(todayIso());
    setDeadline('');
    setNotes('');
    setErrors({});
  }, [open, employee]);

  const selectedMember = members.find((m) => String(m.id) === employeeId);
  const assigneeName = employee?.name ?? selectedMember?.name;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate here as well as on the server so the user gets feedback instantly.
    const next: Record<string, string> = {};
    if (!employeeId) next.employeeId = 'Choose who this task is for.';
    if (!projectId) next.projectId = 'Choose the project this task belongs to.';
    if (!title.trim()) next.title = 'Give the task a title.';
    if (!description.trim()) next.description = 'Describe what needs to be done.';
    if (startDate && deadline && deadline < startDate) next.deadline = 'The deadline cannot be earlier than the start date.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { data } = await taskApi.assign({
        employeeId: Number(employeeId),
        projectId: Number(projectId),
        title: title.trim(),
        description: description.trim(),
        notes: notes.trim() || undefined,
        priority,
        startDate: startDate || null,
        deadline: deadline || null,
      });
      toast.success(data.message);
      onAssigned(data.task);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not assign the task. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign a task"
      description={assigneeName
        ? `This task will go to ${assigneeName}, and they will be notified.`
        : 'Choose who this is for — they will be notified as soon as you assign it.'}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="assign-task-form" disabled={submitting} className="btn-primary">
            {submitting ? <><Spinner className="h-4 w-4" /> Assigning…</> : <><ClipboardPlus className="h-4 w-4" /> Assign Task</>}
          </button>
        </div>
      )}
    >
      <form id="assign-task-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="t-assignee">Assignee <span className="text-red-500">*</span></label>
          {assigneeIsFixed ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5">
              <Avatar name={employee!.name} size="sm" />
              <span className="text-sm font-medium text-ink-900">{employee!.name}</span>
            </div>
          ) : (
            <>
              <select
                id="t-assignee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                aria-invalid={!!errors.employeeId}
                className={`input ${errors.employeeId ? 'input-error' : ''}`}
              >
                <option value="">Select a team member…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.department ? ` · ${m.department}` : ''}
                  </option>
                ))}
              </select>
              {errors.employeeId
                ? <p className="field-error">{errors.employeeId}</p>
                : selectedMember && (
                  <p className="hint">
                    Currently {selectedMember.counts.pending} pending
                    {selectedMember.counts.overdue > 0 && (
                      <span className="font-semibold text-red-600"> · {selectedMember.counts.overdue} overdue</span>
                    )}
                  </p>
                )}
            </>
          )}
        </div>

        <div>
          <label className="label" htmlFor="t-project">Project <span className="text-red-500">*</span></label>
          <select
            id="t-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-invalid={!!errors.projectId}
            className={`input ${errors.projectId ? 'input-error' : ''}`}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.project_key} · {p.name}</option>
            ))}
          </select>
          {errors.projectId
            ? <p className="field-error">{errors.projectId}</p>
            : <p className="hint">The task key is issued from this project, for example SHMOB-12.</p>}
        </div>

        <div>
          <label className="label" htmlFor="t-title">Task title <span className="text-red-500">*</span></label>
          <input
            id="t-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="e.g. Develop Login API"
            autoFocus
            aria-invalid={!!errors.title}
            className={`input ${errors.title ? 'input-error' : ''}`}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="t-desc">Task description <span className="text-red-500">*</span></label>
          <textarea
            id="t-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Create authentication API for the employee portal..."
            aria-invalid={!!errors.description}
            className={`input resize-y ${errors.description ? 'input-error' : ''}`}
          />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>

        <fieldset>
          <legend className="label">Priority</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <label
                key={p.value}
                className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                  priority === p.value
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-ink-300 hover:border-ink-400'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={() => setPriority(p.value)}
                    className="h-3.5 w-3.5 accent-brand-600"
                  />
                  <span className="text-sm font-semibold text-ink-900">{p.label}</span>
                </span>
                <span className="mt-0.5 pl-5.5 text-[11px] text-ink-500">{p.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="t-start">Start date</label>
            <input
              id="t-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="t-deadline">Deadline</label>
            <input
              id="t-deadline"
              type="date"
              value={deadline}
              min={startDate || undefined}
              onChange={(e) => setDeadline(e.target.value)}
              aria-invalid={!!errors.deadline}
              className={`input ${errors.deadline ? 'input-error' : ''}`}
            />
            {errors.deadline && <p className="field-error">{errors.deadline}</p>}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="t-notes">Additional notes</label>
          <textarea
            id="t-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Anything else that will help them get started (optional)"
            className="input resize-y"
          />
        </div>
      </form>
    </Modal>
  );
}
