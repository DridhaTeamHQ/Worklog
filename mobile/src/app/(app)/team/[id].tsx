import { IdentityCard } from '@/components';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ListChecks, Plus, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTeamMember, useTeamMemberReports, useTeamMemberTasks } from '@/hooks/useTeam';
import { useUser } from '@/auth/store';
import { isAdmin } from '@/types';
import { RoleSheet } from '@/features/RoleSheet';
import {
  Avatar, BigNumber, Chip, EmptyState, ErrorState, PillButton, Reveal, Screen, ScreenHeader, SearchField, SegmentedTabs,
  LoadingState, SectionTitle, SkeletonList, StatRow, Text, useSheet,
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
  const viewer = useUser();
  const admin = isAdmin(viewer?.role);
  const roleSheet = useSheet();
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

          <SectionTitle title="Performance" />
          <Reveal index={2}>
            <StatRow items={[
              { label: 'Done', value: c?.completed ?? 0, color: t.colors.success },
              { label: 'Active', value: c?.in_progress ?? 0 },
              { label: 'Pending', value: c?.pending ?? 0 },
              { label: 'Overdue', value: c?.overdue ?? 0, color: c?.overdue ? t.colors.danger : undefined },
            ]} />
          </Reveal>
          <Reveal index={3}>
            <Text variant="small" color="inkMuted" style={{ paddingHorizontal: 4 }}>
              {c?.total ? `${Math.round((c.completed / c.total) * 100)}% completion rate` : 'No tasks assigned yet'}
              {` · ${e.report_count} ${e.report_count === 1 ? 'report' : 'reports'} filed`}
            </Text>
          </Reveal>

          <Reveal index={4}>
            <View style={{ gap: 10 }}>
              <PillButton label="Assign a task" icon={Plus} variant="hero" size="lg" block onPress={() => router.push({ pathname: '/tasks/assign', params: { employeeId: String(e.id) } })} />
              {admin ? <PillButton label="Change access" icon={ShieldCheck} variant="soft" size="lg" block onPress={roleSheet.open} /> : null}
            </View>
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
      <RoleSheet
        ref={roleSheet.ref}
        person={e ? { id: e.id, name: e.name, role: e.role, department: e.department, job_title: e.job_title } : null}
        // Any change from here moves them off the member roster, and this page only
        // serves members — so leave rather than refetch into a 404.
        onDone={() => { roleSheet.close(); if (router.canGoBack()) router.back(); else router.replace('/(app)/(manager)/team'); }}
      />
    </Screen>
  );
}
