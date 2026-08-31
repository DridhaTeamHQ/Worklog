import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, KeyRound, AlertCircle, MailCheck } from 'lucide-react';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../components/RouteGuards';
import { Spinner } from '../../components/ui';

/**
 * Where an invited person chooses their first password.
 *
 * Reached from the "Invited" button on the sign-in page, which only appears for an
 * address the server has confirmed is a pending invite. The check is repeated here on
 * mount, because this page can also be opened directly by its URL — and a stale or
 * made-up address must not be offered a password box.
 */
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  const email = (params.get('email') || '').trim().toLowerCase();

  const [checking, setChecking] = useState(true);
  const [invitedName, setInvitedName] = useState<string | undefined>();
  const [valid, setValid] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!email) { setChecking(false); return undefined; }

    const controller = new AbortController();
    // The body handles every outcome itself, so the promise is intentionally
    // not awaited.
    void (async () => {
      try {
        const { data } = await authApi.inviteStatus(email, controller.signal);
        setValid(data.invited);
        setInvitedName(data.name);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setValid(false);
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    })();

    return () => controller.abort();
  }, [email]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (password !== confirm) { setError('Both passwords must match.'); return; }

    setSubmitting(true);
    try {
      const { data } = await authApi.acceptInvite(email, password);
      // The server signs them in as part of claiming the invite, so they land on their
      // own portal rather than being sent back to type the password they just chose.
      adoptSession(data.token, data.user);
      navigate(homeFor(data.user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckSquare className="h-6 w-6" />
          </span>
          <span className="text-lg font-bold leading-tight text-foreground">Taskr</span>
        </div>

        <div className="card p-6 sm:p-8">
          {checking && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Checking your invitation…
            </div>
          )}

          {/*
            One message for every way this can fail — no invite, already claimed,
            deactivated, or a made-up address — so the page cannot be used to find out
            which addresses exist.
          */}
          {!checking && !valid && (
            <div className="text-center">
              <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
                <AlertCircle className="h-7 w-7" />
              </span>
              <h1 className="display-title text-2xl text-foreground">No invitation waiting</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                There is no unclaimed invitation for{email ? ' that address' : ' this link'}. If you
                have already set a password, sign in as usual — or use "Forgot password?" if you
                cannot remember it.
              </p>
              <Link to="/login" className="btn-primary mt-6 w-full">Back to sign in</Link>
            </div>
          )}

          {!checking && valid && (
            <>
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-3.5 py-3">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {invitedName ? `Welcome, ${invitedName}` : 'Welcome to Taskr'}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-primary-strong">{email}</p>
                </div>
              </div>

              <h1 className="display-title text-2xl text-foreground">Set your password</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Choose a password for your account. You will use it to sign in from now on.
              </p>

              {error && (
                <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-3.5 py-3" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
                  <p className="text-sm font-medium text-primary-strong">{error}</p>
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="new-password">Password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="confirm-password">Confirm password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className="input"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting
                    ? <><Spinner className="h-4 w-4" /> Setting up…</>
                    : <><KeyRound className="h-4 w-4" /> Set password and sign in</>}
                </button>
              </form>
            </>
          )}
        </div>

        <Link
          to="/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
