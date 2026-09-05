import { PageIntro } from '@/components/ScreenHeader';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bug, Circle, CircleAlert, CircleCheck, CircleDot, CircleX, List, Plus } from 'lucide-react-native';
import { useTheme, TAB_BAR_HEIGHT, TAB_BAR_INSET } from '@/theme';
import { useTickets } from '@/hooks/useTickets';
import { EmptyState, ErrorState, IconPillButton, Reveal, SearchField, SegmentedTabs, SkeletonList, Text, useTabBarInset } from '@/components';
import { useAutoHideTabBar } from '@/lib/tabBar';
import { TicketCard } from '@/features/TicketCard';

type Tab = 'unresolved' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'all';

/** The member's bug tickets, with a floating "+" to raise one. */
export default function MemberTickets() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const barScroll = useAutoHideTabBar();
  const [tab, setTab] = useState<Tab>('unresolved');
  const [search, setSearch] = useState('');
  const list = useTickets({ status: tab === 'all' ? undefined : tab, search: search || undefined, sort: 'created_desc', limit: 200 });
  const counts = list.data?.counts;

  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16 }}>
      <PageIntro title="Tickets" tone="clay" eyebrow="CLEAR THE WAY" subtitle={counts ? `${counts.unresolved} need attention · ${counts.total} raised` : ' '} />
      <SegmentedTabs scroll iconic={false}
        items={[
          { key: 'unresolved', label: 'Attention', icon: CircleAlert, count: counts?.unresolved },
          { key: 'open', label: 'Open', icon: Circle, count: counts?.open },
          { key: 'in_progress', label: 'In progress', icon: CircleDot, count: counts?.in_progress },
          { key: 'resolved', label: 'Resolved', icon: CircleCheck, count: counts?.resolved },
          { key: 'closed', label: 'Closed', icon: CircleX, count: counts?.closed },
          { key: 'all', label: 'All', icon: List },
        ]}
        value={tab}
        onChange={setTab}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search tickets" loading={list.isFetching && !!search} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={list.isPending ? [] : list.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <TicketCard ticket={item} onPress={() => router.push(`/tickets/${item.id}`)} />
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={list.isPending ? <SkeletonList count={3} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <EmptyState icon={Bug} title={tab === 'unresolved' && !search ? 'Nothing needs attention' : 'No tickets here'} body="Hit a bug while working on a task? Raise a ticket and your manager is told." action={{ label: 'Raise a ticket', onPress: () => router.push('/tickets/new') }} />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom + 64 }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        keyboardShouldPersistTaps="handled"
      />
      <View style={{ position: 'absolute', right: TAB_BAR_INSET, bottom: TAB_BAR_HEIGHT + TAB_BAR_INSET + Math.max(insets.bottom, 12) + 16 }}>
        <IconPillButton icon={Plus} size={56} tone="white" onPress={() => router.push('/tickets/new')} accessibilityLabel="Raise a ticket" />
      </View>
    </View>
  );
}
