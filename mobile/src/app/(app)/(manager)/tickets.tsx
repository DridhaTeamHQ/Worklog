import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bug, Circle, CircleAlert, CircleCheck, CircleDot, CircleX, List, SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTickets } from '@/hooks/useTickets';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import type { TicketSeverity } from '@/types';
import {
  EmptyState, ErrorState, IconPillButton, PickerField, PickerSheet, PillButton, Reveal, SearchField, SegmentedTabs, Sheet,
  SkeletonList, Text, useSheet, useTabBarInset,
} from '@/components';
import { useAutoHideTabBar } from '@/lib/tabBar';
import { TicketCard } from '@/features/TicketCard';

type Tab = 'unresolved' | 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';
const SEVERITIES: { value: TicketSeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
];
const SORTS = [
  { value: 'severity_desc', label: 'Most severe first' }, { value: 'status_asc', label: 'By status' },
  { value: 'created_desc', label: 'Newest' }, { value: 'created_asc', label: 'Oldest' },
];

/** Every ticket the team has raised, defaulting to the ones that still need attention. */
export default function ManagerTickets() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const barScroll = useAutoHideTabBar();
  const [tab, setTab] = useState<Tab>('unresolved');
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [reporterId, setReporterId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<TicketSeverity | null>(null);
  const [sort, setSort] = useState('severity_desc');
  const filterSheet = useSheet();
  const projectSheet = useSheet();
  const reporterSheet = useSheet();
  const severitySheet = useSheet();
  const sortSheet = useSheet();

  const projects = useProjects(true);
  const team = useTeam();
  const list = useTickets({
    status: tab === 'all' ? undefined : tab,
    search: search || undefined,
    projectId: projectId ?? undefined,
    reporterId: reporterId ?? undefined,
    severity: severity ?? undefined,
    sort,
    limit: 200,
  });
  const counts = list.data?.counts;
  const activeFilters = [projectId, reporterId, severity].filter((v) => v != null).length + (sort !== 'severity_desc' ? 1 : 0);

  const projectOptions = useMemo(() => (projects.data ?? []).map((p) => ({ value: p.id, label: `${p.project_key} · ${p.name}` })), [projects.data]);
  const reporterOptions = useMemo(() => (team.data ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.department ?? undefined })), [team.data]);

  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text variant="h1">Tickets</Text>
          <Text variant="small" color="inkMuted">{counts ? `${counts.unresolved} need attention${counts.critical_open ? ` · ${counts.critical_open} critical` : ''}` : ' '}</Text>
        </View>
        <IconPillButton icon={SlidersHorizontal} tone="soft" badge={activeFilters || undefined} onPress={filterSheet.open} accessibilityLabel="Filters" />
      </View>
      <SegmentedTabs
        items={[
          { key: 'unresolved', label: 'Attention', icon: CircleAlert, count: counts?.unresolved },
          { key: 'open', label: 'Open', icon: Circle, count: counts?.open },
          { key: 'in_progress', label: 'In progress', icon: CircleDot, count: counts?.in_progress },
          { key: 'resolved', label: 'Resolved', icon: CircleCheck, count: counts?.resolved },
          { key: 'closed', label: 'Closed', icon: CircleX, count: counts?.closed },
          { key: 'all', label: 'All', icon: List, count: counts?.total },
        ]}
        value={tab}
        onChange={setTab}
      />
      <SearchField value={search} onChange={setSearch} placeholder="Search tickets, keys, people" loading={list.isFetching && !!search} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={list.isPending ? [] : list.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <TicketCard ticket={item} showReporter onPress={() => router.push(`/tickets/${item.id}`)} />
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={list.isPending ? <SkeletonList count={3} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <EmptyState icon={Bug} title={tab === 'unresolved' && !activeFilters && !search ? 'Nothing needs attention' : 'No tickets here'} body="When someone on the team hits a bug, it lands here." />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching}
        onRefresh={() => list.refetch()}
        keyboardShouldPersistTaps="handled"
      />
      <Sheet ref={filterSheet.ref} title="Filters">
        <View style={{ gap: 14 }}>
          <PickerField label="Project" value={projectOptions.find((o) => o.value === projectId)?.label ?? null} placeholder="Any" onPress={projectSheet.open} />
          <PickerField label="Reported by" value={reporterOptions.find((o) => o.value === reporterId)?.label ?? null} placeholder="Anyone" onPress={reporterSheet.open} />
          <PickerField label="Severity" value={SEVERITIES.find((o) => o.value === severity)?.label ?? null} placeholder="Any" onPress={severitySheet.open} />
          <PickerField label="Sort" value={SORTS.find((s) => s.value === sort)?.label ?? null} onPress={sortSheet.open} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <PillButton label="Clear" variant="ghost" onPress={() => { setProjectId(null); setReporterId(null); setSeverity(null); setSort('severity_desc'); }} style={{ flex: 1 }} block />
            <PillButton label="Done" onPress={filterSheet.close} style={{ flex: 1 }} block />
          </View>
        </View>
      </Sheet>
      <PickerSheet ref={projectSheet.ref} title="Project" options={projectOptions} value={projectId} onSelect={setProjectId} clearLabel="Any project" onClear={() => setProjectId(null)} />
      <PickerSheet ref={reporterSheet.ref} title="Reported by" options={reporterOptions} value={reporterId} onSelect={setReporterId} searchable clearLabel="Anyone" onClear={() => setReporterId(null)} />
      <PickerSheet ref={severitySheet.ref} title="Severity" options={SEVERITIES} value={severity} onSelect={setSeverity} clearLabel="Any severity" onClear={() => setSeverity(null)} />
      <PickerSheet ref={sortSheet.ref} title="Sort by" options={SORTS} value={sort} onSelect={setSort} />
    </View>
  );
}
