import { useEffect, useState, type FormEvent } from 'react';
import { FolderPlus } from 'lucide-react';
import { projectApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import type { Project } from '../types';

/** Derives a sensible key from the name: "Internal Platform" -> "INPLA". */
function suggestKey(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase();
  // First two letters of the first word, then three of the second — short but distinct.
  return `${words[0].slice(0, 2)}${words[1].slice(0, 3)}`.toUpperCase();
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function CreateProjectModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setKey('');
    setKeyTouched(false);
    setDescription('');
    setErrors({});
  }, [open]);

  // Suggest a key while the user types the name, but stop the moment they edit it
  // themselves — an auto-suggestion should never overwrite a deliberate choice.
  const handleName = (value: string) => {
    setName(value);
    if (!keyTouched) setKey(suggestKey(value));
  };

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
      const { data } = await projectApi.create({
        name: name.trim(),
        key: normalised,
        description: description.trim() || undefined,
      });
      toast.success(data.message);
      onCreated(data.project);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not create the project.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="Tasks are grouped into projects and numbered from the project key."
      size="sm"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="create-project-form" disabled={submitting} className="btn-primary">
            {submitting ? <><Spinner className="h-4 w-4" /> Creating…</> : <><FolderPlus className="h-4 w-4" /> Create project</>}
          </button>
        </div>
      )}
    >
      <form id="create-project-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="p-name">Project name <span className="text-destructive">*</span></label>
          <input
            id="p-name"
            value={name}
            onChange={(e) => handleName(e.target.value)}
            maxLength={120}
            placeholder="Project name"
            autoFocus
            aria-invalid={!!errors.name}
            className={`input ${errors.name ? 'input-error' : ''}`}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="p-key">Project key <span className="text-destructive">*</span></label>
          <input
            id="p-key"
            value={key}
            onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase()); }}
            maxLength={10}
            placeholder="SHMOB"
            aria-invalid={!!errors.key}
            className={`input font-mono uppercase ${errors.key ? 'input-error' : ''}`}
          />
          {errors.key
            ? <p className="field-error">{errors.key}</p>
            : (
              <p className="hint">
                Tasks will be numbered {key ? <span className="font-mono">{key}-1</span> : 'KEY-1'}, and so on.
                The key cannot be changed later.
              </p>
            )}
        </div>

        <div>
          <label className="label" htmlFor="p-desc">Description</label>
          <textarea
            id="p-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What this project covers (optional)"
            className="input resize-y"
          />
        </div>
      </form>
    </Modal>
  );
}
