import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportApi, type ReportFilters, type ReportItemInput } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useReports(filters: ReportFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.reports.list(filters),
    queryFn: async ({ signal }) => {
      const res = await reportApi.list(filters, signal);
      return { items: res.data, total: Number(res.meta?.total ?? res.data.length) };
    },
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

/** Today's report plus which date the server considers "today" for this phone. */
export function useTodayReport() {
  return useQuery({
    queryKey: qk.reports.today,
    queryFn: async ({ signal }) => {
      const res = await reportApi.today(signal);
      return {
        report: res.data,
        today: String(res.meta?.today ?? ''),
        timezone: String(res.meta?.timezone ?? ''),
      };
    },
  });
}

export function useReportSuggestions(enabled = true) {
  return useQuery({
    queryKey: qk.reports.suggestions,
    queryFn: async ({ signal }) => (await reportApi.suggestions(signal)).data,
    enabled,
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskDescription?: string; items?: ReportItemInput[] }) => reportApi.save(input),
    onSuccess: (res) => {
      qc.setQueryData(qk.reports.today, (prev: { report: unknown; today: string; timezone: string } | undefined) =>
        (prev ? { ...prev, report: res.data.report } : prev));
      void qc.invalidateQueries({ queryKey: qk.reports.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reportApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.reports.all });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
