import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { authApi, profileApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { useToast } from '../components/Toast';
import { Avatar, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../lib/format';

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setDepartment(user.department ?? '');
    setJobTitle(user.job_title ?? '');
    setPhone(user.phone ?? '');
  }, [user]);

  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    if (!name.trim()) { setProfileErrors({ name: 'Your name cannot be empty.' }); return; }

    setSavingProfile(true);
    try {
      await profileApi.update({
        name: name.trim(),
        department: department.trim() || null,
        jobTitle: jobTitle.trim() || null,
        phone: phone.trim() || null,
      });
      await refresh();
      toast.success('Your profile has been updated.');
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileErrors(err.fieldErrors);
        toast.error(err.message);
      } else {
        toast.error('Could not save your profile.');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) { setPasswordError('Enter your current password.'); return; }
    if (newPassword.length < 8) { setPasswordError('Use at least 8 characters for your new password.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Both new password fields must match.'); return; }

    setSavingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Your password has been changed.');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not change your password.';
      setPasswordError(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle="Your account details and sign-in security." />

      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={user.name} src={user.profile_image} size="xl" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink-900">{user.name}</h2>
            <p className="truncate text-sm text-ink-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge border-brand-200 bg-brand-50 text-brand-700">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {user.role === 'manager' ? 'Manager / Admin' : 'Team Member'}
              </span>
              {user.department && (
                <span className="badge border-ink-200 bg-ink-100 text-ink-600">{user.department}</span>
              )}
              <span className="text-xs text-ink-400">Joined {formatDate(user.created_at)}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <header className="border-b border-ink-200 px-5 py-4">
            <h2 className="font-semibold text-ink-900">Personal details</h2>
            <p className="text-xs text-ink-500">Your email and role are managed by your administrator.</p>
          </header>
          <form onSubmit={saveProfile} className="space-y-4 p-5" noValidate>
            <div>
              <label className="label" htmlFor="p-name">Full name</label>
              <input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`input ${profileErrors.name ? 'input-error' : ''}`}
              />
              {profileErrors.name && <p className="field-error">{profileErrors.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="p-email">Email address</label>
              <input id="p-email" value={user.email} disabled className="input" />
              <p className="hint">Contact your administrator to change this.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="p-dept">Department</label>
                <input id="p-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="input" placeholder="e.g. Development" />
              </div>
              <div>
                <label className="label" htmlFor="p-title">Job title</label>
                <input id="p-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input" placeholder="e.g. Backend Engineer" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="p-phone">Phone</label>
              <input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="Optional" />
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? <><Spinner className="h-4 w-4" /> Saving…</> : <><Save className="h-4 w-4" /> Save changes</>}
            </button>
          </form>
        </section>

        <section className="card self-start">
          <header className="border-b border-ink-200 px-5 py-4">
            <h2 className="font-semibold text-ink-900">Change password</h2>
            <p className="text-xs text-ink-500">Use at least 8 characters.</p>
          </header>
          <form onSubmit={savePassword} className="space-y-4 p-5" noValidate>
            {passwordError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700" role="alert">
                {passwordError}
              </p>
            )}
            <div>
              <label className="label" htmlFor="p-current">Current password</label>
              <input
                id="p-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-new">New password</label>
              <input
                id="p-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-confirm">Confirm new password</label>
              <input
                id="p-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword ? <><Spinner className="h-4 w-4" /> Updating…</> : <><KeyRound className="h-4 w-4" /> Change password</>}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
