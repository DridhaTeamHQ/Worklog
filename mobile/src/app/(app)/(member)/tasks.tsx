import { TaskBoard, TaskViewSwitch, type TaskView } from '@/features/TaskBoard';
import { PageIntro } from '@/components/ScreenHeader';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, CircleAlert, CircleCheck, CircleDot, List, ArrowDownUp, ListChecks } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTasks, useUpdateTaskStatus } from '@/hooks/useTasks';
import { errorMessage } from '@/api/client';
import type { Task, TaskStatus } from '@/types';
import {
  Chip, EmptyState, ErrorState, IconPillButton, PickerSheet, Reveal, SearchField, SegmentedTabs, SkeletonList, Text,
  useSheet, useTabBarInset, useToast,
} from '@/components';
import { useAutoHideTabBar } from '@/lib/tabBar';
import { TaskCard } from '@/features/TaskCard';

type StatusTab = 'all' | 'pending' | 'in_progress' | 'overdue' | 'completed';
// Symbols, so five options fit any phone; only the chosen one spells its name.
const STATUS_TABS: { key: StatusTab; label: string; icon: typeof Circle }[] = [
  { key: 'all', label: 'All', icon: List }, { key: 'pending', label: 'Pending', icon: Circle }, { key: 'in_progress', label: 'Active', icon: CircleDot },
  { key: 'overdue', label: 'Overdue', icon: CircleAlert }, { key: 'completed', label: 'Done', icon: CircleCheck },
];
const SORTS = [
  { value: 'deadline_asc', label: 'Deadline soonest' }, { value: 'deadline_desc', label: 'Deadline latest' },
  { value: 'priority_desc', label: 'Priority highest' }, { value: 'created_desc', label: 'Newest' }, { value: 'created_asc', label: 'Oldest' },
];
const STATUS_CHOICES: { value: TaskStatus; label: string; hint: string }[] = [
  { value: 'pending', label: 'Pending', hint: 'Not started yet' },
  { value: 'in_progress', label: 'In progress', hint: 'Working on it' },
  { value: 'completed', label: 'Done', hint: 'Finished' },
];

/** The member's task list: project chips, status tabs, search, sort, long-press to move. */
export default function MemberTasks() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const barScroll = useAutoHideTabBar();
  const params = useLocalSearchParams<{ status?: string; projectId?: string; view?: string }>();
  const [status, setStatus] = useState<StatusTab>('all');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [taskView, setTaskView] = useState<TaskView>('list');
  const [sort, setSort] = useState('deadline_asc');
  const [moving, setMoving] = useState<Task | null>(null);
  const sortSheet = useSheet();
  const statusSheet = useSheet();

  useEffect(() => {
    if (params.view === 'board' || params.view === 'list') setTaskView(params.view);
    if (params.status && STATUS_TABS.some((s) => s.key === params.status)) setStatus(params.status as StatusTab);
    if (params.projectId) setProjectId(Number(params.projectId) || null);
  }, [params.status, params.projectId, params.view]);

  // The chips are derived from the member's own tasks, as the web does.
  const all = useTasks({ limit: 200, sort: 'created_desc' });
  const list = useTasks({
    status: status === 'all' ? undefined : status,
    projectId: projectId ?? undefined,
    search: search || undefined,
    sort,
    limit: 200,
  });
  const move = useUpdateTaskStatus();

  const projects = useMemo(() => {
    const map = new Map<number, { id: number; key: string; name: string; count: number }>();
    for (const task of all.data?.items ?? []) {
      if (!task.project_id || !task.project_key) continue;
      const cur = map.get(task.project_id) ?? { id: task.project_id, key: task.project_key, name: task.project_name ?? task.project_key, count: 0 };
      cur.count += 1;
      map.set(task.project_id, cur);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [all.data]);

  const items = list.data?.items ?? [];
  const overdue = items.filter((x) => x.effective_status === 'overdue').length;

  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16 }}>
      <PageIntro compact={taskView === 'board'} title="My tasks" tone="sage" eyebrow="MAKE ROOM FOR FOCUS" subtitle={list.data ? `${list.data.total} ${list.data.total === 1 ? 'task' : 'tasks'}${overdue ? ` · ${overdue} overdue` : ''}` : ' '} right={<><IconPillButton icon={ArrowDownUp} tone="glass" onPress={sortSheet.open} accessibilityLabel="Sort" /></>} />
      {projects.length > 1 ? (
        <SegmentedTabs
          scroll
          items={[{ key: 'all', label: 'All' }, ...projects.map((p) => ({ key: String(p.id), label: p.key, count: p.count }))]}
          value={projectId ? String(projectId) : 'all'}
          onChange={(k) => setProjectId(k === 'all' ? null : Number(k))}
        />
      ) : null}
      <SegmentedTabs scroll iconic={false} items={STATUS_TABS} value={status} onChange={setStatus} />
      <SearchField value={search} onChange={setSearch} placeholder="Search tasks or keys" loading={list.isFetching && !!search} />
      <TaskViewSwitch value={taskView} onChange={setTaskView} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={list.isPending || taskView === 'board' ? [] : items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <TaskCard task={item} onPress={() => router.push(`/tasks/${item.id}`)} onLongPress={() => { setMoving(item); statusSheet.open(); }} />
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={taskView === 'board' && !list.isPending && !list.isError && (list.data?.items.length ?? 0) > 0 ? <TaskBoard tasks={list.data!.items} total={list.data!.total}  /> : list.isPending ? <SkeletonList count={4} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <EmptyState icon={ListChecks} title={search || status !== 'all' ? 'Nothing matches' : 'No tasks yet'} body={search || status !== 'all' ? 'Try another filter or clear the search.' : 'When a manager assigns you work, it shows up here.'} action={search || status !== 'all' ? { label: 'Clear filters', onPress: () => { setSearch(''); setStatus('all'); setProjectId(null); } } : undefined} />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching}
        onRefresh={() => { void list.refetch(); void all.refetch(); }}
        keyboardShouldPersistTaps="handled"
      />
      <PickerSheet ref={sortSheet.ref} title="Sort by" options={SORTS} value={sort} onSelect={setSort} />
      <PickerSheet
        ref={statusSheet.ref}
        title={moving ? `Move ${moving.task_key ?? 'task'}` : 'Move task'}
        options={STATUS_CHOICES}
        value={moving?.status}
        onSelect={(value) => {
          if (!moving) return;
          move.mutate({ id: moving.id, status: value }, {
            onError: (err) => toast.error('Could not update', errorMessage(err)),
            onSuccess: () => toast.success(`Marked ${STATUS_CHOICES.find((c) => c.value === value)?.label.toLowerCase()}`),
          });
        }}
      />
      {moving ? <View style={{ display: 'none' }}><Chip label={moving.task_key ?? ''} /></View> : null}
    </View>
  );
}
