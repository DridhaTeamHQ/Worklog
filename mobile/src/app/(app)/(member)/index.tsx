import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Bug, ClipboardCheck, ListChecks } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useEmployeeDashboard } from '@/hooks/useDashboard';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { firstName, formatDate, formatTime, greeting, todayIso } from '@/lib/format';
import { Avatar, BigNumber, ErrorState, IconPillButton, InsightCard, LaunchCard, ProgressCard, Reveal, Screen, SkeletonList, Text } from '@/components';
import { CalendarCard } from '@/features/CalendarCard';

/**
 * The member's home: one number, then the three doors — today's report, my tasks,
 * my tickets — a calendar of what starts, is due, got done or was raised, and one
 * dark card when something needs them.
 */
export default function MemberHome() {
  const t = useTheme();
  const router = useRouter();
  const user = useUser();
  const dash = useEmployeeDashboard();
  const unread = useUnreadCount();
  const allTasks = useTasks({ limit: 300, sort: 'deadline_asc' });
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

  const tasksLine = s
    ? [s.pending_tasks ? `${s.pending_tasks} pending` : null, s.in_progress_tasks ? `${s.in_progress_tasks} active` : null, s.overdue_tasks ? `${s.overdue_tasks} overdue` : null].filter(Boolean).join(' · ') || 'Nothing assigned yet'
    : ' ';
  const counts = myTickets.data?.counts;
  const ticketsLine = counts ? (counts.total ? `${counts.unresolved} open · ${counts.total} raised` : 'None raised') : ' ';

  return (
    <Screen tabBar refreshing={dash.isRefetching} onRefresh={() => { void dash.refetch(); void unread.refetch(); void allTasks.refetch(); void myTickets.refetch(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
          <Avatar name={user?.name ?? ''} src={user?.profile_image} />
        </Pressable>
        <IconPillButton icon={Bell} tone="soft" badge={unread.data ?? 0} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" />
      </View>

      {dash.isPending ? <SkeletonList count={3} /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <>
          <Reveal>
            <View style={{ gap: 14 }}>
              <Text variant="small" color="inkMuted">{greeting()}, {firstName(user?.name)} · {formatDate(todayIso())}</Text>
              <BigNumber icon={ListChecks} value={openCount} unit={openCount === 1 ? 'task open' : 'tasks open'} verdict={verdict} />
            </View>
          </Reveal>

          {s && s.total_tasks > 0 ? (
            <Reveal index={1}>
              <ProgressCard done={s.completed_tasks} total={s.total_tasks} onPress={() => router.push('/(app)/(member)/tasks?status=completed')} />
            </Reveal>
          ) : null}

          <Reveal index={1}>
            <LaunchCard
              icon={ClipboardCheck}
              title="Today's report"
              line={s?.submitted_today ? `Submitted${s.today_report_updated_at ? ` at ${formatTime(s.today_report_updated_at)}` : ''}` : 'Not written yet'}
              tone={s?.submitted_today ? 'muted' : 'accent'}
              onPress={() => router.push('/(app)/(member)/report')}
            />
          </Reveal>

          <Reveal index={2}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <LaunchCard compact icon={ListChecks} title="My tasks" line={tasksLine} onPress={() => router.push('/(app)/(member)/tasks')} />
              <LaunchCard compact icon={Bug} title="My tickets" line={ticketsLine} onPress={() => router.push('/(app)/(member)/tickets')} />
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
