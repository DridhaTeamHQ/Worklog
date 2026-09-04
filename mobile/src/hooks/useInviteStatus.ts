import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { useDebounce } from './useDebounce';

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/**
 * Mirrors the web sign-in page: once the address looks complete and has stopped
 * changing for a moment, ask whether it is an unclaimed invite. Answers only for that
 * one state, so a typo or a claimed account looks the same as an unknown address.
 */
export function useInviteStatus(email: string) {
  const debounced = useDebounce(email.trim().toLowerCase(), 450);
  const enabled = looksLikeEmail(debounced);
  const query = useQuery({
    queryKey: ['invite-status', debounced],
    queryFn: async ({ signal }) => (await authApi.inviteStatus(debounced, signal)).data,
    enabled,
    staleTime: 30_000,
    retry: 0,
  });
  return {
    invited: enabled && query.data?.invited === true,
    name: query.data?.name,
    checking: enabled && query.isFetching,
  };
}
