import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bug, Circle, CircleCheck, CircleDot, MoreHorizontal, Pencil, Tags, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useDeleteTask, useSetTaskLabels, useTask, useUpdateTaskStatus } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { useLabels } from '@/hooks/useLabels';
import { errorMessage } from '@/api/client';
import { deadlineLabel, formatDateShort, taskLabel } from '@/lib/format';
import { isManagerLevel, type TaskStatus } from '@/types';
import {
  BentoCard, CheckRow, ErrorState, IconPillButton, KeyChip, LabelRow, ListGroup, PickerSheet, PillButton,
  PriorityChip, ProgressBar, Reveal, Screen, ScreenHeader, SectionTitle, SegmentedTabs, Sheet, LoadingState, SkeletonList, StatusChip, Text,
  TitleBlock, ValueRow, useSheet, useToast,
} from '@/components';
import { ActivityThread } from '@/features/ActivityThread';
import { Checklist } from '@/features/Checklist';
import { TicketCard } from '@/features/TicketCard';

const STATUS_ITEMS = [
  { key: 'pending', label: 'Pending', icon: Circle },
  { key: 'in_progress', label: 'In progress', icon: CircleDot },
  { key: 'completed', label: 'Done', icon: CircleCheck },
] satisfies { key: TaskStatus; label: string; icon: typeof Circle }[];

/**
 * A task, in full. Title block on the ground, status control, then the facts as
 * rows, the checklist, the people and the thread — cards only where rows group.
 */
