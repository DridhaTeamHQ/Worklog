import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { teamApi, type EditTeamMemberInput } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import type { TeamMember, User } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The member being edited, or null when the modal is closed. */
  member: TeamMember | null;
  onSaved: (user: User) => void;
  /** Existing departments, offered as suggestions rather than a closed list. */
  departments?: string[];
}

/**
 * Admin-only edit of a team member's account details.
 *
 * Only the fields that actually moved are sent, so a save can never blank something
 * the admin did not touch. There is no password field on purpose: no one but the
 * account's owner ever sets its password — they choose it when they claim their
 * invite, and change it from their profile after that.
 *
 * Department and job title are required here for the same reason they are required
 * when inviting: the roster is filtered and grouped by both, so a blank one leaves a
 * hole in every team view.
 */
export function EditTeamMemberModal({ open, onClose, member, onSaved, departments = [] }: Props) {
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Refill from the member each time the modal opens, so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open || !member) return;
    setName(member.name);
    setEmail(member.email);
    setDepartment(member.department ?? '');
    setJobTitle(member.job_title ?? '');
    setPhone(member.phone ?? '');
    setIsActive(member.is_active);
    setErrors({});
  }, [open, member]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!member) return;

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter their full name.';
    if (!email.trim()) next.email = 'Enter their work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!department.trim()) next.department = 'Enter their department.';
    if (!jobTitle.trim()) next.jobTitle = 'Enter their job title.';
    setErrors(next);
    if (Object.keys(next).length) return;

    // Send only what moved; an unchanged field is left out entirely.
    const patch: EditTeamMemberInput = {};
    if (name.trim() !== member.name) patch.name = name.trim();
    if (email.trim().toLowerCase() !== member.email.toLowerCase()) patch.email = email.trim().toLowerCase();
    if (department.trim() !== (member.department ?? '')) patch.department = department.trim();
    if (jobTitle.trim() !== (member.job_title ?? '')) patch.jobTitle = jobTitle.trim();
    if (phone.trim() !== (member.phone ?? '')) patch.phone = phone.trim();
    if (isActive !== member.is_active) patch.isActive = isActive;

    // Nothing moved — closing quietly is more honest than a "saved" toast.
    if (Object.keys(patch).length === 0) { onClose(); return; }

    setSaving(true);
    try {
      const { data } = await teamApi.update(member.id, patch);
      toast.success(`${data.name}'s details have been updated.`);
      onSaved(data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save the changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open && Boolean(member)}
      onClose={onClose}
      title="Edit team member"
      description="Updates their account details. Their password is untouched."
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="edit-member-form" disabled={saving} className="btn-primary">
            {saving
              ? <><Spinner className="h-4 w-4" /> Saving…</>
              : <><Save className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      )}
    >
      <form id="edit-member-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="e-name">Full name <span className="text-destructive">*</span></label>
          <input
            id="e-name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            maxLength={120}
            autoFocus
            aria-invalid={!!errors.name}
            className={`input ${errors.name ? 'input-error' : ''}`}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="e-email">Work email <span className="text-destructive">*</span></label>
          <input
            id="e-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            maxLength={190}
            aria-invalid={!!errors.email}
            className={`input ${errors.email ? 'input-error' : ''}`}
          />
          {errors.email
            ? <p className="field-error">{errors.email}</p>
            : <p className="hint">This is the address they sign in with.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="e-dept">Department <span className="text-destructive">*</span></label>
            <input
              id="e-dept"
              value={department}
              onChange={(ev) => setDepartment(ev.target.value)}
              list="edit-department-suggestions"
              maxLength={120}
              placeholder="e.g. Development"
              aria-invalid={!!errors.department}
              className={`input ${errors.department ? 'input-error' : ''}`}
            />
            <datalist id="edit-department-suggestions">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
            {errors.department && <p className="field-error">{errors.department}</p>}
          </div>
          <div>
            <label className="label" htmlFor="e-title">Job title <span className="text-destructive">*</span></label>
            <input
              id="e-title"
              value={jobTitle}
              onChange={(ev) => setJobTitle(ev.target.value)}
              maxLength={120}
              placeholder="e.g. Backend Engineer"
              aria-invalid={!!errors.jobTitle}
              className={`input ${errors.jobTitle ? 'input-error' : ''}`}
            />
            {errors.jobTitle && <p className="field-error">{errors.jobTitle}</p>}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="e-phone">Phone</label>
          <input
            id="e-phone"
            value={phone}
            onChange={(ev) => setPhone(ev.target.value)}
            maxLength={40}
            placeholder="Optional"
            className="input"
          />
        </div>

        {/* The softer alternative to removing them: the account stops signing in, but
            their tasks, reports and tickets all stay where they are. */}
        <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(ev) => setIsActive(ev.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Account is active</span>
            <span className="block text-xs text-muted-foreground">
              Turn this off to stop them signing in. Their work is kept.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
