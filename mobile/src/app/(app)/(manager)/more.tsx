import { useRouter } from 'expo-router';
import { useUser } from '@/auth/store';
import { useUnreadCount } from '@/hooks/useNotifications';
import { MoreScreen } from '@/features/MoreScreen';

export default function ManagerMore() {
  const router = useRouter();
  const user = useUser();
  const unread = useUnreadCount();
  return <MoreScreen user={user} unread={unread.data ?? 0} onOpen={(path) => router.push(path as never)} />;
}
