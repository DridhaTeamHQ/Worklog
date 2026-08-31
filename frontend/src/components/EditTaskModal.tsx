import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { taskApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner, Select } from './ui';
import type { Priority, Task } from '../types';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSaved: (task: Task) => void;
}

/**
 * Corrects the wording or dates of a task already assigned. The assignee and project
 * are not editable: moving a task between people or projects would invalidate its key
 * and quietly rewrite who is accountable, which is better done by closing this one and
 * assigning a new task.
 */
export function EditTaskModal({ open, onClose, task, onSaved }: Props) {
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description);
    setNotes(task.notes ?? '');
    setPriority(task.priority);
    setStartDate(task.start_date ?? '');
    setDeadline(task.deadline ?? '');
    setErrors({});
  }, [open, task]);

  if (!task) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Give the task a title.';
    if (!description.trim()) next.description = 'Describe what needs to be done.';
    if (startDate && deadline && deadline < startDate) next.deadline = 'The deadline cannot be earlier than the start date.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { data } = await taskApi.update(task.id, {
        title: title.trim(),
        description: description.trim(),
        notes: notes.trim() || undefined,
        priority,
        startDate: startDate || null,
        deadline: deadline || null,
      });
      toast.success(`${data.task_key ?? data.title} updated.`);
      onSaved(data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the task.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task.task_key ? `Edit ${task.task_key}` : 'Edit task'}
      description={`Assigned to ${task.employee_name}. They'll be notified of the change.`}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="edit-task-form" disabled={submitting} className="btn-primary">
            {submitting ? <><Spinner className="h-4 w-4" /> Saving…</> : <><Save className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      )}
    >
      <form id="edit-task-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="et-title">Task title <span className="text-destructive">*</span></label>
          <input
            id="et-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            autoFocus
            aria-invalid={!!errors.title}
            className={`input ${errors.title ? 'input-error' : ''}`}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="et-desc">Task description <span className="text-destructive">*</span></label>
          <textarea
            id="et-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={4000}
            aria-invalid={!!errors.description}
            className={`input resize-y ${errors.description ? 'input-error' : ''}`}
          />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>

        <div>
          <label className="label" htmlFor="et-priority">Priority</label>
          <Select id="et-priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={[...PRIORITIES.map((p) => ({ value: String(p.value), label: `${p.label}` }))]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="et-start">Start date</label>
            <input
              id="et-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="et-deadline">Deadline</label>
            <input
              id="et-deadline"
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
          <label className="label" htmlFor="et-notes">Additional notes</label>
          <textarea
            id="et-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Optional"
            className="input resize-y"
          />
        </div>
      </form>
    </Modal>
  );
}
