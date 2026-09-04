import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: qk.projects.list(includeArchived),
    queryFn: async ({ signal }) => (await projectApi.list({ includeArchived }, signal)).data,
    staleTime: 60_000,
  });
}

export function useProject(id: number | null) {
  return useQuery({
    queryKey: qk.projects.detail(id ?? 0),
    queryFn: async ({ signal }) => (await projectApi.get(id as number, signal)).data,
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof projectApi.create>[0]) => projectApi.create(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.projects.all }); },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof projectApi.update>[1] }) => projectApi.update(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.all });
      // A re-keyed project renames every task in it.
      void qc.invalidateQueries({ queryKey: qk.tasks.all });
      void qc.invalidateQueries({ queryKey: qk.tickets.all });
    },
  });
}
