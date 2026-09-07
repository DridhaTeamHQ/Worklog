import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, teamApi, type ReportFilters } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useTeam(params: { search?: string; department?: string } = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.team.list(params),
    queryFn: async ({ signal }) => (await teamApi.list(params, signal)).data,
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof teamApi.create>[0]) => teamApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.team.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof adminApi.create>[0]) => adminApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.team.all });
      void qc.invalidateQueries({ queryKey: qk.admins });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & Parameters<typeof adminApi.setRole>[1]) => adminApi.setRole(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.team.all });
      void qc.invalidateQueries({ queryKey: qk.admins });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: qk.team.departments,
    queryFn: async ({ signal }) => (await teamApi.departments(signal)).data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useTeamMember(id: number | null) {
  return useQuery({
    queryKey: qk.team.detail(id ?? 0),
    queryFn: async ({ signal }) => (await teamApi.detail(id as number, signal)).data,
    enabled: !!id,
  });
}

export function useTeamMemberReports(id: number | null, filters: ReportFilters) {
  return useQuery({
    queryKey: qk.team.reports(id ?? 0, filters),
    queryFn: async ({ signal }) => {
      const res = await teamApi.reports(id as number, filters, signal);
      return { items: res.data, total: Number(res.meta?.total ?? res.data.length) };
    },
    placeholderData: (prev) => prev,
    enabled: !!id,
  });
}

export function useTeamMemberTasks(id: number | null) {
  return useQuery({
    queryKey: qk.team.tasks(id ?? 0),
    queryFn: async ({ signal }) => (await teamApi.tasks(id as number, signal)).data,
    enabled: !!id,
  });
}

export function useAdmins(enabled = true) {
  return useQuery({
    queryKey: qk.admins,
    queryFn: async ({ signal }) => (await adminApi.list({}, signal)).data,
    enabled,
  });
}
