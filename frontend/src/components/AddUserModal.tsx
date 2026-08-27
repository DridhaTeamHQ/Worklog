import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, RefreshCw, Copy, Check, CircleCheck, MailCheck, MailWarning } from 'lucide-react';
import { adminApi, teamApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal, Spinner } from './ui';
import type { Role, User } from '../types';
import { isManagerLevel } from '../types';

/**
 * Generates a readable temporary password. Ambiguous characters (O/0, l/1) are left out
 * because this gets read aloud or typed from a note more often than it gets pasted.
 */
function generatePassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*';
  const all = upper + lower + digits + symbols;

  const pick = (set: string, count: number) => {
    const values = new Uint32Array(count);
    crypto.getRandomValues(values);
    return Array.from(values, (v) => set[v % set.length]).join('');
  };

  // Guarantee one of each class, then shuffle so the classes are not in a fixed order.
  const seed = pick(upper, 1) + pick(lower, 5) + pick(digits, 3) + pick(symbols, 1) + pick(all, 4);
  const chars = seed.split('');
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = order[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

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
    description: 'Creates their account so they can sign in to the team member portal.',
    submit: 'Add team member',
    submitting: 'Adding…',
    namePlaceholder: 'e.g. Rahul Kumar',
    titlePlaceholder: 'e.g. Backend Engineer',
    deptPlaceholder: 'e.g. Development',
    successTitle: 'Team member added',
    failMessage: 'Could not add the team member.',
  },
  manager: {
    title: 'Add a manager',
    description: 'Creates an account with manager access to this portal.',
    submit: 'Add manager',
    submitting: 'Adding…',
    namePlaceholder: 'e.g. Vikram Rao',
    titlePlaceholder: 'e.g. Delivery Manager',
    deptPlaceholder: 'e.g. Management',
    successTitle: 'Manager added',
    failMessage: 'Could not add the manager.',
  },
  admin: {
    title: 'Add an admin',
    description: 'Creates an account with full administrative access, including the right to grant admin access to others.',
    submit: 'Add admin',
    submitting: 'Adding…',
    namePlaceholder: 'e.g. Vikram Rao',
    titlePlaceholder: 'e.g. Administrator',
    deptPlaceholder: 'e.g. Management',
    successTitle: 'Admin added',
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
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Set once the account exists, so the modal can hand over the credentials. */
  const [createdWith, setCreatedWith] = useState<
    { user: User; password: string; emailed: boolean } | null
  >(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPassword(generatePassword());
    setDepartment('');
    setJobTitle('');
    setPhone('');
    setErrors({});
    setCreatedWith(null);
    setCopied(false);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter their full name.';
    if (!email.trim()) next.email = 'Enter their work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
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
      // Stay open on a success screen: the password is not recoverable later, so the
      // manager needs a chance to copy it before this closes.
      setCreatedWith({ user: createdUser, password, emailed: data.email?.delivered ?? false });
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

  const copyCredentials = async () => {
    if (!createdWith) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${createdWith.user.email}\nTemporary password: ${createdWith.password}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  if (createdWith) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={copy.successTitle}
        description={createdWith.emailed
          ? 'They have been emailed their sign-in details. The password is not shown again.'
          : 'Share these sign-in details with them. The password is not shown again.'}
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
                {createdWith.user.name} can now sign in{isElevated ? ` as ${role === 'admin' ? 'an admin' : 'a manager'}` : ''}
              </p>
              <p className="mt-0.5 text-sm text-emerald-800">
                They can change this password from their profile at any time.
              </p>
            </div>
          </div>

          {/*
            Says plainly whether the email left the building. If it did not, the manager
            needs to know to pass the password on themselves rather than assume it landed.
          */}
          {createdWith.emailed ? (
            <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <p className="min-w-0 text-sm text-ink-700">
                A welcome email with these details has been sent to{' '}
                <span className="font-medium text-ink-900">{createdWith.user.email}</span>.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">No welcome email was sent</p>
                <p className="mt-0.5 text-sm text-amber-800">
                  Email is not configured on this server, so you will need to pass these
                  details on yourself.
                </p>
              </div>
            </div>
          )}

          <dl className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-mono text-ink-900">{createdWith.user.email}</dd>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-500">Temporary password</dt>
              <dd className="font-mono font-semibold text-ink-900">{createdWith.password}</dd>
            </div>
          </dl>

          <button type="button" onClick={copyCredentials} className="btn-secondary w-full">
            {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy sign-in details</>}
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

        <div>
          <label className="label" htmlFor="m-password">Temporary password <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              id="m-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={200}
              aria-invalid={!!errors.password}
              className={`input font-mono ${errors.password ? 'input-error' : ''}`}
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="btn-secondary shrink-0"
              title="Generate a new password"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Generate</span>
            </button>
          </div>
          {errors.password
            ? <p className="field-error">{errors.password}</p>
            : <p className="hint">You'll be shown this once more so you can pass it on.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-dept">Department</label>
            <input
              id="m-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              list="department-suggestions"
              maxLength={120}
              placeholder={copy.deptPlaceholder}
              className="input"
            />
            <datalist id="department-suggestions">
              {departments.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="m-title">Job title</label>
            <input
              id="m-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={120}
              placeholder={copy.titlePlaceholder}
              className="input"
            />
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
      </form>
    </Modal>
  );
}
