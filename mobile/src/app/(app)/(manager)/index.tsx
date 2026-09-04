import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Bug, CheckCircle2, ClipboardCheck, ListChecks, Plus, Users } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useManagerDashboard } from '@/hooks/useDashboard';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { firstName, formatDate, greeting, todayIso } from '@/lib/format';
import { Avatar, BigNumber, ErrorState, IconPillButton, InsightCard, LaunchCard, ProgressCard, Reveal, Screen, SkeletonList, StatRow, Text } from '@/components';
import { CalendarCard } from '@/features/CalendarCard';

/**
 * The manager's home: today's number, one row of counts, the four doors — team,
 * tasks, tickets, reports — a calendar of the whole team's dates, and a dark card
 * when reports are missing. Charts live in Analytics.
 */
export default function ManagerHome() {
  const t = useTheme();
  const router = useRouter();
  const user = useUser();
  const unread = useUnreadCount();
  const dash = useManagerDashboard('today');
  const allTasks = useTasks({ limit: 300, sort: 'deadline_asc' });
  const allTickets = useTickets({ limit: 100, sort: 'created_desc' });
  const s = dash.data?.summary;
  const reportsTotal = (s?.reports_submitted_today ?? 0) + (s?.reports_pending_today ?? 0);
  const missing = s?.reports_pending_today ?? 0;
  const open = s ? s.pending_tasks + s.in_progress_tasks : 0;
  const counts = allTickets.data?.counts;

  const verdict = !s ? ''
    : s.overdue_tasks > 0 ? `${s.overdue_tasks} overdue across the team — worth a look.`
    : s.tasks_assigned_today > 0 ? `${s.tasks_assigned_today} assigned today. The team is on track.`
    : 'Nothing overdue. The team is on track.';

  return (
    <Screen tabBar refreshing={dash.isRefetching} onRefresh={() => { void dash.refetch(); void unread.refetch(); void allTasks.refetch(); void allTickets.refetch(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
          <Avatar name={user?.name ?? ''} src={user?.profile_image} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <IconPillButton icon={Bell} tone="soft" badge={unread.data ?? 0} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" />
        <IconPillButton icon={Plus} tone="ink" onPress={() => router.push('/tasks/assign')} accessibilityLabel="Assign a task" />
      </View>

      {dash.isPending ? <SkeletonList count={3} /> : dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <>
          <Reveal>
            <View style={{ gap: 14 }}>
              <Text variant="small" color="inkMuted">{greeting()}, {firstName(user?.name)} · {formatDate(todayIso())}</Text>
              <BigNumber icon={CheckCircle2} value={s?.tasks_completed_today ?? 0} unit="done today" verdict={verdict} />
            </View>
          </Reveal>

          <Reveal index={1}>
            <StatRow items={[
              { label: 'Assigned', value: s?.tasks_assigned_today ?? 0 },
              { label: 'Pending', value: s?.pending_tasks ?? 0, onPress: () => router.push('/(app)/(manager)/tasks?status=pending') },
              { label: 'Active', value: s?.in_progress_tasks ?? 0, onPress: () => router.push('/(app)/(manager)/tasks?status=in_progress') },
              { label: 'Overdue', value: s?.overdue_tasks ?? 0, color: s?.overdue_tasks ? t.colors.danger : undefined, onPress: () => router.push('/(app)/(manager)/tasks?status=overdue') },
            ]} />
          </Reveal>

          <Reveal index={2}>
            <ProgressCard done={s?.completed_tasks ?? 0} total={(s?.completed_tasks ?? 0) + (s?.pending_tasks ?? 0) + (s?.in_progress_tasks ?? 0)} label="of the team's tasks completed" onPress={() => router.push('/(app)/(manager)/tasks?status=completed')} />
          </Reveal>

          <Reveal index={2}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <LaunchCard compact icon={Users} title="Team" line={s ? `${s.total_team_members} people` : ' '} onPress={() => router.push('/(app)/(manager)/team')} />
              <LaunchCard compact icon={ListChecks} title="Tasks" line={s ? `${open} open${s.overdue_tasks ? ` · ${s.overdue_tasks} overdue` : ''}` : ' '} onPress={() => router.push('/(app)/(manager)/tasks')} />
            </View>
          </Reveal>

          <Reveal index={3}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <LaunchCard compact icon={Bug} title="Tickets" line={counts ? (counts.total ? `${counts.unresolved} open${counts.critical_open ? ` · ${counts.critical_open} critical` : ''}` : 'None raised') : ' '} onPress={() => router.push('/(app)/(manager)/tickets')} />
              <LaunchCard compact icon={ClipboardCheck} title="Reports" line={s ? `${s.reports_submitted_today} of ${reportsTotal} in today` : ' '} tone={missing ? 'accent' : 'muted'} onPress={() => router.push('/reports')} />
            </View>
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
