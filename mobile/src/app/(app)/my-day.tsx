import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Link2, LockKeyhole, NotebookPen, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useCreateTodo, useDeleteTodo, useTodos, useToggleTodo } from '@/hooks/useTodos';
import { useTasks } from '@/hooks/useTasks';
import { errorMessage } from '@/api/client';
import { addDaysIso, formatDate, taskLabel, todayIso } from '@/lib/format';
import type { PersonalTodo, Task } from '@/types';
import { AuroraCard } from '@/components/AuroraCard';
import { BentoCard, CheckRow, EmptyState, ErrorState, IconPillButton, PillButton, ProgressBar, Reveal, Screen, ScreenHeader, SearchField, SegmentedTabs, Sheet, SkeletonList, Text, TextButton, TextField, useSheet, useToast } from '@/components';
import { DotNumber } from '@/components/DotNumber';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

/** Private daily intentions; progress here never changes project metrics. */
export default function MyDay() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'remaining' | 'done'>('all');
  const [linkedTask, setLinkedTask] = useState<Task | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [removing, setRemoving] = useState<PersonalTodo | null>(null);
  const linkSheet = useSheet();
  const removeSheet = useSheet();
  const todos = useTodos(date);
  const create = useCreateTodo(date);
  const toggle = useToggleTodo(date);
  const remove = useDeleteTodo(date);
  const tasks = useTasks({ search: taskSearch || undefined, limit: 20, sort: 'created_desc' }, { enabled: linkOpen });
  const busy = create.isPending || toggle.isPending || remove.isPending;
  const ready = !!todos.data && !todos.isPlaceholderData && !todos.isError;
  const notes = ready ? todos.data! : [];
  const done = notes.filter((x) => x.is_done).length;
  const shown = useAnimatedNumber(done);
  const visible = notes.filter((x) => filter === 'all' || (filter === 'done' ? x.is_done : !x.is_done));
  const isToday = date === todayIso();
  const complete = notes.length > 0 && done === notes.length;
  const changeDate = (next: string) => { if (busy) return; setDate(next); setFilter('all'); };

  const add = () => {
    const title = draft.trim();
    if (!title || busy) return;
    create.mutate({ title, context: linkedTask ? { taskId: linkedTask.id, projectId: linkedTask.project_id ?? undefined } : undefined }, {
      onSuccess: () => { setDraft(''); setLinkedTask(null); setFilter('all'); toast.success('Note added', formatDate(date)); },
      onError: (err) => toast.error('Could not add', errorMessage(err)),
    });
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen refreshing={todos.isRefetching} onRefresh={() => todos.refetch()} keyboardDismissMode="on-drag">
      <ScreenHeader big={false} title="My Day" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconPillButton icon={ChevronLeft} tone="soft" disabled={busy} onPress={() => changeDate(addDaysIso(date, -1))} accessibilityLabel="Previous day" />
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}><Text variant="smallStrong">{formatDate(date)}</Text><Text variant="caption" color="inkMuted">{isToday ? 'TODAY' : 'YOUR DAILY SPACE'}</Text></View>
        <IconPillButton icon={ChevronRight} tone="soft" disabled={busy} onPress={() => changeDate(addDaysIso(date, 1))} accessibilityLabel="Next day" />
      </View>
      {!isToday ? <TextButton label="Back to today" onPress={() => changeDate(todayIso())} /> : null}
      <Reveal><AuroraCard tone={complete ? 'sage' : 'rose'} style={{ minHeight: 192 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><LockKeyhole size={15} color="#E0E9D8" /><Text variant="caption" color="#E0E9D8" style={{ letterSpacing: 1.8 }}>ONLY FOR YOU</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginVertical: 24 }}>
          {ready ? <DotNumber value={shown} height={42} color="#FFFFFF" /> : <Text variant="stat" color="#FFFFFF">–</Text>}
          <View style={{ flex: 1, gap: 5 }}><Text variant="h3" color="#FFFFFF">{complete ? 'A day well spent.' : 'Small steps count.'}</Text><Text variant="small" color="#E0E9D8">{ready ? notes.length ? `${done} of ${notes.length} intentions complete` : 'Start with one thing on your mind.' : todos.isError ? 'Your intentions could not load.' : 'Loading your intentions…'}</Text></View>
          {complete ? <Check size={24} color="#E5EDCE" /> : null}
        </View>
        <ProgressBar value={notes.length ? done / notes.length : 0} color="#E5EDCE" track="rgba(255,255,255,0.18)" />
      </AuroraCard></Reveal>
      <Reveal index={1}><BentoCard>
        <View style={{ gap: 14 }}>
          <TextField label="Your next small step" value={draft} onChangeText={setDraft} placeholder="What would make today feel good?" maxLength={200} editable={!create.isPending} onSubmitEditing={add} returnKeyType="done" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}><TextButton label={linkedTask ? linkedTask.task_key ?? 'Task linked' : 'Link a task'} icon={Link2} onPress={() => { if (busy) return; setTaskSearch(''); setLinkOpen(true); linkSheet.open(); }} /></View>
            <PillButton label="Add note" icon={Plus} size="sm" onPress={add} disabled={!draft.trim() || busy} loading={create.isPending} />
          </View>
          {linkedTask ? <Text variant="caption" color="inkMuted" numberOfLines={2}>{taskLabel(linkedTask)}</Text> : null}
        </View>
      </BentoCard></Reveal>
      <SegmentedTabs items={[{ key: 'all', label: 'All' }, { key: 'remaining', label: 'Remaining' }, { key: 'done', label: 'Done' }]} value={filter} onChange={setFilter} />
      {todos.isPending || todos.isPlaceholderData ? <SkeletonList count={2} lines={1} /> : todos.isError ? <ErrorState error={todos.error} onRetry={() => todos.refetch()} /> : visible.length === 0 ? <EmptyState icon={filter === 'remaining' && complete ? Check : NotebookPen} title={filter === 'done' ? 'Your wins go here' : filter === 'remaining' && complete ? 'Everything, taken care of.' : notes.length ? 'Nothing here yet' : 'A fresh page'} body={filter === 'done' ? 'Check off an intention to see it here.' : filter === 'remaining' && complete ? 'Take a breath. You finished what you planned.' : 'Add an intention above. It can be as small as making that call.'} compact /> : <View style={{ gap: 10 }}>
        {visible.map((todo, i) => <Reveal key={todo.id} index={Math.min(i, 3)}><BentoCard padding={16}>
          <CheckRow checked={todo.is_done} label={todo.title} disabled={busy} onToggle={(isDone) => toggle.mutate({ id: todo.id, isDone }, { onError: (err) => toast.error('Could not update note', errorMessage(err)) })} right={<IconPillButton icon={Trash2} size={36} tone="plain" disabled={busy} accessibilityLabel={`Remove note: ${todo.title}`} onPress={() => { setRemoving(todo); removeSheet.open(); }} />} />
          {todo.task_id ? <Pressable accessibilityRole="button" accessibilityLabel={`Open linked task ${todo.task_key ?? todo.task_title ?? ''}`} onPress={() => router.push(`/tasks/${todo.task_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderTopColor: t.colors.hairline }}><Link2 size={13} color={t.colors.hero} /><Text variant="caption" color="hero" numberOfLines={1} style={{ flex: 1 }}>{todo.task_key} · {todo.task_title}</Text></Pressable> : null}
        </BentoCard></Reveal>)}
      </View>}
      <Text variant="caption" color="inkFaint" align="center">Private notes. Separate from team tasks and reports.</Text>
      <Sheet ref={removeSheet.ref} title="Let this one go?" onDismiss={() => setRemoving(null)}>
        <View style={{ gap: 18 }}><Text variant="body">{removing?.title}</Text><Text variant="small" color="inkMuted">This removes the note from your day. Linked team tasks stay as they are.</Text><PillButton label="Remove note" variant="danger" block loading={remove.isPending} disabled={!removing} onPress={() => { if (removing) remove.mutate(removing.id, { onSuccess: () => { removeSheet.close(); toast.success('Note removed'); }, onError: (err) => toast.error('Could not remove note', errorMessage(err)) }); }} /><PillButton label="Keep it" variant="soft" block disabled={remove.isPending} onPress={removeSheet.close} /></View>
      </Sheet>
      <Sheet ref={linkSheet.ref} title="Keep the context." size="tall" scroll onDismiss={() => setLinkOpen(false)}>
        <View style={{ gap: 14 }}>
          <SearchField value={taskSearch} onChange={setTaskSearch} placeholder="Search tasks to link" loading={tasks.isFetching} />
          <TextButton label="No linked task" onPress={() => { setLinkedTask(null); linkSheet.close(); }} />
          {tasks.isPending || tasks.isPlaceholderData ? <SkeletonList count={2} /> : tasks.isError ? <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} /> : tasks.data.items.length ? tasks.data.items.map((task) => <BentoCard key={task.id} padding={14} onPress={() => { setLinkedTask(task); linkSheet.close(); }} accessibilityLabel={`Link ${task.task_key ?? 'task'}: ${taskLabel(task)}`}><Text variant="caption" color="inkMuted">{task.task_key}</Text><Text variant="bodyStrong" style={{ marginTop: 6 }}>{taskLabel(task)}</Text></BentoCard>) : <Text variant="small" color="inkMuted">No matching tasks.</Text>}
          {tasks.data && tasks.data.total > tasks.data.items.length ? <Text variant="caption" color="inkMuted">Showing {tasks.data.items.length} of {tasks.data.total}. Search by title or key to find another task.</Text> : null}
        </View>
      </Sheet>
    </Screen>
  </KeyboardAvoidingView>;
}
