import { api } from './client';
import type {
  AnalyticsPayload, AppNotification, DailyReport, EmployeeDashboard, ManagerDashboard,
  Priority, Project, Task, TaskStatus, TeamMember, TeamMemberDetail, Ticket,
  TicketCounts, TicketSeverity, TicketStatus, User,
} from '../types';

/* --------------------------------------------------------------------- auth */

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }, { skipAuthRedirect: true }),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  me: () => api.get<{ user: User }>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post<{ message: string; devResetToken?: string }>('/auth/forgot-password', { email }, { skipAuthRedirect: true }),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }, { skipAuthRedirect: true }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
};

/* ---------------------------------------------------------------- dashboard */

export const dashboardApi = {
  load: () => api.get<ManagerDashboard | EmployeeDashboard>('/dashboard'),
  analytics: (params: { employeeId?: number; department?: string; from?: string; to?: string; days?: number }) =>
    api.get<AnalyticsPayload>('/dashboard/analytics', params),
};

/* -------------------------------------------------------------------- tasks */

export interface TaskFilters {
  employeeId?: number;
  projectId?: number;
  status?: string;
  priority?: Priority | '';
  department?: string;
  search?: string;
  assignedFrom?: string;
  assignedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface AssignTaskInput {
  employeeId: number;
  projectId: number;
  title: string;
  description: string;
  notes?: string;
  priority: Priority;
  startDate?: string | null;
  deadline?: string | null;
}

export const taskApi = {
  list: (filters: TaskFilters = {}, signal?: AbortSignal) =>
    api.get<Task[]>('/tasks', filters as Record<string, string | number | undefined>, signal),
  get: (id: number) => api.get<Task>(`/tasks/${id}`),
  assign: (input: AssignTaskInput) => api.post<{ task: Task; message: string }>('/tasks', input),
  updateStatus: (id: number, status: TaskStatus) => api.patch<Task>(`/tasks/${id}/status`, { status }),
  update: (id: number, patch: Partial<AssignTaskInput>) => api.patch<Task>(`/tasks/${id}`, patch),
  remove: (id: number) => api.delete<{ message: string }>(`/tasks/${id}`),
};

/* ------------------------------------------------------------------ reports */

export interface ReportFilters {
  employeeId?: number;
  range?: 'today' | 'week' | 'month' | 'custom' | 'all';
  from?: string;
  to?: string;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const reportApi = {
  list: (filters: ReportFilters = {}, signal?: AbortSignal) =>
    api.get<DailyReport[]>('/reports', filters as Record<string, string | number | undefined>, signal),
  today: () => api.get<DailyReport | null>('/reports/today'),
  save: (taskDescription: string) =>
    api.post<{ report: DailyReport; createdNew: boolean; message: string }>('/reports', { taskDescription }),
  remove: (id: number) => api.delete<{ message: string }>(`/reports/${id}`),
};

/* ------------------------------------------------------------ notifications */

export const notificationApi = {
  list: (params: { unreadOnly?: boolean; limit?: number } = {}) =>
    api.get<AppNotification[]>('/notifications', {
      unreadOnly: params.unreadOnly ? 'true' : undefined,
      limit: params.limit,
    }),
  unreadCount: () => api.get<{ unread: number }>('/notifications/unread-count'),
  markRead: (id: number) => api.patch<{ id: number; is_read: boolean; unread: number }>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ marked: number; unread: number }>('/notifications/read-all'),
};

/* --------------------------------------------------------------------- team */

export interface NewTeamMemberInput {
  name: string;
  email: string;
  password: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
}

export const teamApi = {
  list: (params: { search?: string; department?: string } = {}, signal?: AbortSignal) =>
    api.get<TeamMember[]>('/team', params, signal),
  create: (input: NewTeamMemberInput) =>
    api.post<{
      employee: User;
      /** Whether the welcome email actually went out. `mode` is 'smtp' or 'log'. */
      email: { delivered: boolean; mode: string; error?: string };
      message: string;
    }>('/team', input),
  departments: () => api.get<string[]>('/team/departments'),
  detail: (id: number) =>
    api.get<{ employee: TeamMemberDetail; tasks: Task[]; reports: DailyReport[] }>(`/team/${id}`),
  reports: (id: number, params: ReportFilters = {}, signal?: AbortSignal) =>
    api.get<DailyReport[]>(`/team/${id}/reports`, params as Record<string, string | number | undefined>, signal),
  tasks: (id: number) => api.get<Task[]>(`/team/${id}/tasks`),
};

/* ----------------------------------------------------------------- projects */

export const projectApi = {
  list: (params: { includeArchived?: boolean } = {}) =>
    api.get<Project[]>('/projects', { includeArchived: params.includeArchived ? 'true' : undefined }),
  get: (id: number) => api.get<Project>(`/projects/${id}`),
  create: (input: { name: string; key: string; description?: string; leadId?: number | null }) =>
    api.post<{ project: Project; message: string }>('/projects', input),
  update: (
    id: number,
    patch: { name?: string; key?: string; description?: string | null; isArchived?: boolean },
  ) => api.patch<Project>(`/projects/${id}`, patch),
};

/* ------------------------------------------------------------------ tickets */

export interface TicketFilters {
  reporterId?: number;
  projectId?: number;
  taskId?: number;
  status?: string;
  severity?: string;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const ticketApi = {
  list: (filters: TicketFilters = {}, signal?: AbortSignal) =>
    api.get<Ticket[]>('/tickets', filters as Record<string, string | number | undefined>, signal),
  get: (id: number) => api.get<Ticket>(`/tickets/${id}`),
  create: (input: {
    projectId: number; taskId: number; title: string; description: string; severity: TicketSeverity;
  }) => api.post<{ ticket: Ticket; message: string }>('/tickets', input),
  updateStatus: (id: number, status: TicketStatus, resolutionNote?: string) =>
    api.patch<Ticket>(`/tickets/${id}/status`, { status, resolutionNote }),
  update: (id: number, patch: { title?: string; description?: string; severity?: TicketSeverity }) =>
    api.patch<Ticket>(`/tickets/${id}`, patch),
  remove: (id: number) => api.delete<{ message: string }>(`/tickets/${id}`),
};

export type { TicketCounts };

/* ------------------------------------------------------------------ profile */

export const profileApi = {
  get: () => api.get<User>('/profile'),
  update: (patch: Partial<Pick<User, 'name' | 'department' | 'phone'>> & { jobTitle?: string | null }) =>
    api.patch<User>('/profile', patch),
};
