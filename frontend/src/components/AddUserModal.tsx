import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, CircleCheck, MailCheck, MailWarning, Copy, Check } from 'lucide-react';
import { adminApi, teamApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import type { Role, User } from '../types';
import { isManagerLevel } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (user: User) => void;
  /** Which kind of account to create. Drives the endpoint and all of the copy. */
  role: Role;
  /** Existing departments, offered as suggestions rather than a closed list. */
  departments?: string[];
}

/** Copy differs enough between the two that it is worth stating rather than templating. */
const COPY = {
  team_member: {
    title: 'Add a team member',
    description: 'Creates their account and invites them to set their own password.',
    submit: 'Add team member',
    submitting: 'Adding…',
    namePlaceholder: 'Full name',
    titlePlaceholder: 'e.g. Backend Engineer',
    deptPlaceholder: 'e.g. Development',
    successTitle: 'Team member invited',
    failMessage: 'Could not add the team member.',
  },
  manager: {
    title: 'Add a manager',
    description: 'Creates an account with manager access and invites them to set their own password.',
    submit: 'Add manager',
    submitting: 'Adding…',
    namePlaceholder: 'Full name',
    titlePlaceholder: 'e.g. Delivery Manager',
    deptPlaceholder: 'e.g. Management',
    successTitle: 'Manager invited',
    failMessage: 'Could not add the manager.',
  },
  admin: {
    title: 'Add an admin',
    description: 'Creates an account with full administrative access, including the right to grant admin access to others.',
    submit: 'Add admin',
    submitting: 'Adding…',
    namePlaceholder: 'Full name',
    titlePlaceholder: 'e.g. Administrator',
    deptPlaceholder: 'e.g. Management',
    successTitle: 'Admin invited',
    failMessage: 'Could not add the admin.',
  },
} as const;

export function AddUserModal({ open, onClose, onCreated, role, departments = [] }: Props) {
  const toast = useToast();
  const copy = COPY[role];
  // Both elevated tiers go through /api/admins; the role travels in the payload.
  const isElevated = isManagerLevel(role);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Set once the account exists, so the modal can confirm who was invited. */
  const [invited, setInvited] = useState<{ user: User; emailed: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setDepartment('');
    setJobTitle('');
    setPhone('');
    setErrors({});
    setInvited(null);
    setCopied(false);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter their full name.';
    if (!email.trim()) next.email = 'Enter their work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    // Required for an employee, whose roster row is filtered and grouped by both.
    // The elevated tiers do not appear in those views, so they stay optional there.
    if (!isElevated) {
      if (!department.trim()) next.department = 'Enter their department.';
      if (!jobTitle.trim()) next.jobTitle = 'Enter their job title.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      const { data } = isElevated
        ? await adminApi.create({ ...payload, role })
        : await teamApi.create(payload);
      const createdUser = 'admin' in data ? data.admin : data.employee;
      toast.success(data.message);
      onCreated(createdUser);
      // Stay open on a confirmation screen: when no invite email went out, the manager
      // is the one who has to tell them the account is waiting.
      setInvited({ user: createdUser, emailed: data.email?.delivered ?? false });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error(copy.failMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyInstructions = async () => {
    if (!invited) return;
    try {
      await navigator.clipboard.writeText(
        [
          `You have been added to Taskr.`,
          `Open ${window.location.origin}/login and enter your work email:`,
          invited.user.email,
          `Then click the "Invited" button that appears and choose your own password.`,
        ].join('\n'),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  if (invited) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={copy.successTitle}
        description="They choose their own password the first time they open the portal."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-primary">Done</button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900">
                {invited.user.name} has been invited{isElevated ? ` as ${role === 'admin' ? 'an admin' : 'a manager'}` : ''}
              </p>
              <p className="mt-0.5 text-sm text-emerald-800">
                No password has been set. They enter their email on the sign-in page,
                click <span className="font-semibold">Invited</span>, and choose one themselves.
              </p>
            </div>
          </div>

          {/*
            Says plainly whether the invite left the building. If it did not, the manager
            needs to know to tell them themselves rather than assume it landed.
          */}
          {invited.emailed ? (
            <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <p className="min-w-0 text-sm text-ink-700">
                An invitation has been sent to{' '}
                <span className="font-medium text-ink-900">{invited.user.email}</span>.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">No invitation email was sent</p>
                <p className="mt-0.5 text-sm text-amber-800">
                  Email is not configured on this server, so you will need to let them
                  know their account is ready.
                </p>
              </div>
            </div>
          )}

          <dl className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-500">Signs in with</dt>
              <dd className="font-mono text-ink-900">{invited.user.email}</dd>
            </div>
          </dl>

          <button type="button" onClick={copyInstructions} className="btn-secondary w-full">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy sign-in instructions</>}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="add-member-form" disabled={submitting} className="btn-primary">
            {submitting
              ? <><Spinner className="h-4 w-4" /> {copy.submitting}</>
              : <><UserPlus className="h-4 w-4" /> {copy.submit}</>}
          </button>
        </div>
      )}
    >
      <form id="add-member-form" onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="m-name">Full name <span className="text-red-500">*</span></label>
          <input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder={copy.namePlaceholder}
            autoFocus
            aria-invalid={!!errors.name}
            className={`input ${errors.name ? 'input-error' : ''}`}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label className="label" htmlFor="m-email">Work email <span className="text-red-500">*</span></label>
          <input
            id="m-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={190}
            placeholder="name@company.com"
            aria-invalid={!!errors.email}
            className={`input ${errors.email ? 'input-error' : ''}`}
          />
          {errors.email
            ? <p className="field-error">{errors.email}</p>
            : <p className="hint">This is the username they sign in with.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-dept">
              Department {!isElevated && <span className="text-red-500">*</span>}
            </label>
            <input
              id="m-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              list="department-suggestions"
              maxLength={120}
              placeholder={copy.deptPlaceholder}
              aria-invalid={!!errors.department}
              className={`input ${errors.department ? 'input-error' : ''}`}
            />
            <datalist id="department-suggestions">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
            {errors.department && <p className="field-error">{errors.department}</p>}
          </div>
          <div>
            <label className="label" htmlFor="m-title">
              Job title {!isElevated && <span className="text-red-500">*</span>}
            </label>
            <input
              id="m-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={120}
              placeholder={copy.titlePlaceholder}
              aria-invalid={!!errors.jobTitle}
              className={`input ${errors.jobTitle ? 'input-error' : ''}`}
            />
            {errors.jobTitle && <p className="field-error">{errors.jobTitle}</p>}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="m-phone">Phone</label>
          <input
            id="m-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="Optional"
            className="input"
          />
        </div>

        <p className="hint">
          No password is set here. {name.trim().split(/\s+/)[0] || 'They'} will choose their own
          the first time they open the portal.
        </p>
      </form>
    </Modal>
  );
}
