import { useEffect, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CheckCheck } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/hooks/useNotifications';
import { usePrefs } from '@/lib/prefs';
import { describePushOutcome, registerForPush } from '@/push/registerForPush';
import { pathForNotification } from '@/push/notificationRoute';
import { isManagerLevel } from '@/types';
import { BentoCard, EmptyState, ErrorState, InsightCard, Reveal, ScreenHeader, SegmentedTabs, SkeletonList, Text, TextButton, useToast } from '@/components';
import { NotificationRow } from '@/features/NotificationRow';

/** The feed. Tap a row to go where it points; the card on top manages this phone's pushes. */
export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const user = useUser();
  const params = useLocalSearchParams<{ settings?: string }>();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const list = useNotifications(tab === 'unread');
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const prefs = usePrefs();
  const [showSettings, setShowSettings] = useState(Boolean(params.settings));
  const manager = isManagerLevel(user?.role);

  useEffect(() => { if (params.settings) setShowSettings(true); }, [params.settings]);

  const enable = async () => {
    const outcome = await registerForPush({ prompt: true });
    const said = describePushOutcome(outcome);
    if (!said) return;
    if (outcome === 'registered') toast.success(said.title, said.message);
    else if (outcome === 'denied' || outcome === 'failed') toast.error(said.title, said.message);
    else toast.show(said);
  };

  const open = (n: (typeof items)[number]) => {
    if (!n.is_read) markRead.mutate(n.id);
    const path = pathForNotification(n, manager);
    if (path) router.push(path as never);
  };

  const items = list.data?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={list.isPending ? [] : items}
        keyExtractor={(n) => String(n.id)}
        renderItem={({ item, index }) => <Reveal index={index} style={{ marginBottom: 10 }}><NotificationRow notification={item} onPress={() => open(item)} /></Reveal>}
        ListHeaderComponent={(
          <View style={{ gap: 12, paddingTop: insets.top + 8, paddingBottom: 6 }}>
            <ScreenHeader big={false} title="Notifications" subtitle={list.data ? (list.data.unread ? `${list.data.unread} unread` : 'All caught up') : undefined} right={list.data?.unread ? <TextButton label="Mark all read" icon={CheckCheck} onPress={() => markAll.mutate()} /> : undefined} />
            {prefs.pushPermission !== 'granted' ? (
              <InsightCard eyebrow="This phone" title="Pushes are off" detail="Turn them on to hear about new tasks and comments" icon={Bell} onPress={enable} />
            ) : showSettings ? (
              <BentoCard padding={t.spacing.lg}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Bell size={18} color={t.colors.hero} />
                  <Text variant="small" color="inkMuted" style={{ flex: 1 }}>Pushes are on for this phone.</Text>
                  <TextButton label="Phone settings" onPress={() => { Linking.openSettings().catch(() => toast.show({ title: 'Phone settings', message: 'Turn Taskr notifications off from your phone\'s Settings app.' })); }} />
                </View>
              </BentoCard>
            ) : null}
            <SegmentedTabs items={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: list.data?.unread }]} value={tab} onChange={setTab} />
          </View>
        )}
        ListEmptyComponent={list.isPending ? <SkeletonList count={4} lines={1} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <EmptyState icon={Bell} title={tab === 'unread' ? 'Nothing unread' : 'Nothing yet'} body="Task assignments, comments and reminders will collect here." />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
      />
    </View>
  );
}
