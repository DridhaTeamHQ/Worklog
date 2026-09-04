import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import type { PersonalTodo } from '@/types';

export function useTodos(date: string) {
  return useQuery({
    queryKey: qk.todos(date),
    queryFn: async ({ signal }) => (await todoApi.list(date, signal)).data,
    placeholderData: (prev) => prev,
  });
}

export function useCreateTodo(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, context }: { title: string; context?: { projectId?: number; taskId?: number } }) =>
      todoApi.create(title, date, context),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.todos(date) }); },
  });
}

/** Optimistic: the circle fills at once. */
export function useToggleTodo(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: number; isDone: boolean }) => todoApi.update(id, { isDone }),
    onMutate: async ({ id, isDone }) => {
      await qc.cancelQueries({ queryKey: qk.todos(date) });
      const prev = qc.getQueryData<PersonalTodo[]>(qk.todos(date));
      if (prev) qc.setQueryData(qk.todos(date), prev.map((t) => (t.id === id ? { ...t, is_done: isDone } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.todos(date), ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.todos(date) }); },
  });
}

export function useDeleteTodo(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => todoApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.todos(date) });
      const prev = qc.getQueryData<PersonalTodo[]>(qk.todos(date));
      if (prev) qc.setQueryData(qk.todos(date), prev.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.todos(date), ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.todos(date) }); },
  });
}
