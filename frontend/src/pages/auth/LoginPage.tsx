import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, LogIn, CheckSquare, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { homeFor } from '../../components/RouteGuards';
import { Spinner } from '../../components/ui';

/** Long enough that typing an address is one request, short enough to feel immediate. */
const INVITE_CHECK_DELAY_MS = 450;

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  /** Set when the typed address is an account a manager added that nobody has claimed. */
  const [invite, setInvite] = useState<{ email: string; name?: string } | null>(null);
  const inviteRequest = useRef<AbortController | null>(null);

  /*
   * Watches the email field and asks the server whether that address is a pending
   * invite. Debounced so typing an address is one request rather than one per
   * keystroke, and the in-flight request is aborted whenever the value moves on, so a
   * slow answer for an old address can never overwrite the answer for the current one.
   */
  useEffect(() => {
    const typed = email.trim().toLowerCase();
    inviteRequest.current?.abort();

    if (!looksLikeEmail(typed)) {
      setInvite(null);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      // The body handles every outcome itself, so the promise is intentionally
      // not awaited.
      void (async () => {
        const controller = new AbortController();
        inviteRequest.current = controller;
        try {
          const { data } = await authApi.inviteStatus(typed, controller.signal);
          setInvite(data.invited ? { email: typed, name: data.name } : null);
        } catch {
          // An aborted, rate-limited or failed check simply means no button. Signing
          // in normally still works, so there is nothing useful to say here.
          setInvite(null);
        }
      })();
    }, INVITE_CHECK_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      inviteRequest.current?.abort();
    };
  }, [email]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!email.trim() || !password) {
      setFieldErrors({
        ...(email.trim() ? {} : { email: 'Enter your email address.' }),
        ...(password ? {} : { password: 'Enter your password.' }),
      });
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      // The role decides the destination — there is no shared landing page.
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — decorative, so it steps aside entirely on small screens. */}
      <div className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #4f46e5 0%, transparent 45%), radial-gradient(circle at 80% 70%, #6366f1 0%, transparent 40%)' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CheckSquare className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold leading-tight text-white">Taskr</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight text-white">
            Track the work.<br />Not the paperwork.
          </h2>
          <p className="mt-4 max-w-md text-ink-300">
            One place for daily work reports, assigned tasks and team progress — so nobody has to
            chase a status update again.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'Submit and edit your daily task report in seconds',
              'See every task assigned to you, with deadlines and priority',
              'Managers get live progress across the whole team',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-ink-300">
                <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-500">
          © {new Date().getFullYear()} Taskr. Internal use only.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <CheckSquare className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold leading-tight text-ink-900">Taskr</span>
          </div>

          <h1 className="text-2xl font-bold text-ink-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-500">Use your company account to continue.</p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                aria-invalid={!!fieldErrors.email}
                className={`input ${fieldErrors.email ? 'input-error' : ''}`}
              />
              {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
            </div>

            {/*
              Only rendered for an address the server confirmed is a pending invite.
              It replaces nothing — signing in normally is still right there — but it
              is the only route in for someone who has never set a password.
            */}
            {invite && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-900">
                      {invite.name ? `Welcome, ${invite.name}` : 'You have been invited'}
                    </p>
                    <p className="mt-0.5 text-sm text-brand-800">
                      Your account is ready but has no password yet.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/set-password?email=${encodeURIComponent(invite.email)}`)}
                  className="btn-primary mt-3 w-full"
                >
                  Invited — set your password
                </button>
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  aria-invalid={!!fieldErrors.password}
                  className={`input pr-11 ${fieldErrors.password ? 'input-error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <><Spinner className="h-4 w-4" /> Signing in…</> : <><LogIn className="h-4 w-4" /> Login</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
