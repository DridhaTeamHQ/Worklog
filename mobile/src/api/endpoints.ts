import { api } from './client';
import type {
  ActivityEntry, AnalyticsPayload, AppNotification, ChecklistItem, DailyReport, DashboardRange,
  EmployeeDashboard, Label, ManagerDashboard, Manager, PersonalTodo, Priority, Project, Task,
  TaskStatus, TeamMember, TeamMemberDetail, Ticket, TicketCounts, TicketSeverity, TicketStatus, User,
} from '@/types';

/* --------------------------------------------------------------------- auth */

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, password }, { skipAuthRedirect: true }),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  /** Revokes every session for the account, on every device. */
  logoutAll: () => api.post<{ message: string }>('/auth/logout-all'),
  me: () => api.get<{ user: User }>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post<{ message: string; devResetToken?: string }>('/auth/forgot-password', { email }, { skipAuthRedirect: true }),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }, { skipAuthRedirect: true }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
  /**
   * Whether this address is an account a manager added that nobody has claimed yet.
   * Drives the "Invited" card on the sign-in screen.
   */
  inviteStatus: (email: string, signal?: AbortSignal) =>
    api.post<{ invited: boolean; name?: string }>('/auth/invite-status', { email }, { skipAuthRedirect: true, signal }),
  /** Claims an invited account by setting its password, and signs them straight in. */
  acceptInvite: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/accept-invite', { email, password }, { skipAuthRedirect: true }),
};

/* ---------------------------------------------------------------- dashboard */

export const dashboardApi = {
  load: (params: { range?: DashboardRange } = {}, signal?: AbortSignal) =>
    api.get<ManagerDashboard | EmployeeDashboard>('/dashboard', params, signal),
  analytics: (params: { employeeId?: number; department?: string; from?: string; to?: string; days?: number }, signal?: AbortSignal) =>
    api.get<AnalyticsPayload>('/dashboard/analytics', params, signal),
};

/* -------------------------------------------------------------------- tasks */

export interface TaskFilters {
  employeeId?: number;
  projectId?: number;
  labelId?: number;
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
  labelIds?: number[];
}

export const taskApi = {
  list: (filters: TaskFilters = {}, signal?: AbortSignal) =>
    api.get<Task[]>('/tasks', filters as Record<string, string | number | undefined>, signal),
  get: (id: number, signal?: AbortSignal) => api.get<Task>(`/tasks/${id}`, undefined, signal),
  assign: (input: AssignTaskInput) => api.post<{ task: Task; message: string }>('/tasks', input),
  updateStatus: (id: number, status: TaskStatus) => api.patch<Task>(`/tasks/${id}/status`, { status }),
  update: (id: number, patch: Partial<Omit<AssignTaskInput, 'employeeId' | 'projectId' | 'labelIds'>>) =>
    api.patch<Task>(`/tasks/${id}`, patch),
  remove: (id: number) => api.delete<{ message: string }>(`/tasks/${id}`),
  setLabels: (id: number, labelIds: number[]) => api.put<Label[]>(`/tasks/${id}/labels`, { labelIds }),
};

/* ----------------------------------------------------------------- activity */

export type ActivityEntity = 'task' | 'ticket';
const entityPath = (entity: ActivityEntity, id: number) => `/${entity}s/${id}`;

export const activityApi = {
  list: (entity: ActivityEntity, id: number, signal?: AbortSignal) =>
    api.get<ActivityEntry[]>(`${entityPath(entity, id)}/activity`, undefined, signal),
  comment: (entity: ActivityEntity, id: number, body: string, mentions: number[] = []) =>
    api.post<ActivityEntry>(`${entityPath(entity, id)}/comments`, { body, mentions }),
  edit: (entity: ActivityEntity, id: number, commentId: number, body: string) =>
    api.patch<ActivityEntry>(`${entityPath(entity, id)}/comments/${commentId}`, { body }),
  remove: (entity: ActivityEntity, id: number, commentId: number) =>
    api.delete<{ message: string }>(`${entityPath(entity, id)}/comments/${commentId}`),
};

/* ---------------------------------------------------------------- checklist */

export const checklistApi = {
  list: (taskId: number, signal?: AbortSignal) =>
    api.get<ChecklistItem[]>(`/tasks/${taskId}/checklist`, undefined, signal),
  add: (taskId: number, title: string) => api.post<ChecklistItem>(`/tasks/${taskId}/checklist`, { title }),
  update: (taskId: number, itemId: number, patch: { title?: string; isDone?: boolean; position?: number }) =>
    api.patch<ChecklistItem>(`/tasks/${taskId}/checklist/${itemId}`, patch),
  remove: (taskId: number, itemId: number) =>
    api.delete<{ message: string }>(`/tasks/${taskId}/checklist/${itemId}`),
};

/* ------------------------------------------------------------------- labels */

