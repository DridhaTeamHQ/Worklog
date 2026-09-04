import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi, type AssignTaskInput, type TaskFilters } from '@/api/endpoints';
import { qk } from '@/api/keys';
import type { Task, TaskStatus } from '@/types';

export function useTasks(filters: TaskFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.tasks.list(filters),
    queryFn: async ({ signal }) => {
      const res = await taskApi.list(filters, signal);
      return { items: res.data, total: Number(res.meta?.total ?? res.data.length) };
    },
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: qk.tasks.detail(id ?? 0),
    queryFn: async ({ signal }) => (await taskApi.get(id as number, signal)).data,
    enabled: !!id,
  });
}

/** Everything that shows a task's status or counts. */
function invalidateTaskViews(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.tasks.all });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: qk.team.all });
  void qc.invalidateQueries({ queryKey: qk.projects.all });
  void qc.invalidateQueries({ queryKey: qk.notifications.all });
  void qc.invalidateQueries({ queryKey: qk.reports.suggestions });
}

/**
 * Optimistic: the new status appears in every list and the detail at once, and is
 * rolled back if the server refuses.
 */
export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => taskApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.tasks.all });
      const patch = (t: Task): Task => (t.id === id
        ? { ...t, status, effective_status: status === 'completed' ? 'completed' : (t.effective_status === 'overdue' ? 'overdue' : status) }
        : t);
      const lists = qc.getQueriesData<{ items: Task[]; total: number }>({ queryKey: ['tasks', 'list'] });
      const detail = qc.getQueryData<Task>(qk.tasks.detail(id));
      lists.forEach(([key, data]) => { if (data) qc.setQueryData(key, { ...data, items: data.items.map(patch) }); });
      if (detail) qc.setQueryData(qk.tasks.detail(id), patch(detail));
      return { lists, detail };
    },
    onError: (_err, { id }, ctx) => {
      ctx?.lists.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.detail) qc.setQueryData(qk.tasks.detail(id), ctx.detail);
    },
    onSuccess: (res, { id }) => { qc.setQueryData(qk.tasks.detail(id), res.data); },
    onSettled: () => invalidateTaskViews(qc),
  });
}

export function useAssignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => taskApi.assign(input),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof taskApi.update>[1] }) => taskApi.update(id, patch),
    onSuccess: (res, { id }) => {
      qc.setQueryData(qk.tasks.detail(id), res.data);
      invalidateTaskViews(qc);
      void qc.invalidateQueries({ queryKey: qk.activity('task', id) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => taskApi.remove(id),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: qk.tasks.detail(id) });
      invalidateTaskViews(qc);
      void qc.invalidateQueries({ queryKey: qk.tickets.all });
    },
  });
}

export function useSetTaskLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, labelIds }: { id: number; labelIds: number[] }) => taskApi.setLabels(id, labelIds),
    onSuccess: (res, { id }) => {
      const detail = qc.getQueryData<Task>(qk.tasks.detail(id));
      if (detail) qc.setQueryData(qk.tasks.detail(id), { ...detail, labels: res.data });
      void qc.invalidateQueries({ queryKey: qk.tasks.all });
      void qc.invalidateQueries({ queryKey: qk.labels });
      void qc.invalidateQueries({ queryKey: qk.activity('task', id) });
    },
  });
}