export default function TaskDetail() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const task = useTask(id);
  const tickets = useTickets({ taskId: id ?? undefined, limit: 20 }, { enabled: !!id });
  const labels = useLabels();
  const move = useUpdateTaskStatus();
  const remove = useDeleteTask();
  const setLabels = useSetTaskLabels();
  const menu = useSheet();
  const labelSheet = useSheet();

  const manager = isManagerLevel(user?.role);
  const data = task.data;
  const owns = data ? (user?.role === 'admin' || data.manager_id === user?.id) : false;
  const canEditChecklist = data ? (data.employee_id === user?.id || owns) : false;
  const due = data ? deadlineLabel(data.deadline, data.effective_status) : null;
  const dueColor = due?.tone === 'danger' ? t.colors.danger : due?.tone === 'warn' ? t.colors.warning : undefined;

  const elapsed = useMemo(() => {
    if (!data?.start_date || !data.deadline || data.status !== 'in_progress') return null;
    const s = Date.parse(`${data.start_date}T00:00:00`);
    const e = Date.parse(`${data.deadline}T23:59:59`);
    return e > s ? Math.max(0, Math.min(1, (Date.now() - s) / (e - s))) : null;
  }, [data]);

  const changeStatus = (status: TaskStatus) => {
    if (!data || data.status === status) return;
    move.mutate({ id: data.id, status }, {
      onError: (err) => toast.error('Could not update', errorMessage(err)),
      onSuccess: () => toast.success(status === 'completed' ? 'Marked done' : `Marked ${STATUS_ITEMS.find((s) => s.key === status)?.label.toLowerCase()}`),
    });
  };

  const confirmDelete = () => {
    if (!data) return;
    menu.close();
    Alert.alert('Delete this task?', `${data.task_key ?? 'The task'} will be removed. Tickets raised against it are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(data.id, { onSuccess: () => { toast.success('Task deleted'); router.back(); }, onError: (err) => toast.error('Could not delete', errorMessage(err)) }) },
    ]);
  };

  if (task.isError) return <Screen><ScreenHeader title="Task" /><ErrorState error={task.error} onRetry={() => task.refetch()} /></Screen>;

  return (
    <Screen refreshing={task.isRefetching} onRefresh={() => { void task.refetch(); void tickets.refetch(); }}>
      <ScreenHeader big={false} right={manager && data ? <IconPillButton icon={MoreHorizontal} tone="plain" onPress={menu.open} accessibilityLabel="More actions" /> : undefined} />

      {task.isPending || !data ? <LoadingState /> : (
        <>
          <Reveal>
            <TitleBlock
              eyebrow={<><KeyChip value={data.task_key} /><Text variant="caption" color="inkFaint">·</Text><Text variant="caption" color="inkMuted">{data.project_name}</Text></>}
              title={taskLabel(data)}
              meta={(
                <>
                  <StatusChip status={data.effective_status} />
                  <PriorityChip priority={data.priority} />
                  {due ? <Text variant="small" color={dueColor ?? 'inkMuted'}>{due.text}</Text> : null}
                </>
              )}
            />
          </Reveal>

          <Reveal index={1}>
            <SegmentedTabs items={STATUS_ITEMS} value={data.status} onChange={changeStatus} />
          </Reveal>

          {data.description ? (
            <Reveal index={2}>
              <Text variant="body" style={{ paddingHorizontal: 4 }}>{data.description}</Text>
            </Reveal>
          ) : null}

          <Reveal index={3}>
            <ListGroup>
              <ValueRow label="Starts" value={data.start_date ? formatDateShort(data.start_date) : '—'} />
              <ValueRow label="Deadline" value={data.deadline ? formatDateShort(data.deadline) : '—'} color={dueColor} divider />
              <ValueRow label={data.completed_at ? 'Completed' : 'Assigned'} value={formatDateShort(data.completed_at ?? data.created_at)} divider />
              <ValueRow label="Assigned to" value={data.employee_name} divider onPress={manager ? () => router.push(`/team/${data.employee_id}`) : undefined} />
              <ValueRow label="Assigned by" value={data.manager_name} divider />
              {data.notes ? (
                <View style={{ paddingHorizontal: t.spacing.xl, paddingVertical: 13, borderTopWidth: 1, borderTopColor: t.colors.hairline, gap: 4 }}>
                  <Text variant="caption" color="inkMuted">Notes</Text>
                  <Text variant="body">{data.notes}</Text>
                </View>
              ) : null}
              {elapsed !== null ? (
                <View style={{ paddingHorizontal: t.spacing.xl, paddingVertical: 14, borderTopWidth: 1, borderTopColor: t.colors.hairline, gap: 8 }}>
                  <ProgressBar value={elapsed} color={t.colors.hero} height={4} />
                  <Text variant="caption" color="inkFaint">{Math.round(elapsed * 100)}% of the time window used</Text>
                </View>
              ) : null}
            </ListGroup>
          </Reveal>

          <SectionTitle title="Checklist" right={owns ? <IconPillButton icon={Tags} size={32} tone="plain" onPress={labelSheet.open} accessibilityLabel="Edit labels" /> : undefined} />
          <Reveal index={4}>
            <BentoCard>
              {data.labels.length ? <View style={{ marginBottom: 14 }}><LabelRow labels={data.labels} max={10} /></View> : null}
              <Checklist taskId={data.id} editable={canEditChecklist} />
            </BentoCard>
          </Reveal>

          {!manager && data.employee_id === user?.id ? (
            <Reveal index={6}>
              <PillButton label="Raise a ticket on this task" icon={Bug} variant="soft" block onPress={() => router.push({ pathname: '/tickets/new', params: { taskId: String(data.id), projectId: String(data.project_id ?? '') } })} />
            </Reveal>
          ) : null}

          <SectionTitle title="Activity" />
          <Reveal index={7}><ActivityThread entity="task" id={data.id} /></Reveal>

          {(tickets.data?.items.length ?? 0) > 0 ? (
            <>
              <SectionTitle title="Tickets on this task" />
              {tickets.data!.items.map((ticket, i) => <Reveal key={ticket.id} index={8 + i}><TicketCard ticket={ticket} showReporter={manager} onPress={() => router.push(`/tickets/${ticket.id}`)} /></Reveal>)}
            </>
          ) : null}
        </>
      )}

      <Sheet ref={menu.ref} title={data?.task_key ?? 'Task'}>
        <View style={{ gap: 6 }}>
          <CheckRow checked={false} label="Edit details" meta="Title, description, priority, dates" strike={false} onPressLabel={() => { menu.close(); router.push(`/tasks/${id}/edit`); }} right={<Pencil size={18} color={t.colors.inkMuted} />} />
          <CheckRow checked={false} label="Delete task" meta="Tickets raised against it are kept" strike={false} onPressLabel={confirmDelete} right={<Trash2 size={18} color={t.colors.danger} />} />
        </View>
      </Sheet>
      <PickerSheet
        ref={labelSheet.ref}
        title="Labels"
        options={(labels.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color, hint: data?.labels.some((x) => x.id === l.id) ? 'On this task' : undefined }))}
        onSelect={(labelId) => {
          if (!data) return;
          const current = data.labels.map((l) => l.id);
          const next = current.includes(labelId) ? current.filter((x) => x !== labelId) : [...current, labelId];
          setLabels.mutate({ id: data.id, labelIds: next }, { onError: (err) => toast.error('Could not update labels', errorMessage(err)) });
        }}
        empty="No labels yet — create some from More › Labels."
      />
    </Screen>
  );
}
