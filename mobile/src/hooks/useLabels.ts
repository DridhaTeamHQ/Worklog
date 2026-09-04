import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labelApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useLabels() {
  return useQuery({
    queryKey: qk.labels,
    queryFn: async ({ signal }) => (await labelApi.list(signal)).data,
    staleTime: 5 * 60_000,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => labelApi.create(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.labels }); },
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => labelApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.labels });
      void qc.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}
