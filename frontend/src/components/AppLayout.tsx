import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, FileText, BarChart3, Bell,
  LogOut, Menu, X, CheckSquare, Bug, PanelLeftClose, PanelLeftOpen, Pencil,
  ChartGantt, NotebookPen,
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
  /* The name is the only way to the profile page now, so it also has to be what
     shows you are on it — otherwise that route highlights nothing at all. */
  const onProfile = location.pathname === profilePath;

  // On mobile the sidebar is an overlay; navigating should dismiss it.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted">
      {/*
        Sidebar — permanent from lg up, slide-over below it. Collapsing narrows it to
        a rail rather than hiding it: the rail is always the way back, so navigation
        can never be dismissed with no route left to reopen it.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex transform flex-col bg-foreground lg:border-r lg:border-border transition-[transform,width] duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${collapsed ? 'w-64 lg:w-[4.75rem]' : 'w-64'}`}
        aria-label="Main navigation"
      >
        {/* ------------------------------------------------------------ header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          {collapsed ? (
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CheckSquare className="h-5 w-5" />
            </span>
          ) : <BrandMark />}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          {/*
            Expanded, the collapse control sits in the header beside the wordmark.
            Collapsed there is no room for it there — the rail is barely wider than
            the logo — so it moves to its own centred row below, which is why this
            one is hidden rather than restyled.
          */}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="hidden rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:block"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* The same control once the panel is a rail, on a row of its own. */}
        {collapsed && (
          <div className="hidden shrink-0 justify-center pb-2 lg:flex">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="rounded-lg p-1.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}

        {/*
          Who is signed in, and the way to their own details. A link rather than a
          label, and it says so on hover and to a screen reader.
        */}
        <div className={`shrink-0 border-b border-sidebar-border pb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          <Link
            to={profilePath}
            title={collapsed ? `${user?.name} — edit your details` : undefined}
            aria-label={`${user?.name}. Edit your profile details.`}
            aria-current={onProfile ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-md p-2 transition-colors ${
              onProfile ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <Avatar name={user?.name ?? '?'} src={user?.profile_image} size="md" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70">
                  {roleLabel(user?.role)}
                </span>
                <span className="block truncate text-sm font-bold text-background">{user?.name}</span>
              </span>
            )}
            {!collapsed && (
              <Pencil className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            )}
          </Link>
        </div>

        {/* -------------------------------------------------------------- nav */}
        {/*
          Collapsed, the flyout labels sit outside the rail's own width, and a scroll
          container would clip them on that axis — `overflow-y-auto` cannot pair with
          a visible x. The rail is short enough not to need scrolling, so it drops the
          clipping entirely and only the expanded panel scrolls.
        */}
        <div className={`flex-1 px-3 py-4 ${collapsed ? 'lg:overflow-visible' : 'overflow-y-auto'}`}>
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
                  <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            className={`group relative nav-link w-full ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className={collapsed ? 'lg:hidden' : ''}>Logout</span>
            {collapsed && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 border-b border-border bg-muted/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-full p-2 text-foreground hover:bg-accent lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="display-title truncate text-sm text-foreground sm:text-base">
                {isManager ? `${roleLabel(user?.role)} Dashboard` : `Welcome, ${user?.name.split(' ')[0]}`}
              </p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {isManager
                  ? 'Company-wide task and reporting overview'
                  : user?.department
                    ? `${user.job_title || 'Team Member'} · ${user.department}`
                    : 'Team Member portal'}
              </p>
            </div>

            <NotificationBell />
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
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CheckSquare className="h-5 w-5" />
      </span>
      <span className="display-title text-lg leading-tight text-background">Taskr</span>
    </span>
  );
}
