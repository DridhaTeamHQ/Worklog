import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';
import type { Role } from '../types';
import { isManagerLevel } from '../types';

/**
 * Admins share the manager portal — they see everything a manager sees — so both
 * roles land on /manager.
 */
export const homeFor = (role: Role) => (isManagerLevel(role) ? '/manager' : '/employee');

/**
 * Gate for the signed-in area. While the stored session is being verified we render a
 * loader rather than a redirect, so a refresh does not bounce the user to /login.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

/**
 * Role gate. Typing another portal's URL sends the user back to their own dashboard
 * rather than showing them a page they are not entitled to — and the API enforces the
 * same rule independently, so this is convenience, not the security boundary.
 */
export function RequireRole({ role }: { role: Role | Role[] }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // An array lets one gate admit a whole tier — the manager portal admits admins too.
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}

/** Keeps a signed-in user off the login screen. */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
