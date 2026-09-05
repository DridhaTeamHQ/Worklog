import { FocusDeck } from '@/features/FocusDeck';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bug, ClipboardCheck, ListChecks } from 'lucide-react-native';
import { useUser } from '@/auth/store';
import { useEmployeeDashboard } from '@/hooks/useDashboard';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { formatTime } from '@/lib/format';
import { ErrorState, InsightCard, Reveal, Screen, SkeletonList } from '@/components';
import { CompletionCard, DashboardHeader, MetricCard } from '@/features/Dashboard';
import { SectionTitle } from '@/components';
import { CalendarCard } from '@/features/CalendarCard';

/** Personal progress, daily reporting, and the next tasks that need attention. */
export default function MemberHome() {
  const router = useRouter();
  const user = useUser();
  const dash = useEmployeeDashboard();
  const unread = useUnreadCount();
  const allTasks = useTasks({ limit: 200, sort: 'deadline_asc' });
  const myTickets = useTickets({ limit: 100, sort: 'created_desc' });

  const s = dash.data?.summary;
  const upcoming = dash.data?.upcoming_tasks ?? [];
  const firstOverdue = upcoming.find((x) => x.effective_status === 'overdue');
  const openCount = s ? s.pending_tasks + s.in_progress_tasks : 0;
  const verdict = !s ? ''
    : s.overdue_tasks > 0 ? `${s.overdue_tasks} overdue — those first.`
    : openCount === 0 ? 'Nothing open. Enjoy the quiet.'
    : s.completed_today > 0 ? `${s.completed_today} done today. Keep it up.`
    : 'Pick one and start.';

  const counts = myTickets.data?.counts;


  return (
    <Screen tabBar refreshing={dash.isRefetching} onRefresh={() => { void dash.refetch(); void unread.refetch(); void allTasks.refetch(); void myTickets.refetch(); }}>
      <DashboardHeader name={user?.name ?? ''} image={user?.profile_image} unread={unread.data ?? 0} />

      {dash.isPending ? <SkeletonList count={3} /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <>
          <Reveal><FocusDeck tasks={allTasks.data?.items ?? upcoming}  /></Reveal>
          <SectionTitle title="At a glance" />
          <Reveal>
            <CompletionCard done={s?.completed_tasks ?? 0} total={s?.total_tasks ?? 0} detail={verdict} onPress={() => router.push('/(app)/(member)/tasks?status=completed')} />
          </Reveal>
          <Reveal index={1}>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <MetricCard title="In progress" value={s?.in_progress_tasks ?? 0} detail="One step at a time" icon={ListChecks} tone="sage" onPress={() => router.push('/(app)/(member)/tasks?status=in_progress')} />
                <MetricCard title="Pending" value={s?.pending_tasks ?? 0} detail={`${s?.overdue_tasks ?? 0} overdue`} icon={ClipboardCheck} tone="iris" onPress={() => router.push('/(app)/(member)/tasks?status=pending')} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <MetricCard title="Daily report" value={s?.submitted_today ? 'Sent' : 'To do'} detail={s?.submitted_today && s.today_report_updated_at ? `Updated ${formatTime(s.today_report_updated_at)}` : 'A moment to reflect'} icon={ClipboardCheck} tone="rose" onPress={() => router.push('/(app)/(member)/report')} />
                <MetricCard title="My tickets" value={counts?.unresolved ?? '—'} detail={myTickets.isError ? 'Tap to try again' : 'Open conversations'} icon={Bug} tone="clay" onPress={() => router.push('/(app)/(member)/tickets')} />
              </View>
            </View>
          </Reveal>


          <Reveal index={3}>
            <CalendarCard
              tasks={allTasks.data?.items ?? upcoming}
              tickets={myTickets.data?.items ?? []}
              onPressTask={(task) => router.push(`/tasks/${task.id}`)}
              onPressTicket={(ticket) => router.push(`/tickets/${ticket.id}`)}
            />
          </Reveal>

          {s && !s.submitted_today ? (
            <Reveal index={4}>
              <InsightCard eyebrow="Needs you" title="Write today's report" detail="Takes a minute; your manager sees it straight away" icon={ClipboardCheck} onPress={() => router.push('/(app)/(member)/report')} />
            </Reveal>
          ) : firstOverdue ? (
            <Reveal index={4}>
              <InsightCard eyebrow="Needs you" title={`${firstOverdue.task_key ?? 'A task'} is overdue`} detail={firstOverdue.title} icon={ListChecks} onPress={() => router.push(`/tasks/${firstOverdue.id}`)} />
            </Reveal>
          ) : null}
        </>
      )}
    </Screen>
  );
}
