import { View } from 'react-native';
import { CheckSquare, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { deadlineLabel, taskLabel } from '@/lib/format';
import type { Task } from '@/types';
import { Avatar, BentoCard, KeyChip, LabelRow, PriorityChip, ProgressBar, StatusChip, Text } from '@/components';

interface Props {
  task: Task;
  onPress?: () => void;
  onLongPress?: () => void;
  showAssignee?: boolean;
  compact?: boolean;
}

/**
 * How far through its calendar span a task is — the elapsed-time bar from the web
 * board. Explicitly not "% of work done", which nobody can know.
 */
function elapsedFraction(task: Task): number | null {
  if (task.status !== 'in_progress' || !task.start_date || !task.deadline) return null;
  const start = Date.parse(`${task.start_date}T00:00:00`);
  const end = Date.parse(`${task.deadline}T23:59:59`);
  if (!(end > start)) return null;
  return Math.max(0, Math.min(1, (Date.now() - start) / (end - start)));
}

/**
 * A task as a card: the key and the deadline on one line, the title, then a single
 * quiet row of context. Priority appears only when it is high or urgent, labels are
 * capped at two, and the elapsed bar only shows for work that is in progress.
 */
export function TaskCard({ task, onPress, onLongPress, showAssignee, compact }: Props) {
  const t = useTheme();
  const due = deadlineLabel(task.deadline, task.effective_status);
  const dueColor = due.tone === 'danger' ? t.colors.danger : due.tone === 'warn' ? t.colors.warning : t.colors.inkMuted;
  const elapsed = elapsedFraction(task);
  const done = task.effective_status === 'completed';
  const hasMeta = task.effective_status !== 'pending' || task.priority === 'high' || task.priority === 'urgent'
    || (task.labels?.length ?? 0) > 0 || task.checklist_total > 0 || task.comment_count > 0 || showAssignee;

  return (
    <BentoCard onPress={onPress} onLongPress={onLongPress} padding={t.spacing.xl}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KeyChip value={task.task_key} />
          <View style={{ flex: 1 }} />
          <Text variant="caption" color={dueColor} style={{ fontFamily: due.tone === 'normal' ? t.fonts.medium : t.fonts.semibold }}>{due.text}</Text>
        </View>
        <Text variant={compact ? 'bodyStrong' : 'h3'} color={done ? 'inkMuted' : 'ink'} numberOfLines={2} style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {taskLabel(task)}
        </Text>
        {!compact && task.description ? <Text variant="small" color="inkMuted" numberOfLines={2}>{task.description}</Text> : null}
        {hasMeta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {task.effective_status !== 'pending' ? <StatusChip status={task.effective_status} size="sm" /> : null}
            <PriorityChip priority={task.priority} size="sm" />
            <LabelRow labels={task.labels} max={compact ? 1 : 2} />
            <View style={{ flex: 1 }} />
            {showAssignee ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Avatar name={task.employee_name} src={task.employee_profile_image} size="sm" />
                <Text variant="small" color="inkMuted" numberOfLines={1} style={{ maxWidth: 120 }}>{task.employee_name.split(' ')[0]}</Text>
              </View>
            ) : null}
            {task.checklist_total ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckSquare size={13} color={t.colors.inkFaint} />
                <Text variant="small" color="inkMuted">{task.checklist_done}/{task.checklist_total}</Text>
              </View>
            ) : null}
            {task.comment_count ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MessageCircle size={13} color={t.colors.inkFaint} />
                <Text variant="small" color="inkMuted">{task.comment_count}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {elapsed !== null ? <ProgressBar value={elapsed} color={t.colors.hero} height={3} /> : null}
      </View>
    </BentoCard>
  );
}
