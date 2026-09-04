import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketApi, type TicketFilters } from '@/api/endpoints';
import { qk } from '@/api/keys';
import type { TicketCounts, TicketSeverity, TicketStatus } from '@/types';

const EMPTY_COUNTS: TicketCounts = { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, critical_open: 0, unresolved: 0 };

export function useTickets(filters: TicketFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.tickets.list(filters),
    queryFn: async ({ signal }) => {
      const res = await ticketApi.list(filters, signal);
      return {
        items: res.data,
        total: Number(res.meta?.total ?? res.data.length),
        counts: (res.meta?.counts as TicketCounts | undefined) ?? EMPTY_COUNTS,
      };
    },
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

export function useTicket(id: number | null) {
  return useQuery({
    queryKey: qk.tickets.detail(id ?? 0),
    queryFn: async ({ signal }) => (await ticketApi.get(id as number, signal)).data,
    enabled: !!id,
  });
}

function afterChange(qc: ReturnType<typeof useQueryClient>, id?: number) {
  void qc.invalidateQueries({ queryKey: qk.tickets.all });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: qk.notifications.all });
  if (id) void qc.invalidateQueries({ queryKey: qk.activity('ticket', id) });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof ticketApi.create>[0]) => ticketApi.create(input),
    onSuccess: (res) => {
      afterChange(qc);
      if (res.data.ticket.task_id) {
        void qc.invalidateQueries({ queryKey: qk.tasks.detail(res.data.ticket.task_id) });
        void qc.invalidateQueries({ queryKey: qk.activity('task', res.data.ticket.task_id) });
      }
    },
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolutionNote }: { id: number; status: TicketStatus; resolutionNote?: string }) =>
      ticketApi.updateStatus(id, status, resolutionNote),
    onSuccess: (res, { id }) => {
      qc.setQueryData(qk.tickets.detail(id), res.data);
      afterChange(qc, id);
    },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { title?: string; description?: string; severity?: TicketSeverity } }) =>
      ticketApi.update(id, patch),
    onSuccess: (res, { id }) => {
      qc.setQueryData(qk.tickets.detail(id), res.data);
      afterChange(qc, id);
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ticketApi.remove(id),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: qk.tickets.detail(id) });
      afterChange(qc);
    },
  });
}