export const labelApi = {
  list: (signal?: AbortSignal) => api.get<Label[]>('/labels', undefined, signal),
  create: (input: { name: string; color?: string }) => api.post<Label>('/labels', input),
  update: (id: number, patch: { name?: string; color?: string }) => api.patch<Label>(`/labels/${id}`, patch),
  remove: (id: number) => api.delete<{ message: string }>(`/labels/${id}`),
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

export interface ReportItemInput {
  taskId?: number | null;
  text: string;
  minutes?: number | null;
}

/** A task the server suggests as a line for today's report. */
export interface ReportSuggestion {
  id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string | null;
  task_key: string | null;
}

export const reportApi = {
  list: (filters: ReportFilters = {}, signal?: AbortSignal) =>
    api.get<DailyReport[]>('/reports', filters as Record<string, string | number | undefined>, signal),
  /** `meta.today` is the date the server considers today for this device. */
  today: (signal?: AbortSignal) => api.get<DailyReport | null>('/reports/today', undefined, signal),
  suggestions: (signal?: AbortSignal) => api.get<ReportSuggestion[]>('/reports/suggestions', undefined, signal),
  save: (input: { taskDescription?: string; items?: ReportItemInput[] }) =>
    api.post<{ report: DailyReport; createdNew: boolean; message: string }>('/reports', input),
  remove: (id: number) => api.delete<{ message: string }>(`/reports/${id}`),
};

/* ------------------------------------------------------------ notifications */

export const notificationApi = {
  list: (params: { unreadOnly?: boolean; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<AppNotification[]>('/notifications', {
      unreadOnly: params.unreadOnly ? 'true' : undefined,
      limit: params.limit,
    }, signal),
  unreadCount: (signal?: AbortSignal) => api.get<{ unread: number }>('/notifications/unread-count', undefined, signal),
  markRead: (id: number) => api.patch<{ id: number; is_read: boolean; unread: number }>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ marked: number; unread: number }>('/notifications/read-all'),
};

/* ------------------------------------------------------------------ devices */

export const deviceApi = {
  register: (input: { expoPushToken: string; platform: 'ios' | 'android' | 'web'; appVersion?: string }) =>
    api.post<{ id: number; expo_push_token: string }>('/devices', input),
  unregister: (expoPushToken: string) =>
    api.delete<{ message: string }>(`/devices/${encodeURIComponent(expoPushToken)}`),
};

/* --------------------------------------------------------------------- team */

export interface NewTeamMemberInput {
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
}

export const teamApi = {
  list: (params: { search?: string; department?: string } = {}, signal?: AbortSignal) =>
    api.get<TeamMember[]>('/team', params, signal),
  departments: (signal?: AbortSignal) => api.get<string[]>('/team/departments', undefined, signal),
  detail: (id: number, signal?: AbortSignal) =>
    api.get<{ employee: TeamMemberDetail; tasks: Task[]; reports: DailyReport[] }>(`/team/${id}`, undefined, signal),
  reports: (id: number, params: ReportFilters = {}, signal?: AbortSignal) =>
    api.get<DailyReport[]>(`/team/${id}/reports`, params as Record<string, string | number | undefined>, signal),
  tasks: (id: number, signal?: AbortSignal) => api.get<Task[]>(`/team/${id}/tasks`, undefined, signal),
};

export const adminApi = {
  list: (params: { search?: string } = {}, signal?: AbortSignal) =>
    api.get<Manager[]>('/admins', params, signal),
};

/* ----------------------------------------------------------------- projects */

export const projectApi = {
  list: (params: { includeArchived?: boolean } = {}, signal?: AbortSignal) =>
    api.get<Project[]>('/projects', { includeArchived: params.includeArchived ? 'true' : undefined }, signal),
  get: (id: number, signal?: AbortSignal) => api.get<Project>(`/projects/${id}`, undefined, signal),
  create: (input: { name: string; key: string; description?: string; leadId?: number | null }) =>
    api.post<{ project: Project; message: string }>('/projects', input),
  update: (
    id: number,
    patch: { name?: string; key?: string; description?: string | null; leadId?: number | null; isArchived?: boolean },
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
  get: (id: number, signal?: AbortSignal) => api.get<Ticket>(`/tickets/${id}`, undefined, signal),
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

/* ------------------------------------------------------------ personal todos */

export const todoApi = {
  list: (date?: string, signal?: AbortSignal) => api.get<PersonalTodo[]>('/todos', { date }, signal),
  create: (title: string, date?: string, context?: { projectId?: number; taskId?: number }) =>
    api.post<PersonalTodo>('/todos', { title, date, ...context }),
  update: (
    id: number,
    patch: { title?: string; date?: string; isDone?: boolean; projectId?: number | null; taskId?: number | null },
  ) => api.patch<PersonalTodo>(`/todos/${id}`, patch),
  remove: (id: number) => api.delete<{ id: number; message: string }>(`/todos/${id}`),
};

/* ------------------------------------------------------------------ profile */

export const profileApi = {
  get: (signal?: AbortSignal) => api.get<User>('/profile', undefined, signal),
  update: (patch: Partial<Pick<User, 'name' | 'department' | 'phone' | 'timezone'>> & { jobTitle?: string | null }) =>
    api.patch<User>('/profile', patch),
};
