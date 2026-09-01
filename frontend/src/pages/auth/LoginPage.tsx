import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, CheckSquare, Eye, EyeOff, Lock, Mail, MailCheck, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { homeFor } from '../../components/RouteGuards';
import { Spinner } from '../../components/ui';

const INVITE_CHECK_DELAY_MS = 450;
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<{ email: string; name?: string } | null>(null);
  const inviteRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const typed = email.trim().toLowerCase();
    inviteRequest.current?.abort();

    if (!looksLikeEmail(typed)) {
      setInvite(null);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        const controller = new AbortController();
        inviteRequest.current = controller;
        try {
          const { data } = await authApi.inviteStatus(typed, controller.signal);
          setInvite(data.invited ? { email: typed, name: data.name } : null);
        } catch {
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#070d16] font-sans text-white lg:h-screen lg:flex-row">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(50rem 36rem at 27% 70%, rgba(244, 85, 60, 0.14), transparent 66%), radial-gradient(42rem 30rem at 78% 38%, rgba(65, 83, 115, 0.18), transparent 70%)',
        }}
      />

      {/* Left Panel */}
      <div className="relative z-10 hidden min-h-screen flex-[1.07] flex-col px-10 py-12 lg:flex xl:px-[5.4rem]">
        <div className="relative z-20">
          <div className="mb-6 flex items-center gap-3 text-white">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
              <CheckSquare className="h-7 w-7" strokeWidth={2.6} />
            </span>
            <span className="text-[1.72rem] font-black leading-tight tracking-normal">Taskr</span>
          </div>

          <h1 className="max-w-[44rem] text-[clamp(3.2rem,3.35vw,4rem)] font-black leading-[1.08] tracking-normal text-white">
            Track the work.<br />
            <span className="text-primary">Not the paperwork.</span>
          </h1>
          <p className="mt-5 max-w-[27rem] text-[1.05rem] leading-7 text-white/70">
            Taskr helps teams stay organized, meet deadlines, and get more done.
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[65%]">
          <div className="absolute left-[15%] top-[5%] h-[24rem] w-[33rem] rounded-full bg-[#101724]" />
          <img
            src="/login-anime-worker.png"
            alt=""
            aria-hidden
            className="absolute bottom-0 left-[-6.5rem] z-0 h-full w-[66rem] max-w-none object-contain object-left-bottom xl:left-[-4rem] xl:w-[73rem]"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-[43rem] z-[1] h-full w-40 bg-gradient-to-r from-transparent via-[#070d16]/95 to-[#070d16] xl:left-[50rem] xl:w-48"
          />
          <div className="absolute bottom-[55%] left-[30.5rem] z-[2] w-[15.25rem] rounded-xl border border-white/15 bg-[#111a28]/82 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-md xl:left-[34rem]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">My Tasks</p>
              <MoreHorizontal className="h-4 w-4 text-white/70" />
            </div>
            <div className="space-y-2.5 text-xs font-medium">
              {[
                ['Design login screen', true],
                ['Review PR', true],
                ['Team stand-up', false],
                ['Fix bugs', false],
              ].map(([label, done]) => (
                <div key={label as string} className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-[1.15rem] w-[1.15rem] items-center justify-center rounded-[4px] border ${
                      done ? 'border-primary bg-primary text-white' : 'border-white/20 bg-transparent'
                    }`}
                  >
                    {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className={done ? 'text-white' : 'text-white/78'}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-[27%] left-[33.5rem] z-[2] flex w-[12.25rem] items-center gap-3 rounded-xl border border-white/15 bg-[#111a28]/82 p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-md xl:left-[36.75rem]">
            <div>
              <p className="mb-2 text-xs font-semibold text-white/70">Progress</p>
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[conic-gradient(#f4553c_270deg,rgba(255,255,255,0.12)_0deg)]">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#111a28] text-base font-black">75%</div>
              </div>
            </div>
            <div className="flex h-14 items-end gap-1.5">
              {[26, 38, 50, 64, 78].map((height, index) => (
                <span
                  key={height}
                  className="w-2.5 rounded-t bg-gradient-to-t from-primary/45 to-primary"
                  style={{ height: `${height}%`, opacity: 0.55 + index * 0.1 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-8 lg:min-h-screen lg:flex-[0.93] lg:overflow-hidden lg:py-12">
        <div className="w-full max-w-[31.5rem] rounded-3xl border border-white/12 bg-[#111824]/92 px-5 py-6 shadow-2xl shadow-black/40 backdrop-blur sm:px-7 sm:py-7 xl:max-w-[34rem] xl:px-9 xl:py-8">
          <div className="mx-auto mb-5 flex flex-col items-center xl:mb-6">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                <CheckSquare className="h-5 w-5" strokeWidth={2.6} />
              </span>
              <span className="text-xl font-black text-white">Taskr</span>
            </div>
            <div className="mb-4 hidden h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30 lg:flex xl:h-12 xl:w-12">
              <CheckSquare className="h-6 w-6 xl:h-7 xl:w-7" strokeWidth={2.6} />
            </div>
            <h2 className="mb-1.5 text-[1.65rem] font-black tracking-normal text-white xl:text-[1.85rem]">Welcome back</h2>
            <p className="text-sm text-white/58">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          {invite && (
            <div className="mb-6 rounded-lg border border-border bg-muted px-3.5 py-3">
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

          <form onSubmit={handleSubmit} className="space-y-3.5 xl:space-y-4" noValidate>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-white/90" htmlFor="email">Email address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@company.com"
                  aria-invalid={!!fieldErrors.email}
                  className={`w-full rounded-xl border border-white/10 bg-[#121b29] py-2.5 pl-11 pr-4 text-sm text-white shadow-inner shadow-black/10 placeholder-white/38 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary xl:py-3 ${fieldErrors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {fieldErrors.email && <p className="mt-1 text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[13px] font-semibold text-white/90" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="text-[13px] font-bold text-primary hover:text-primary/80">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/40">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  aria-invalid={!!fieldErrors.password}
                  className={`w-full rounded-xl border border-white/10 bg-[#121b29] py-2.5 pl-11 pr-11 text-sm text-white shadow-inner shadow-black/10 placeholder-white/45 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary xl:py-3 ${fieldErrors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-white/40 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            <div className="mt-2 mb-3 flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 appearance-none rounded bg-[#1f2028] border border-white/10 checked:bg-primary checked:border-primary checked:bg-[url('data:image/svg+xml;utf8,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%208L6%2011L11%203.5%22%20stroke=%22white%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] focus:ring-1 focus:ring-primary focus:ring-offset-0 focus:outline-none"
              />
              <label htmlFor="remember" className="ml-2.5 block text-[13px] text-white/90">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#111824] disabled:opacity-50 xl:mt-4 xl:py-3"
            >
              {submitting ? <Spinner className="h-5 w-5" /> : (
                <>
                  <ArrowRight className="h-5 w-5" /> Login
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center space-x-3">
            <div className="h-px w-full bg-white/10"></div>
            <span className="whitespace-nowrap text-xs text-white/40">or continue with</span>
            <div className="h-px w-full bg-white/10"></div>
          </div>

          <button type="button" className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#121b29] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-white/20">
            <GoogleIcon />
            Sign in with Google
          </button>

          <p className="mt-5 text-center text-[13px] text-white/50 xl:mt-6">
            Don't have an account? <Link to="/contact" className="text-primary hover:underline">Contact your admin</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
