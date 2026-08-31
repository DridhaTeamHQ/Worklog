/**
 * `admin` is a strict superset of `manager`: it reaches every manager screen and, on
 * top of that, is the only role that can grant admin access.
 */
export type Role = 'admin' | 'manager' | 'team_member';

/** Roles that reach the manager portal. Mirrors backend/src/utils/roles.js. */
export const MANAGER_ROLES: Role[] = ['admin', 'manager'];

/**
 * Type predicates, not plain booleans: narrowing `Role` down to the elevated tiers
 * lets callers pass the value straight to an API that only accepts those two.
 */
export const isManagerLevel = (role: Role | undefined): role is 'admin' | 'manager' =>
  role === 'admin' || role === 'manager';

export const isAdmin = (role: Role | undefined): role is 'admin' => role === 'admin';

export const roleLabel = (role: Role | undefined): string =>
  role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Team Member';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
/** `effective_status` may additionally be 'overdue', which the server derives. */
export type EffectiveStatus = TaskStatus | 'overdue';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  job_title: string | null;
  phone: string | null;
  profile_image: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCounts {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

/**
 * `invited` means the account has been created but nobody has claimed it yet — the
 * person has not chosen a password, so they have never signed in.
 */
export interface TeamMember extends User {
  invited: boolean;
  counts: TaskCounts;
  current_status: EffectiveStatus | 'idle';
  last_report_date: string | null;
  submitted_today: boolean;
}

/** A user with manager access, plus how much work they have out with the team. */
export interface Manager extends User {
  invited: boolean;
  assigned_tasks: number;
  open_tasks: number;
}

export interface TeamMemberDetail extends User {
  invited: boolean;
  counts: TaskCounts;
  report_count: number;
}

export interface Project {
  id: number;
  name: string;
  project_key: string;
  description: string | null;
  lead_id: number | null;
  lead_name: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  counts: TaskCounts;
}

export interface Task {
  id: number;
  employee_id: number;
  manager_id: number;
  /** Project the task belongs to. Null only for legacy rows the backfill missed. */
  project_id: number | null;
  task_number: number | null;
  project_name: string | null;
  project_key: string | null;
  /** Human-facing key, e.g. "SHMOB-5". Null when the task has no project. */
  task_key: string | null;
  title: string;
  description: string;
  notes: string | null;
  priority: Priority;
  start_date: string | null;
  deadline: string | null;
  status: TaskStatus;
  effective_status: EffectiveStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  employee_name: string;
  employee_email: string;
  employee_department: string | null;
  employee_profile_image: string | null;
  manager_name: string;
  manager_profile_image: string | null;
}

export interface DailyReport {
  id: number;
  employee_id: number;
  report_date: string;
  task_description: string;
  created_at: string;
  updated_at: string;
  employee_name: string;
  employee_email: string;
  employee_department: string | null;
}

export type TicketSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Ticket {
  id: number;
  project_id: number;
  task_id: number | null;
  reporter_id: number;
  ticket_number: number;
  /** Human-facing key, e.g. "SHMOB-B3". */
  ticket_key: string;
  title: string;
  description: string;
  severity: TicketSeverity;
  status: TicketStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  project_name: string;
  project_key: string;
  reporter_name: string;
  reporter_email: string;
  reporter_department: string | null;
  reporter_profile_image: string | null;
  /** Null if the linked task was deleted after the ticket was raised. */
  task_title: string | null;
  task_key: string | null;
}

/**
 * A private note-to-self about what someone plans to do on a day.
 *
 * Deliberately not a `Task`: nobody assigns these, nobody else can see them, and they
 * never reach a report or an analytic. Keeping the two types apart is what stops one
 * being rendered where the other is meant.
 */
export interface PersonalTodo {
  id: number;
  user_id: number;
  title: string;
  /** The day it is for, 'YYYY-MM-DD'. */
  todo_date: string;
  is_done: boolean;
  done_at: string | null;
  /** Optional context. Null when the note is not filed against anything. */
  project_id: number | null;
  task_id: number | null;
  project_name: string | null;
  project_key: string | null;
  task_title: string | null;
  task_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCounts {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  critical_open: number;
  unresolved: number;
}

export type NotificationType =
  | 'task_assigned' | 'task_updated' | 'status_changed' | 'report_submitted'
  | 'ticket_raised' | 'ticket_updated' | 'general';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  related_task_id: number | null;
  related_ticket_id: number | null;
  task_title: string | null;
  task_employee_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface ManagerSummary {
  open_tickets: number;
  critical_tickets: number;
  total_team_members: number;
  tasks_assigned_today: number;
  tasks_completed_today: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  total_tasks: number;
  reports_submitted_today: number;
  reports_pending_today: number;
}

export interface EmployeeSummary {
  open_tickets: number;
  total_tickets: number;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completed_today: number;
  total_reports: number;
  reports_this_week: number;
  submitted_today: boolean;
  today_report_updated_at: string | null;
}

export interface StatusBreakdown {
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface ActivityPoint {
  day: string;
  assigned: number;
  completed: number;
  reports: number;
}

export interface WeeklyPoint {
  week_start: string;
  assigned: number;
  completed: number;
  reports: number;
}

export interface ProductivityRow {
  employee_id: number;
  employee_name: string;
  department: string | null;
  assigned: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  completion_rate: number;
}

export interface ManagerDashboard {
  role: 'manager' | 'admin';
  summary: ManagerSummary;
  breakdown: StatusBreakdown;
  activity: ActivityPoint[];
  recent_tasks: Task[];
  recent_reports: DailyReport[];
  open_tickets: Ticket[];
}

export interface EmployeeDashboard {
  role: 'team_member';
  summary: EmployeeSummary;
  upcoming_tasks: Task[];
  recent_reports: DailyReport[];
  today_report: DailyReport | null;
  recent_tickets: Ticket[];
}

export interface AnalyticsPayload {
  summary: ManagerSummary;
  productivity: ProductivityRow[];
  breakdown: StatusBreakdown;
  daily: ActivityPoint[];
  weekly: WeeklyPoint[];
}
