import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, FileText, BarChart3, Bell,
  LogOut, Menu, X, CheckSquare, Bug, ChartGantt, NotebookPen, Pencil,
  PanelLeftClose, PanelLeftOpen,
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
  { to: '/manager/timeline', label: 'Timeline', icon: <ChartGantt className="h-[18px] w-[18px]" /> },
  { to: '/manager/my-day', label: 'My Day', icon: <NotebookPen className="h-[18px] w-[18px]" /> },
  { to: '/manager/reports', label: 'Task Reports', icon: <FileText className="h-[18px] w-[18px]" /> },
  { to: '/manager/tickets', label: 'Tickets', icon: <Bug className="h-[18px] w-[18px]" /> },
  { to: '/manager/analytics', label: 'Analytics', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { to: '/manager/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" /> },
];

const EMPLOYEE_NAV: NavItem[] = [
  { to: '/employee', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true },
  { to: '/employee/tasks-assigned', label: 'Tasks Assigned', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: '/employee/tasks-done', label: 'Tasks Done', icon: <CheckSquare className="h-[18px] w-[18px]" /> },
  { to: '/employee/timeline', label: 'Timeline', icon: <ChartGantt className="h-[18px] w-[18px]" /> },
  { to: '/employee/my-day', label: 'My Day', icon: <NotebookPen className="h-[18px] w-[18px]" /> },
  { to: '/employee/tickets', label: 'Tickets', icon: <Bug className="h-[18px] w-[18px]" /> },
  { to: '/employee/notifications', label: 'Notifications', icon: <Bell className="h-[18px] w-[18px]" /> },
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
  const profilePath = isManager ? '/manager/profile' : '/employee/profile';

  // On mobile the sidebar is an overlay; navigating should dismiss it.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-lavender-500 to-petal-300 bg-fixed">
      {/*
        Sidebar — an icon rail from lg up that expands to labels, and a slide-over
        below it. Collapsing narrows it rather than hiding it: the rail is always
        the way back, so navigation can never be dismissed with no route to reopen.
      */}
      <aside
        className={`fixed inset-y-3 left-3 z-50 flex transform flex-col rounded-3xl border border-ink-200 bg-white shadow-2xl shadow-lavender-600/20 transition-[transform,width] duration-200 ${
          /* Inset from the left edge, so hiding it has to clear its own width *and*
             that inset — a plain -translate-x-full would leave a sliver on screen. */
          sidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        } lg:translate-x-0 ${collapsed ? 'w-64 lg:w-[4.75rem]' : 'w-64'}`}
        aria-label="Main navigation"
      >
        {/* Collapse handle, on the panel's edge as a round control. */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-md transition-colors hover:bg-ink-100 hover:text-ink-800 lg:flex"
        >
          {collapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>

        {/* ------------------------------------------------------------ header */}
        <div className="relative flex h-16 shrink-0 items-center justify-between px-4">
          {collapsed ? (
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blush-300 to-brand-500 text-white shadow-sm">
              <CheckSquare className="h-5 w-5" />
            </span>
          ) : <BrandMark />}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/*
          Who is signed in, and the way to their own details — with the top bar gone
          this is the only route to the profile page, so it is a link rather than a
          label, and says so on hover and to a screen reader.
        */}
        <div className={`relative border-b border-ink-200 pb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          <Link
            to={profilePath}
            title={collapsed ? `${user?.name} — edit your details` : undefined}
            aria-label={`${user?.name}. Edit your profile details.`}
            className={`group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink-100 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Avatar name={user?.name ?? '?'} src={user?.profile_image} size="md" className="ring-2 ring-brand-100" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  {roleLabel(user?.role)}
                </span>
                <span className="block truncate text-sm font-bold text-ink-900">{user?.name}</span>
              </span>
            )}
            {!collapsed && (
              <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            )}
          </Link>
        </div>

        {/* -------------------------------------------------------------- nav */}
        <div className="relative flex-1 overflow-y-auto px-3 py-4">
          {collapsed
            ? <div className="mx-auto mb-3 h-px w-8 bg-ink-200" />
            : <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Main</p>}

          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `group relative nav-link ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${isActive ? 'nav-link-active' : ''}`}
              >
                {item.icon}
                <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                {/* Collapsed, the label arrives as a flyout — the rail must still say
                    what each icon is, without depending on a native tooltip's delay. */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="relative shrink-0 border-t border-ink-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className={`group relative nav-link w-full ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                Logout
              </span>
            )}
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

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[6.25rem]' : 'lg:pl-[17.5rem]'}`}>
        {/*
          The right gutter and the extra top padding are the notification bell's
          keep-out zone. It is pinned to the viewport, so without this the content
          runs underneath it — page-header actions and the timeline's own controls
          both sit exactly where it floats.

          Two different reservations because one does not suit both: from sm up there
          is width to spare, so the gutter is on the right and no vertical space is
          lost. On a phone a 96px right gutter would eat a quarter of the screen, so
          the content starts below the bell instead. Padding is stated per side rather
          than via px/py, so the wider value cannot be undone by ordering.
        */}
        <main className="mx-auto w-full max-w-7xl pb-6 pl-4 pr-4 pt-20 sm:pb-8 sm:pl-6 sm:pr-24 sm:pt-8">
          <Outlet />
        </main>
      </div>

      {/*
        With the top bar gone the sidebar is the only navigation, so below lg — where
        it is a slide-over — there has to be something on screen that opens it.
      */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
        className="fixed bottom-6 left-6 z-30 rounded-full border border-ink-200 bg-white p-3 text-ink-700 shadow-lg transition-colors hover:bg-ink-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Notifications, floating clear of the content rather than docked to a bar. */}
      <div className="fixed right-6 top-6 z-40">
        <NotificationBell floating />
      </div>
    </div>
  );
}

/** The wordmark. The tile carries the gradient; the word sits on the white rail. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blush-300 to-brand-500 text-white shadow-sm">
        <CheckSquare className="h-5 w-5" />
      </span>
      <span className="text-base font-bold leading-tight text-ink-900">Taskr</span>
    </span>
  );
}
