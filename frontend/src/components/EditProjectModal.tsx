import { useEffect, useState, type FormEvent } from 'react';
import { Save, AlertTriangle, Archive, ArchiveRestore } from 'lucide-react';
import { projectApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import type { Project } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  onSaved: (project: Project) => void;
}

export function EditProjectModal({ open, onClose, project, onSaved }: Props) {
  const toast = useToast();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setKey(project.project_key);
    setDescription(project.description ?? '');
    setErrors({});
  }, [open, project]);

  if (!project) return null;

  const keyChanged = key.trim().toUpperCase() !== project.project_key;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the project a name.';
    const normalised = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalised.length < 2) next.key = 'Use at least 2 letters or digits.';
    else if (!/^[A-Z]/.test(normalised)) next.key = 'The key must start with a letter.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { data } = await projectApi.update(project.id, {
        name: name.trim(),
        key: normalised,
        description: description.trim() || null,
      });
      toast.success(`${data.name} updated.`);
      onSaved(data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the project.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async () => {
    setArchiving(true);
    try {
      const { data } = await projectApi.update(project.id, { isArchived: !project.is_archived });
      toast.success(data.is_archived
        ? `${data.name} archived. Its tasks stay readable, but no new ones can be added.`
        : `${data.name} restored.`);
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change the project.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit project"
      description="Fix a name or key here. Changes apply everywhere immediately."
      size="sm"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="edit-project-form" disabled={submitting} className="btn-primary">
            {submitting ? <><Spinner className="h-4 w-4" /> Saving…</> : <><Save className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      )}
    >
      <form id="edit-project-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="ep-name">Project name <span className="text-red-500">*</span></label>
          <input
            id="ep-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            aria-invalid={!!errors.name}
            className={`input ${errors.name ? 'input-error' : ''}`}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="ep-key">Project key <span className="text-red-500">*</span></label>
          <input
            id="ep-key"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            maxLength={10}
            aria-invalid={!!errors.key}
            className={`input font-mono uppercase ${errors.key ? 'input-error' : ''}`}
          />
          {errors.key && <p className="field-error">{errors.key}</p>}

          {/*
            Renaming the key is safe for the data — task keys are composed at read time,
            so the numbers stay put — but anyone holding an old key needs to know.
          */}
          {keyChanged && !errors.key && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-xs text-amber-900">
                Every task in this project will be renumbered under the new key —{' '}
                <span className="font-mono font-semibold">{project.project_key}-1</span> becomes{' '}
                <span className="font-mono font-semibold">{key.trim().toUpperCase()}-1</span>.
                Task numbers stay the same, but links or notes using the old key will be out of date.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="ep-desc">Description</label>
          <textarea
            id="ep-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What this project covers (optional)"
            className="input resize-y"
          />
        </div>

        <div className="border-t border-ink-200 pt-4">
          <p className="text-sm font-medium text-ink-700">
            {project.is_archived ? 'This project is archived' : 'Archive this project'}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {project.is_archived
              ? 'Restore it to start assigning tasks to it again.'
              : `Its ${project.counts.total} task${project.counts.total === 1 ? '' : 's'} stay readable, but no new ones can be added.`}
          </p>
          <button
            type="button"
            onClick={toggleArchive}
            disabled={archiving}
            className="btn-secondary mt-2.5"
          >
            {archiving
              ? <><Spinner className="h-4 w-4" /> Working…</>
              : project.is_archived
                ? <><ArchiveRestore className="h-4 w-4" /> Restore project</>
                : <><Archive className="h-4 w-4" /> Archive project</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
