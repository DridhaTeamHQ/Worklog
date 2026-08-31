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
      <div className="relative hidden overflow-hidden bg-foreground lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-12">
        {/*
          One coral block on the near-black, and nothing else. A second colour here
          would be the loudest thing in the product sitting on the first screen anyone
          sees, and it would not be saying anything.
        */}
        <div aria-hidden className="absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-primary/90" />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckSquare className="h-6 w-6" />
          </span>
          <span className="display-title text-2xl leading-tight text-background">Taskr</span>
        </div>

        <div className="relative">
          <h2 className="display-title text-4xl text-background xl:text-5xl">
            Track the work.<br />Not the paperwork.
          </h2>
          <p className="mt-5 max-w-md text-sidebar-foreground">
            One place for daily work reports, assigned tasks and team progress — so nobody has to
            chase a status update again.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'Submit and edit your daily task report in seconds',
              'See every task assigned to you, with deadlines and priority',
              'Managers get live progress across the whole team',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-sidebar-foreground">
                <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/70">
          © {new Date().getFullYear()} Taskr. Internal use only.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-muted px-5 py-10 sm:px-8">
        <div className="card w-full max-w-sm p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <CheckSquare className="h-6 w-6" />
            </span>
            <span className="display-title text-xl leading-tight text-foreground">Taskr</span>
          </div>

          <h1 className="display-title text-3xl text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use your company account to continue.</p>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
              <p className="text-sm font-medium text-primary-strong">{error}</p>
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
              <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {invite.name ? `Welcome, ${invite.name}` : 'You have been invited'}
                    </p>
                    <p className="mt-0.5 text-sm text-primary-strong">
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
                <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-primary-strong hover:text-primary-strong">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
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
