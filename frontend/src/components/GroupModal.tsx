import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Users } from 'lucide-react';
import { Avatar, Modal, Spinner } from './ui';
import { roleLabel, type ChatContact } from '../types';

/**
 * Create a group, or rename one.
 *
 * One dialog for both because they are the same form minus a field — a group is a
 * name and a set of people, and renaming simply leaves the set alone. Keeping them
 * together means the name rules, the error handling and the busy state are written
 * once rather than drifting apart in two nearly identical files.
 *
 * Admin-only, but that is not enforced here: the launcher only offers it to admins
 * and the API refuses everybody else. This component is the form, not the gate.
 */
export function GroupModal({
  open, mode, contacts, initialName = '', busy = false, error, onClose, onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'rename';
  contacts: ChatContact[];
  initialName?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (name: string, memberIds: number[]) => void;
}) {
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);

  // Reopening starts from the group being edited rather than from whatever was left
  // in the box last time.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setPicked([]);
    setSearch('');
    setTouched(false);
  }, [open, initialName]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle));
  }, [contacts, search]);

  const toggle = (id: number) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const trimmed = name.trim();
  const nameInvalid = touched && !trimmed;
  const membersInvalid = touched && mode === 'create' && picked.length === 0;
  const canSubmit = !!trimmed && (mode === 'rename' || picked.length > 0) && !busy;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(trimmed, picked);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'New group' : 'Rename group'}
      description={mode === 'create'
        ? 'Give it a name and choose who is in it. Everyone added can read and post.'
        : 'Only the name changes — who is in the group stays as it is.'}
      size="sm"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={!canSubmit}>
            {busy && <Spinner className="h-4 w-4" />}
            {mode === 'create' ? 'Create group' : 'Save name'}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            maxLength={80}
            placeholder="e.g. Release crew"
            aria-invalid={nameInvalid || undefined}
            className={`input ${nameInvalid ? 'input-error' : ''}`}
          />
          {nameInvalid && <p className="field-error">Give the group a name.</p>}
        </div>

        {mode === 'create' && (
          <div>
            <p className="label">
              Members
              <span className="ml-1 font-normal text-muted-foreground">
                ({picked.length} selected — you are included automatically)
              </span>
            </p>

            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people…"
                aria-label="Search people to add"
                className="input pl-9"
              />
            </div>

            <div className={`max-h-56 overflow-y-auto rounded-lg border ${membersInvalid ? 'border-destructive' : 'border-border'}`}>
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nobody matches that.</p>
              ) : (
                <ul>
                  {visible.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <li key={c.id}>
                        {/*
                          A button with aria-pressed rather than a checkbox: the whole
                          row is the target, which is far easier to hit than a 16px box,
                          and the state is still announced.
                        */}
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(c.id)}
                          className={`flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 ${
                            on ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                        >
                          <Avatar name={c.name} src={c.profile_image} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {roleLabel(c.role)}{c.department ? ` · ${c.department}` : ''}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                            }`}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {membersInvalid && <p className="field-error">Pick at least one person.</p>}
          </div>
        )}

        {mode === 'create' && picked.length > 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            {picked.length + 1} people will be in this group, including you.
          </p>
        )}

        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
