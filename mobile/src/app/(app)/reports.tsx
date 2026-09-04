import { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, UserRound } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useReports } from '@/hooks/useReports';
import { useTeam } from '@/hooks/useTeam';
import { formatDate } from '@/lib/format';
import type { DailyReport } from '@/types';
import { EmptyState, ErrorState, IconPillButton, PickerSheet, Reveal, ScreenHeader, SearchField, SegmentedTabs, SkeletonList, Text, useSheet } from '@/components';
import { ReportCard } from '@/features/ReportCard';

type Range = 'today' | 'week' | 'month' | 'all';

/** The whole team's daily reports, grouped by day, newest first. */
export default function TaskReports() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('week');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const employeeSheet = useSheet();
  const team = useTeam();
  const reports = useReports({ range, employeeId: employeeId ?? undefined, search: search || undefined, limit: 200 });

  const sections = useMemo(() => {
    const map = new Map<string, DailyReport[]>();
    for (const r of reports.data?.items ?? []) {
      const list = map.get(r.report_date) ?? [];
      list.push(r);
      map.set(r.report_date, list);
    }
    return [...map.entries()].map(([date, data]) => ({ title: date, data }));
  }, [reports.data]);

  const employeeOptions = (team.data ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.department ?? undefined }));
  const count = reports.data?.items.length ?? 0;
  const people = new Set((reports.data?.items ?? []).map((r) => r.employee_id)).size;
  const rangeWord: Record<Range, string> = { today: 'today', week: 'this week', month: 'this month', all: 'in total' };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <SectionList
        sections={reports.isPending ? [] : sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: t.colors.ground, paddingVertical: 8 }}>
            <Text variant="smallStrong" color="inkMuted">{formatDate(section.title)} · {section.data.length} report{section.data.length === 1 ? '' : 's'}</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <ReportCard report={item} showEmployee maxLines={8} onPress={() => router.push(`/team/${item.employee_id}`)} />
          </Reveal>
        )}
        ListHeaderComponent={(
          <View style={{ gap: 12, paddingTop: insets.top + 8, paddingBottom: 4 }}>
            <ScreenHeader big={false} title="Task reports" subtitle={reports.data ? `${count} ${count === 1 ? 'report' : 'reports'} ${rangeWord[range]}${people ? ` · ${people} ${people === 1 ? 'person' : 'people'}` : ''}` : undefined} right={<IconPillButton icon={UserRound} tone={employeeId ? 'ink' : 'soft'} onPress={employeeSheet.open} accessibilityLabel="Filter by person" />} />
            <SegmentedTabs items={[{ key: 'today', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'all', label: 'All' }]} value={range} onChange={setRange} />
            <SearchField value={search} onChange={setSearch} placeholder="Search report text or people" loading={reports.isFetching && !!search} />
          </View>
        )}
        ListEmptyComponent={reports.isPending ? <SkeletonList count={3} /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : (
          <EmptyState icon={ClipboardList} title="No reports in this period" body="Widen the range, or check back at the end of the day." />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshing={reports.isRefetching}
        onRefresh={() => reports.refetch()}
        keyboardShouldPersistTaps="handled"
      />
      <PickerSheet ref={employeeSheet.ref} title="Person" options={employeeOptions} value={employeeId} onSelect={setEmployeeId} searchable clearLabel="Everyone" onClear={() => setEmployeeId(null)} />
    </View>
  );
}
