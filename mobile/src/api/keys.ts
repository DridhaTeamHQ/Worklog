import type { DashboardRange } from '@/types';
import type { ReportFilters, TaskFilters, TicketFilters, ActivityEntity } from './endpoints';

/**
 * Query keys, in one place. Every list key starts with the same prefix as the detail
 * keys for its domain, so invalidating `qk.tasks.all` refreshes every task screen.
 */
export const qk = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  dashboard: (range?: DashboardRange) => ['dashboard', range ?? 'today'] as const,
  analytics: (params: Record<string, unknown>) => ['analytics', params] as const,
  tasks: {
    all: ['tasks'] as const,
    list: (f: TaskFilters) => ['tasks', 'list', f] as const,
    detail: (id: number) => ['tasks', 'detail', id] as const,
  },
  activity: (entity: ActivityEntity, id: number) => ['activity', entity, id] as const,
  checklist: (taskId: number) => ['checklist', taskId] as const,
  labels: ['labels'] as const,
  reports: {
    all: ['reports'] as const,
    list: (f: ReportFilters) => ['reports', 'list', f] as const,
    today: ['reports', 'today'] as const,
    suggestions: ['reports', 'suggestions'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
    unread: ['notifications', 'unread'] as const,
  },
  team: {
    all: ['team'] as const,
    list: (p: Record<string, unknown>) => ['team', 'list', p] as const,
    detail: (id: number) => ['team', 'detail', id] as const,
    reports: (id: number, f: ReportFilters) => ['team', 'reports', id, f] as const,
    tasks: (id: number) => ['team', 'tasks', id] as const,
    departments: ['team', 'departments'] as const,
  },
  admins: ['admins'] as const,
  projects: {
    all: ['projects'] as const,
    list: (includeArchived: boolean) => ['projects', 'list', includeArchived] as const,
    detail: (id: number) => ['projects', 'detail', id] as const,
  },
  tickets: {
    all: ['tickets'] as const,
    list: (f: TicketFilters) => ['tickets', 'list', f] as const,
    detail: (id: number) => ['tickets', 'detail', id] as const,
  },
  todos: (date: string) => ['todos', date] as const,
};
