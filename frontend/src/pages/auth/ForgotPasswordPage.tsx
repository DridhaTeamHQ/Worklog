import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, MailCheck, KeyRound, AlertCircle } from 'lucide-react';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Spinner } from '../../components/ui';

type Stage = 'request' | 'sent' | 'reset' | 'done';

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Arriving from the link in a reset email: jump straight to choosing a new password
  // with the token already filled in.
  useEffect(() => {
    const fromLink = params.get('token');
    if (fromLink) {
      setToken(fromLink);
      setStage('reset');
    }
  }, [params]);

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Enter your email address.'); return; }

    setSubmitting(true);
    try {
      const { data } = await authApi.forgotPassword(email.trim());
      setMessage(data.message);
      // In development the API hands back the token so the flow can be completed
      // without a mail server; in production it only ever arrives by email.
      if (data.devResetToken) {
        setToken(data.devResetToken);
        setStage('reset');
      } else {
        setStage('sent');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirm) { setError('Both passwords must match.'); return; }

    setSubmitting(true);
    try {
      const { data } = await authApi.resetPassword(token.trim(), password);
      setMessage(data.message);
      setStage('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-100 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CheckSquare className="h-6 w-6" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold text-ink-900">Dridha Technologies</span>
            <span className="text-sm text-ink-500">Worklog</span>
          </span>
        </div>

        <div className="card p-6 sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {stage === 'request' && (
            <>
              <h1 className="text-xl font-bold text-ink-900">Forgot your password?</h1>
              <p className="mt-1.5 text-sm text-ink-500">
                Enter your company email and we'll send you a link to set a new one.
              </p>
              <form onSubmit={requestReset} className="mt-6 space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="reset-email">Email address</label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? <><Spinner className="h-4 w-4" /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          {stage === 'sent' && (
            <div className="text-center">
              <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MailCheck className="h-7 w-7" />
              </span>
              <h1 className="text-xl font-bold text-ink-900">Check your inbox</h1>
              <p className="mt-2 text-sm text-ink-500">{message}</p>
              <button type="button" onClick={() => setStage('reset')} className="btn-secondary mt-6 w-full">
                I have a reset code
              </button>
            </div>
          )}

          {stage === 'reset' && (
            <>
              <h1 className="text-xl font-bold text-ink-900">Set a new password</h1>
              <p className="mt-1.5 text-sm text-ink-500">
                Paste the reset code you received and choose a new password.
              </p>
              <form onSubmit={submitReset} className="mt-6 space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="token">Reset code</label>
                  <input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste your reset code"
                    className="input font-mono text-xs"
                  />
                  {!import.meta.env.PROD && (
                    <p className="hint">Filled in automatically in development.</p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="input"
                  />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? <><Spinner className="h-4 w-4" /> Updating…</> : <><KeyRound className="h-4 w-4" /> Update password</>}
                </button>
              </form>
            </>
          )}

          {stage === 'done' && (
            <div className="text-center">
              <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MailCheck className="h-7 w-7" />
              </span>
              <h1 className="text-xl font-bold text-ink-900">Password updated</h1>
              <p className="mt-2 text-sm text-ink-500">{message}</p>
              <Link to="/login" className="btn-primary mt-6 w-full">Back to sign in</Link>
            </div>
          )}
        </div>

        <Link
          to="/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
