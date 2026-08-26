import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './components/AppLayout';
import { RequireAuth, RequireRole, RedirectIfAuthed, homeFor } from './components/RouteGuards';

import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';

import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { TasksDonePage } from './pages/employee/TasksDonePage';
import { TasksAssignedPage } from './pages/employee/TasksAssignedPage';

import { ManagerDashboard } from './pages/manager/ManagerDashboard';
import { TeamMembersPage } from './pages/manager/TeamMembersPage';
import { EmployeeDetailPage } from './pages/manager/EmployeeDetailPage';
import { AllTasksPage } from './pages/manager/AllTasksPage';
import { TaskReportsPage } from './pages/manager/TaskReportsPage';
import { AnalyticsPage } from './pages/manager/AnalyticsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
              <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  {/* Manager portal — RequireRole keeps a team member out even if they
                      type the URL, and the API refuses these routes independently. */}
                  <Route element={<RequireRole role="manager" />}>
                    <Route path="/manager" element={<ManagerDashboard />} />
                    <Route path="/manager/team" element={<TeamMembersPage />} />
                    <Route path="/manager/team/:id" element={<EmployeeDetailPage />} />
                    <Route path="/manager/tasks" element={<AllTasksPage />} />
                    <Route path="/manager/reports" element={<TaskReportsPage />} />
                    <Route path="/manager/analytics" element={<AnalyticsPage />} />
                    <Route path="/manager/notifications" element={<NotificationsPage />} />
                    <Route path="/manager/profile" element={<ProfilePage />} />
                  </Route>

                  {/* Team member portal */}
                  <Route element={<RequireRole role="team_member" />}>
                    <Route path="/employee" element={<EmployeeDashboard />} />
                    <Route path="/employee/tasks-assigned" element={<TasksAssignedPage />} />
                    <Route path="/employee/tasks-done" element={<TasksDonePage />} />
                    <Route path="/employee/notifications" element={<NotificationsPage />} />
                    <Route path="/employee/profile" element={<ProfilePage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Sends each role to its own portal; unauthenticated visitors go to sign in. */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-100 px-6 text-center">
      <p className="text-5xl font-bold text-ink-300">404</p>
      <h1 className="mt-4 text-xl font-bold text-ink-900">This page doesn't exist</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        The link may be out of date, or the page may have moved.
      </p>
      <Link to={user ? homeFor(user.role) : '/login'} className="btn-primary mt-6">
        {user ? 'Back to my dashboard' : 'Go to sign in'}
      </Link>
    </div>
  );
}
