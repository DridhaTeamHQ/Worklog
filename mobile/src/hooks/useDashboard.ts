import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import type { DashboardRange, EmployeeDashboard, ManagerDashboard } from '@/types';

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: qk.dashboard('today'),
    queryFn: async ({ signal }) => (await dashboardApi.load({}, signal)).data as EmployeeDashboard,
  });
}

export function useManagerDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: qk.dashboard(range),
    queryFn: async ({ signal }) => (await dashboardApi.load({ range }, signal)).data as ManagerDashboard,
    placeholderData: (prev) => prev,
  });
}

export function useAnalytics(params: { employeeId?: number; department?: string; from?: string; to?: string; days?: number }) {
  return useQuery({
    queryKey: qk.analytics(params),
    queryFn: async ({ signal }) => (await dashboardApi.analytics(params, signal)).data,
    placeholderData: (prev) => prev,
  });
}
