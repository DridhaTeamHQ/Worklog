import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checklistApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import type { ChecklistItem } from '@/types';

export function useChecklist(taskId: number | null) {
  return useQuery({
    queryKey: qk.checklist(taskId ?? 0),
    queryFn: async ({ signal }) => (await checklistApi.list(taskId as number, signal)).data,
    enabled: !!taskId,
  });
}

function afterChange(qc: ReturnType<typeof useQueryClient>, taskId: number) {
  void qc.invalidateQueries({ queryKey: qk.checklist(taskId) });
  void qc.invalidateQueries({ queryKey: qk.tasks.all });
  void qc.invalidateQueries({ queryKey: qk.activity('task', taskId) });
}

export function useAddChecklistItem(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => checklistApi.add(taskId, title),
    onSuccess: () => afterChange(qc, taskId),
  });
}

/** Optimistic tick: the circle fills the moment it is tapped. */
export function useToggleChecklistItem(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, isDone }: { itemId: number; isDone: boolean }) => checklistApi.update(taskId, itemId, { isDone }),
    onMutate: async ({ itemId, isDone }) => {
      await qc.cancelQueries({ queryKey: qk.checklist(taskId) });
      const prev = qc.getQueryData<ChecklistItem[]>(qk.checklist(taskId));
      if (prev) {
        qc.setQueryData(qk.checklist(taskId), prev.map((i) => (i.id === itemId
          ? { ...i, is_done: isDone, done_at: isDone ? new Date().toISOString() : null }
          : i)));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.checklist(taskId), ctx.prev); },
    onSettled: () => afterChange(qc, taskId),
  });
}

export function useRenameChecklistItem(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, title }: { itemId: number; title: string }) => checklistApi.update(taskId, itemId, { title }),
    onSuccess: () => afterChange(qc, taskId),
  });
}

export function useDeleteChecklistItem(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => checklistApi.remove(taskId, itemId),
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: qk.checklist(taskId) });
      const prev = qc.getQueryData<ChecklistItem[]>(qk.checklist(taskId));
      if (prev) qc.setQueryData(qk.checklist(taskId), prev.filter((i) => i.id !== itemId));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.checklist(taskId), ctx.prev); },
    onSettled: () => afterChange(qc, taskId),
  });
}
