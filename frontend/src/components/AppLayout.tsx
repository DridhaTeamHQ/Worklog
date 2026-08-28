import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, FileText, BarChart3, Bell, User as UserIcon,
  LogOut, Menu, X, ChevronDown, CheckSquare, Bug, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { Avatar } from './ui';
import { isManagerLevel, roleLabel } from '../types';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

const MANAGER_NAV: NavItem[] = [
  { to: '/manager', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true },
  { to: '/manager/team', label: 'Team Members', icon: <Users className="h-[18px] w-[18px]" /> },
  { to: '/manager/tasks', label: 'Assigned Tasks', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: '/manager/reports', label: 'Task Reports', icon: <FileText className="h-[18px] w-[18px]" /> },
  { to: '/manager/tickets', label: 'Tickets', icon: <Bug className="h-[18px] w-[18px]" /> },
  { to: '/manager/analytics', label: 'Analytics', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { to: '/manager/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" /> },
  { to: '/manager/profile', label: 'Profile', icon: <UserIcon className="h-[18px] w-[18px]" /> },
];

const EMPLOYEE_NAV: NavItem[] = [
  { to: '/employee', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true },
  { to: '/employee/tasks-assigned', label: 'Tasks Assigned', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: '/employee/tasks-done', label: 'Tasks Done', icon: <CheckSquare className="h-[18px] w-[18px]" /> },
  { to: '/employee/tickets', label: 'Tickets', icon: <Bug className="h-[18px] w-[18px]" /> },
  { to: '/employee/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" /> },
  { to: '/employee/profile', label: 'Profile', icon: <UserIcon className="h-[18px] w-[18px]" /> },
];

/** Remembered so the choice survives a reload rather than resetting every visit. */
const COLLAPSE_KEY = 'taskr.sidebarCollapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /** Mobile only: the sidebar is an overlay that slides in over the content. */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Desktop only: the sidebar is permanent, and this hides it to widen the page. */
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
      return next;
    });
  };

  const isManager = isManagerLevel(user?.role);
  const nav = isManager ? MANAGER_NAV : EMPLOYEE_NAV;

  // On mobile the sidebar is an overlay; navigating should dismiss it.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-ink-100">
      {/* Sidebar — permanent from lg up, slide-over below it. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-brand-900 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <BrandMark />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-brand-200 hover:bg-white/12 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          {/* The same control on desktop, where closing means collapsing rather than
              dismissing an overlay. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="hidden rounded-lg p-1.5 text-brand-200 hover:bg-white/12 hover:text-white lg:block"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pb-3">
          <p className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
            {roleLabel(user?.role)}
          </p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/12 p-3">
          <button type="button" onClick={handleLogout} className="nav-link w-full">
            <LogOut className="h-[18px] w-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-0' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/*
              Only rendered while the sidebar is collapsed: it is the sole way back, so
              it must not be possible to hide the navigation with no route to reopen it.
            */}
            {collapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Show sidebar"
                title="Show sidebar"
                className="hidden rounded-lg p-2 text-ink-600 hover:bg-brand-50 hover:text-brand-700 lg:block"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900 sm:text-base">
                {isManager ? `${roleLabel(user?.role)} Dashboard` : `Welcome, ${user?.name.split(' ')[0]}`}
              </p>
              <p className="hidden truncate text-xs text-ink-500 sm:block">
                {isManager
                  ? 'Company-wide task and reporting overview'
                  : user?.department
                    ? `${user.job_title || 'Team Member'} · ${user.department}`
                    : 'Team Member portal'}
              </p>
            </div>

            <NotificationBell />
            <ProfileMenu onLogout={handleLogout} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** The wordmark, always on the deep plum surface, so it is always light text. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 text-brand-950 shadow-sm">
        <CheckSquare className="h-5 w-5" />
      </span>
      <span className="text-base font-bold leading-tight text-white">Taskr</span>
    </span>
  );
}

function ProfileMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const profilePath = isManagerLevel(user.role) ? '/manager/profile' : '/employee/profile';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-100"
      >
        <Avatar name={user.name} src={user.profile_image} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold text-ink-900">{user.name}</span>
          <span className="block text-xs text-ink-500">{roleLabel(user.role)}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-ink-400" aria-hidden />
      </button>

      {open && (
        <div className="animate-in-up absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
          <div className="border-b border-ink-200 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
            {user.department && (
              <p className="mt-1.5 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {user.department}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); navigate(profilePath); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50"
          >
            <UserIcon className="h-4 w-4 text-ink-400" /> My profile
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2.5 border-t border-ink-100 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
