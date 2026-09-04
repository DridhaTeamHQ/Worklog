import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityApi, type ActivityEntity } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useActivity(entity: ActivityEntity, id: number | null) {
  return useQuery({
    queryKey: qk.activity(entity, id ?? 0),
    queryFn: async ({ signal }) => (await activityApi.list(entity, id as number, signal)).data,
    enabled: !!id,
  });
}

export function useAddComment(entity: ActivityEntity, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, mentions }: { body: string; mentions?: number[] }) => activityApi.comment(entity, id, body, mentions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.activity(entity, id) });
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
      void qc.invalidateQueries({ queryKey: entity === 'task' ? qk.tasks.all : qk.tickets.all });
    },
  });
}

export function useEditComment(entity: ActivityEntity, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: number; body: string }) => activityApi.edit(entity, id, commentId, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.activity(entity, id) }); },
  });
}

export function useDeleteComment(entity: ActivityEntity, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => activityApi.remove(entity, id, commentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.activity(entity, id) });
      void qc.invalidateQueries({ queryKey: entity === 'task' ? qk.tasks.all : qk.tickets.all });
    },
  });
}
