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

/**
 * The drifting decorations on the sign-in page.
 *
 * Positions are chosen around what is already on screen — the headline sits top-left,
 * the artwork fills the bottom-left, and the card is centred in the right half — so
 * these fill the corners those leave empty rather than landing on top of them.
 *
 * Each carries its own duration and delay: identical timing would have four objects
 * rocking in unison, which reads as a glitch rather than as drift.
 */
const DECORATIONS = [
  // Moved clear of the card's top-left corner, which the astronaut now occupies.
  { src: '/deco-bug.png', className: 'left-[45%] top-[6%] w-14', duration: '7s', delay: '0s' },
  // Clear of the card's bottom-right corner, which was clipping it.
  { src: '/deco-calendar.png', className: 'right-[3%] bottom-[7%] w-24', duration: '8s', delay: '0.6s' },
];

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
    <div className="relative flex min-h-screen flex-col bg-foreground lg:h-screen lg:flex-row lg:overflow-hidden">
      {/*
        The near-black the navigation is drawn on, warmed by two wide coral blooms so
        the screen reads as the product's own black-and-orange rather than as a flat
        dark panel. They are fixed rather than scrolled, and sit under everything.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(55rem 38rem at 8% 92%, rgba(244, 85, 60, 0.30), transparent 62%),'
            + 'radial-gradient(42rem 30rem at 88% 6%, rgba(244, 85, 60, 0.18), transparent 60%)',
        }}
      />
      {/*
        Purely decorative: aria-hidden and pointer-events-none, so they are invisible
        to assistive tech and can never intercept a click meant for the form. They sit
        behind everything, and each removes itself if its file is missing rather than
        leaving a broken-image icon on the sign-in screen.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
        {DECORATIONS.map((d) => (
          <img
            key={d.src}
            src={d.src}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ animationDuration: d.duration, animationDelay: d.delay }}
            className={`animate-float-tilt absolute opacity-90 drop-shadow-lg ${d.className}`}
          />
        ))}
      </div>

      {/* Brand panel — decorative, so it steps aside entirely on small screens. */}
      <div className="relative z-10 hidden overflow-hidden lg:flex lg:h-screen lg:w-[45%] lg:flex-col lg:p-12 lg:pb-0">
        <div className="relative flex shrink-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <CheckSquare className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold leading-tight text-white">Taskr</span>
        </div>

        <div className="relative flex flex-1 flex-col pt-6">
          <h2 className="font-display text-2xl leading-snug text-white">
            Track the work.<br />Not the paperwork.
          </h2>
          <p className="mt-5 text-xs text-white/60">
            © {new Date().getFullYear()} Taskr. Internal use only.
          </p>

          {/*
            Decorative only, so it is hidden from assistive tech and carries no alt
            text. It removes itself if the file is not there — the panel reads fine
            without it, and a broken player on the sign-in screen would not.

            Full width and never cropped: the negative side margins cancel the panel's
            p-12 so it runs to both edges, the width is widened by the same 6rem
            (a negative margin moves a box without resizing it), and the height is
            left to follow the aspect ratio rather than being forced into a box. That
            is what leaves the artwork whole — `object-cover` would fill the space but
            trim the top and bottom off to do it.

            Its own height therefore decides how much room it needs, and the panel does
            not scroll — so the copy above it is kept short and small deliberately, to
            leave that height free. `mt-auto` holds it against the bottom edge.

            `muted` is what lets it start on its own: a browser will not autoplay a
            clip that can make noise. `playsInline` stops iOS taking it fullscreen,
            and `preload="auto"` matters more here than elsewhere — this is the first
            screen anyone sees, and a clip that stutters into life reads as a fault.

            WebM because the clip carries an alpha channel, which is what lets it sit
            on the dark panel rather than in a white box of its own. Safari does not
            decode alpha in WebM; it falls back to the poster, which is the opening
            frame with the same transparency, so that browser gets the artwork
            standing still rather than nothing at all.
          */}
          <video
            src="/login-illustration.webm"
            poster="/login-illustration.png"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
            tabIndex={-1}
            className="-mx-12 mt-auto block h-auto w-[calc(100%+6rem)] max-w-none pt-6"
          />
        </div>
      </div>

      {/* Form panel */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-5 py-10 sm:px-8">
        {/*
          The card is the only white surface on the page, which is what makes it the
          thing to look at. #E4A7C5 does the shining rather than sitting as a stripe:
          a blurred halo bleeding out behind the card, a hairline ring on its edge, and
          a band of light that sweeps across it. None of it touches the interior, so
          every label, field and error stays on plain white.
        */}
        <div className="relative w-full max-w-md">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-5 rounded-[2.5rem] bg-primary/35 blur-3xl"
          />
          {/*
            Positioned against the card rather than the viewport, so it holds the
            top-right corner at any window size instead of drifting under the card when
            the layout reflows. Above the card, since it is meant to sit on the corner.
          */}
          <img
            src="/deco-astronaut.png"
            alt=""
            aria-hidden
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ animationDuration: '9s', animationDelay: '1.2s' }}
            className="animate-float-tilt pointer-events-none absolute -right-14 -top-12 z-20 hidden w-28 drop-shadow-lg lg:block"
          />
          <div className="relative overflow-hidden rounded-3xl bg-card shadow-2xl shadow-black/50 ring-1 ring-border">
            <span
              aria-hidden
              className="animate-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            />
          <div className="relative px-8 py-14 sm:px-10 sm:py-20">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CheckSquare className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold leading-tight text-foreground">Taskr</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground">Sign in</h1>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
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
              <div className="rounded-lg border border-border bg-muted px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {invite.name ? `Welcome, ${invite.name}` : 'You have been invited'}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
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
                <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-primary hover:text-primary-strong">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full py-3"
            >
              {submitting ? <><Spinner className="h-4 w-4" /> Signing in…</> : <><LogIn className="h-4 w-4" /> Login</>}
            </button>
          </form>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
