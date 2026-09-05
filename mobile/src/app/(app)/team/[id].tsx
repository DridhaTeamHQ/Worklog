import { IdentityCard } from '@/components';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListChecks, Plus } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTeamMember, useTeamMemberReports, useTeamMemberTasks } from '@/hooks/useTeam';
import {
  Avatar, BigNumber, Chip, EmptyState, ErrorState, PillButton, Reveal, Screen, ScreenHeader, SearchField, SegmentedTabs,
  LoadingState, SkeletonList, Text,
} from '@/components';
import { ReportCard } from '@/features/ReportCard';
import { TaskCard } from '@/features/TaskCard';

type Tab = 'reports' | 'tasks';
type Range = 'all' | 'today' | 'week' | 'month';

/** One person: who they are, their numbers, then their reports and their tasks. */
export default function EmployeeDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const detail = useTeamMember(id);
  const [tab, setTab] = useState<Tab>('reports');
  const [range, setRange] = useState<Range>('all');
  const [search, setSearch] = useState('');
  const reports = useTeamMemberReports(id, { range, search: search || undefined, limit: 60 });
  const tasks = useTeamMemberTasks(id);

  const e = detail.data?.employee;
  const c = e?.counts;

  if (detail.isError) return <Screen><ScreenHeader tone="sage" title="Team member" /><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></Screen>;

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => { void detail.refetch(); void reports.refetch(); void tasks.refetch(); }}>
      <ScreenHeader tone="sage" big={false} />

      {detail.isPending || !e ? <LoadingState /> : (
        <>
          <Reveal>
            <IdentityCard name={e.name} image={e.profile_image} subtitle={[e.department, e.job_title].filter(Boolean).join(' · ')} detail={e.email} />
            {e.invited ? <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><Chip label="Invitation pending" color={t.colors.warning} /></View> : null}
          </Reveal>

          <Reveal index={1}>
            <BigNumber size="md" icon={ListChecks} value={c?.completed ?? 0} unit={`of ${c?.total ?? 0} done`} verdict={c?.overdue ? `${c.overdue} overdue — worth a nudge.` : c?.in_progress ? `${c.in_progress} in progress, nothing overdue.` : 'Nothing overdue.'} />
          </Reveal>

          <Reveal index={2}>
            <PillButton label="Assign a task" icon={Plus} variant="hero" size="lg" block onPress={() => router.push({ pathname: '/tasks/assign', params: { employeeId: String(e.id) } })} />
          </Reveal>

          <SegmentedTabs items={[{ key: 'reports', label: 'Reports', count: e.report_count }, { key: 'tasks', label: 'Tasks', count: c?.total }]} value={tab} onChange={setTab} />

          {tab === 'reports' ? (
            <>
              <SegmentedTabs items={[{ key: 'all', label: 'All' }, { key: 'today', label: 'Today' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }]} value={range} onChange={setRange} />
              <SearchField value={search} onChange={setSearch} placeholder="Search their reports" loading={reports.isFetching && !!search} />
              {reports.isPending ? <SkeletonList count={2} /> : reports.isError ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} compact /> : (reports.data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No reports" body={search ? 'Nothing matches that search.' : 'Nothing filed in this period.'} compact />
              ) : reports.data!.items.map((r, i) => <Reveal key={r.id} index={i}><ReportCard report={r} /></Reveal>)}
            </>
          ) : (
            tasks.isPending ? <SkeletonList count={3} /> : tasks.isError ? <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} compact /> : (tasks.data?.length ?? 0) === 0 ? (
              <EmptyState icon={ListChecks} title="No tasks yet" body="Hand them their first task with the + button." action={{ label: 'Assign a task', onPress: () => router.push({ pathname: '/tasks/assign', params: { employeeId: String(e.id) } }) }} compact />
            ) : tasks.data!.map((task, i) => <Reveal key={task.id} index={i}><TaskCard task={task} compact onPress={() => router.push(`/tasks/${task.id}`)} /></Reveal>)
          )}
        </>
      )}
    </Screen>
  );
}
