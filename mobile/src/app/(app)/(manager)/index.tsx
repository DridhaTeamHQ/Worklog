import { FocusDeck } from '@/features/FocusDeck';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bug, ClipboardCheck, ListChecks, Users } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useManagerDashboard } from '@/hooks/useDashboard';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { ErrorState, InsightCard, Reveal, Screen, SkeletonList, StatRow } from '@/components';
import { CompletionCard, DashboardHeader, MetricCard } from '@/features/Dashboard';
import { SectionTitle } from '@/components';
import { CalendarCard } from '@/features/CalendarCard';

/** Live team progress, work shortcuts, and the shared calendar. */
export default function ManagerHome() {
  const t = useTheme();
  const router = useRouter();
  const user = useUser();
  const unread = useUnreadCount();
  const dash = useManagerDashboard('today');
  const allTasks = useTasks({ limit: 200, sort: 'deadline_asc' });
  const allTickets = useTickets({ limit: 100, sort: 'created_desc' });
  const s = dash.data?.summary;
  const reportsTotal = (s?.reports_submitted_today ?? 0) + (s?.reports_pending_today ?? 0);
  const missing = s?.reports_pending_today ?? 0;
  const counts = allTickets.data?.counts;

  const verdict = !s ? ''
    : s.overdue_tasks > 0 ? `${s.overdue_tasks} overdue across the team — worth a look.`
    : s.tasks_assigned_today > 0 ? `${s.tasks_assigned_today} assigned today. The team is on track.`
    : 'Nothing overdue. The team is on track.';

  return (
    <Screen tabBar refreshing={dash.isRefetching} onRefresh={() => { void dash.refetch(); void unread.refetch(); void allTasks.refetch(); void allTickets.refetch(); }}>
      <DashboardHeader name={user?.name ?? ''} image={user?.profile_image} unread={unread.data ?? 0} manager />

      {dash.isPending ? <SkeletonList count={3} /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <>
          <Reveal><FocusDeck tasks={allTasks.data?.items ?? dash.data?.recent_tasks ?? []} manager /></Reveal>
          <SectionTitle title="At a glance" />
          <Reveal>
            <CompletionCard done={s?.completed_tasks ?? 0} total={(s?.completed_tasks ?? 0) + (s?.pending_tasks ?? 0) + (s?.in_progress_tasks ?? 0)} detail={verdict} onPress={() => router.push('/(app)/(manager)/tasks?status=completed')} />
          </Reveal>
          <Reveal index={1}>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <MetricCard title="In progress" value={s?.in_progress_tasks ?? 0} detail={`${s?.pending_tasks ?? 0} ${s?.pending_tasks === 1 ? 'task' : 'tasks'} pending`} icon={ListChecks} tone="sage" onPress={() => router.push('/(app)/(manager)/tasks?status=in_progress')} />
                <MetricCard title="Your team" value={s?.total_team_members ?? 0} detail={`${s?.tasks_completed_today ?? 0} tasks done today`} icon={Users} tone="iris" onPress={() => router.push('/(app)/(manager)/team')} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <MetricCard title="Daily reports" value={s?.reports_submitted_today ?? 0} unit={`/ ${reportsTotal}`} detail={missing ? `${missing} still to come` : 'All caught up'} icon={ClipboardCheck} tone="rose" onPress={() => router.push('/reports')} />
                <MetricCard title="Open tickets" value={counts?.unresolved ?? '—'} detail={allTickets.isError ? 'Tap to try again' : `${counts?.critical_open ?? 0} critical priority`} icon={Bug} tone="clay" onPress={() => router.push('/(app)/(manager)/tickets')} />
              </View>
            </View>
          </Reveal>
          <Reveal index={2}>
            <StatRow items={[
              { label: 'Assigned today', value: s?.tasks_assigned_today ?? 0 },
              { label: 'Pending', value: s?.pending_tasks ?? 0, onPress: () => router.push('/(app)/(manager)/tasks?status=pending') },
              { label: 'Overdue', value: s?.overdue_tasks ?? 0, color: s?.overdue_tasks ? t.colors.danger : undefined, onPress: () => router.push('/(app)/(manager)/tasks?status=overdue') },
            ]} />
          </Reveal>


          <Reveal index={4}>
            <CalendarCard
              tasks={allTasks.data?.items ?? dash.data?.recent_tasks ?? []}
              tickets={allTickets.data?.items ?? []}
              showAssignee
              onPressTask={(task) => router.push(`/tasks/${task.id}`)}
              onPressTicket={(ticket) => router.push(`/tickets/${ticket.id}`)}
            />
          </Reveal>

          {missing > 0 ? (
            <Reveal index={5}>
              <InsightCard eyebrow="Daily reports" title={`${missing} ${missing === 1 ? 'report' : 'reports'} still missing`} detail={`${s?.reports_submitted_today ?? 0} of ${reportsTotal} in so far today`} icon={ClipboardCheck} onPress={() => router.push('/reports')} />
            </Reveal>
          ) : null}
        </>
      )}
    </Screen>
  );
}
