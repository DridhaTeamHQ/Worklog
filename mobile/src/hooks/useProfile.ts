import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, profileApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import { useAuthStore } from '@/auth/store';

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: async ({ signal }) => (await profileApi.get(signal)).data,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (patch: Parameters<typeof profileApi.update>[0]) => profileApi.update(patch),
    onSuccess: (res) => {
      qc.setQueryData(qk.profile, res.data);
      setUser(res.data);
      void qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
  });
}
