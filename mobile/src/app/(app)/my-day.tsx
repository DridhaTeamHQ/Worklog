import { useMemo, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Link2, NotebookPen, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useCreateTodo, useDeleteTodo, useTodos, useToggleTodo } from '@/hooks/useTodos';
import { useTasks } from '@/hooks/useTasks';
import { errorMessage } from '@/api/client';
import { addDaysIso, formatDate, taskLabel, todayIso } from '@/lib/format';
import { isManagerLevel } from '@/types';
import { BentoCard, BigNumber, CheckRow, EmptyState, ErrorState, IconPillButton, KeyChip, PickerSheet, Reveal, Screen, ScreenHeader, SkeletonList, Text, TextButton, useSheet, useToast, Chip } from '@/components';
import { Pressable } from 'react-native';

/** Private notes-to-self for a day. Nothing here reaches a manager, a report or a chart. */
export default function MyDay() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const [date, setDate] = useState(todayIso());
  const [draft, setDraft] = useState('');
  const [linkedTask, setLinkedTask] = useState<{ id: number; label: string; key: string | null; projectId: number | null } | null>(null);
  const linkSheet = useSheet();
  const todos = useTodos(date);
  const create = useCreateTodo(date);
  const toggle = useToggleTodo(date);
  const remove = useDeleteTodo(date);
  const tasks = useTasks({ limit: 200, sort: 'created_desc' });
  const isToday = date === todayIso();
  const manager = isManagerLevel(user?.role);

  const options = useMemo(() => (tasks.data?.items ?? []).map((x) => ({ value: x.id, label: taskLabel(x), hint: [x.task_key, manager ? x.employee_name : null].filter(Boolean).join(' · ') })), [tasks.data, manager]);
  const done = (todos.data ?? []).filter((x) => x.is_done).length;

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title, context: linkedTask ? { taskId: linkedTask.id, projectId: linkedTask.projectId ?? undefined } : undefined }, {
      onSuccess: () => setDraft(''),
      onError: (err) => toast.error('Could not add', errorMessage(err)),
    });
  };

  return (
    <Screen refreshing={todos.isRefetching} onRefresh={() => todos.refetch()}>
      <ScreenHeader big={false} title="My Day" subtitle="Private. Only you can see this." right={(
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconPillButton icon={ChevronLeft} size={36} tone="soft" onPress={() => setDate((d) => addDaysIso(d, -1))} accessibilityLabel="Previous day" />
          <IconPillButton icon={ChevronRight} size={36} tone="soft" onPress={() => setDate((d) => addDaysIso(d, 1))} accessibilityLabel="Next day" />
        </View>
      )} />
      <Reveal>
        <BigNumber size="md" icon={NotebookPen} value={todos.data ? done : '–'} unit={todos.data ? `of ${todos.data.length} done` : ''} verdict={isToday ? `Today, ${formatDate(date)}.` : formatDate(date)} />
        {!isToday ? <View style={{ alignItems: 'flex-start', marginTop: 6 }}><TextButton label="Back to today" onPress={() => setDate(todayIso())} /></View> : null}
      </Reveal>

      <Reveal index={1}>
        <BentoCard>
          <Text variant="smallStrong" color="inkMuted" style={{ marginBottom: 8 }}>Add a note</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: t.colors.cardAlt, borderRadius: t.radius.pill, paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Call the vendor back…" placeholderTextColor={t.colors.inkFaint} onSubmitEditing={add} returnKeyType="done" blurOnSubmit={false} maxLength={200} style={{ color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0 }} />
            </View>
            <IconPillButton icon={Plus} size={44} onPress={add} disabled={!draft.trim() || create.isPending} accessibilityLabel="Add note" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Pressable onPress={linkSheet.open} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Link2 size={14} color={t.colors.hero} />
              <Text variant="small" color="hero">{linkedTask ? `Linked to ${linkedTask.key ?? linkedTask.label}` : 'Link to a task (optional)'}</Text>
            </Pressable>
            {linkedTask ? <TextButton label="Unlink" color="inkMuted" onPress={() => setLinkedTask(null)} /> : null}
          </View>
        </BentoCard>
      </Reveal>

      {todos.isPending ? <SkeletonList count={2} lines={1} /> : todos.isError ? <ErrorState error={todos.error} onRetry={() => todos.refetch()} /> : (todos.data?.length ?? 0) === 0 ? (
        <EmptyState icon={NotebookPen} title={isToday ? 'Nothing planned yet' : 'Nothing on this day'} body={isToday ? 'Jot down what you mean to get to. Only you see it.' : 'Notes you wrote for this day would show here.'} compact />
      ) : (
        <Reveal index={2}>
          <BentoCard>
            {todos.data!.map((todo) => (
              <CheckRow
                key={todo.id}
                checked={todo.is_done}
                label={todo.title}
                meta={todo.task_key ? `${todo.task_key}${todo.task_title ? ` · ${todo.task_title}` : ''}` : todo.project_key ? todo.project_key : null}
                onToggle={(next) => toggle.mutate({ id: todo.id, isDone: next })}
                right={(
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {todo.task_id ? <Pressable onPress={() => router.push(`/tasks/${todo.task_id}`)} hitSlop={6}><KeyChip value={todo.task_key} /></Pressable> : null}
                    <Pressable onPress={() => Alert.alert('Remove note?', todo.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(todo.id) }])} hitSlop={8} accessibilityLabel="Remove note">
                      <Trash2 size={16} color={t.colors.inkFaint} />
                    </Pressable>
                  </View>
                )}
              />
            ))}
          </BentoCard>
        </Reveal>
      )}

      <Text variant="small" color="inkFaint" align="center" style={{ paddingHorizontal: t.spacing.lg }}>Nothing on this page is visible to anyone else, and none of it counts towards tasks, reports or analytics.</Text>
      <PickerSheet ref={linkSheet.ref} title="Link to a task" options={options} value={linkedTask?.id} onSelect={(id) => { const x = (tasks.data?.items ?? []).find((y) => y.id === id); if (x) setLinkedTask({ id: x.id, label: taskLabel(x), key: x.task_key, projectId: x.project_id }); }} searchable clearLabel="No task" onClear={() => setLinkedTask(null)} empty="No tasks to link." />
      <View style={{ display: 'none' }}><Chip label="" /></View>
    </Screen>
  );
}
