import { api } from './client';
import type {
  AnalyticsPayload,
  ChatContact,
  ChatMessage,
  ChatGroup,
  GroupMessage,
  ChatUnread,
  TeamMessage,
  AppNotification,
  DailyReport,
  DashboardRange,
  EmployeeDashboardData,
  ManagerDashboardData,
  Manager,
  PersonalTodo,
  Priority,
  Project,
  Task,
  TaskStatus,
  TeamMember,
  TeamMemberDetail,
  Ticket,
  TicketSeverity,
  TicketStatus,
  User,
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
  inviteStatus: (email: string, signal?: AbortSignal) =>
    api.post<{ invited: boolean; name?: string }>('/auth/invite-status', { email }, { skipAuthRedirect: true, signal }),
  acceptInvite: (email: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/accept-invite', { email, password }, { skipAuthRedirect: true }),
};

/* ---------------------------------------------------------------- dashboard */

export const dashboardApi = {
  load: (params: { range?: DashboardRange } = {}) =>
    api.get<ManagerDashboardData | EmployeeDashboardData>('/dashboard', params),
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
  department?: string;
  jobTitle?: string;
  phone?: string;
}

export interface EditTeamMemberInput {
  name?: string;
  email?: string;
  department?: string;
  jobTitle?: string;
  phone?: string | null;
  isActive?: boolean;
}

export const teamApi = {
  list: (params: { search?: string; department?: string } = {}, signal?: AbortSignal) =>
    api.get<TeamMember[]>('/team', params, signal),
  create: (input: NewTeamMemberInput) =>
    api.post<{
      employee: User;
      email: { delivered: boolean; mode: string; error?: string };
      message: string;
    }>('/team', input),
  update: (id: number, patch: EditTeamMemberInput) => api.patch<User>(`/team/${id}`, patch),
    departments: () => api.get<string[]>('/team/departments'),
    createDepartment: (name: string) => api.post<{ name: string }>('/team/departments', { name }),
  detail: (id: number) =>
    api.get<{ employee: TeamMemberDetail; tasks: Task[]; reports: DailyReport[] }>(`/team/${id}`),
  reports: (id: number, params: ReportFilters = {}, signal?: AbortSignal) =>
    api.get<DailyReport[]>(`/team/${id}/reports`, params as Record<string, string | number | undefined>, signal),
  tasks: (id: number) => api.get<Task[]>(`/team/${id}/tasks`),
  remove: (id: number) =>
    api.delete<{
      id: number;
      removed: { reports: number; tasks: number; tickets: number };
      message: string;
    }>(`/team/${id}`),
};

/* ------------------------------------------------------------------- admins */

export const adminApi = {
  list: (params: { search?: string } = {}, signal?: AbortSignal) =>
    api.get<Manager[]>('/admins', params, signal),
  create: (input: NewTeamMemberInput & { role?: 'admin' | 'manager' }) =>
    api.post<{
      admin: User;
      email: { delivered: boolean; mode: string; error?: string };
      message: string;
    }>('/admins', input),
  remove: (id: number) =>
    api.delete<{ id: number; transferred: number; message: string }>(`/admins/${id}`),
  setAccess: (id: number, isActive: boolean) =>
    api.patch<User>(`/admins/${id}`, { isActive }),
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
  assigneeId?: number | string;
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
    projectId: number;
    taskId?: number | null;
    title: string;
    description: string;
    severity: TicketSeverity;
  }) => api.post<{ ticket: Ticket; message: string }>('/tickets', input),
  assign: (id: number, assigneeId: number | null) =>
    api.patch<Ticket>(`/tickets/${id}/assign`, { assigneeId }),
  updateStatus: (id: number, status: TicketStatus, resolutionNote?: string) =>
    api.patch<Ticket>(`/tickets/${id}/status`, { status, resolutionNote }),
  update: (id: number, patch: { title?: string; description?: string; severity?: TicketSeverity; assigneeId?: number | null }) =>
    api.patch<Ticket>(`/tickets/${id}`, patch),
  remove: (id: number) => api.delete<{ message: string }>(`/tickets/${id}`),
};

/* ------------------------------------------------------------ personal todos */

export const todoApi = {
  list: (date?: string, signal?: AbortSignal) =>
    api.get<PersonalTodo[]>('/todos', { date }, signal),
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
  get: () => api.get<User>('/profile'),
  update: (patch: Partial<Pick<User, 'name' | 'department' | 'phone'>> & { jobTitle?: string | null }) =>
    api.patch<User>('/profile', patch),
};

export const chatApi = {
  contacts: (search?: string, signal?: AbortSignal) => api.get<ChatContact[]>('/chat/contacts', { search }, signal),
  unreadCount: (signal?: AbortSignal) => api.get<ChatUnread>('/chat/unread-count', undefined, signal),
  messages: (userId: number, after = 0, signal?: AbortSignal) => api.get<ChatMessage[]>(`/chat/${userId}/messages`, { after }, signal),
  send: (userId: number, body: string) => api.post<ChatMessage>(`/chat/${userId}/messages`, { body }),
  edit: (messageId: number, body: string) => api.patch<ChatMessage>(`/chat/messages/${messageId}`, { body }),
  remove: (messageId: number) => api.delete<{ message: string }>(`/chat/messages/${messageId}`),
  teamMessages: (after = 0, signal?: AbortSignal) => api.get<TeamMessage[]>('/chat/team/messages', { after }, signal),
  sendTeam: (body: string) => api.post<TeamMessage>('/chat/team/messages', { body }),
  editTeam: (messageId: number, body: string) => api.patch<TeamMessage>(`/chat/team/messages/${messageId}`, { body }),
  removeTeam: (messageId: number) => api.delete<{ message: string }>(`/chat/team/messages/${messageId}`),
  groups: {
    list: (signal?: AbortSignal) => api.get<ChatGroup[]>('/chat/groups', undefined, signal),
    messages: (groupId: number, after = 0, signal?: AbortSignal) => api.get<GroupMessage[]>(`/chat/groups/${groupId}/messages`, { after }, signal),
    send: (groupId: number, body: string) => api.post<GroupMessage>(`/chat/groups/${groupId}/messages`, { body }),
    edit: (groupId: number, messageId: number, body: string) => api.patch<GroupMessage>(`/chat/groups/${groupId}/messages/${messageId}`, { body }),
    remove: (groupId: number, messageId: number) => api.delete<{ message: string }>(`/chat/groups/${groupId}/messages/${messageId}`),
  },
};
