import { TaskBoard, TaskViewSwitch, type TaskView } from '@/features/TaskBoard';
import { PageIntro } from '@/components/ScreenHeader';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, CircleAlert, CircleCheck, CircleDot, List, ListChecks, Plus, SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useLabels } from '@/hooks/useLabels';
import type { Priority } from '@/types';
import {
  DateField, EmptyState, ErrorState, IconPillButton, PickerField, PickerSheet, PillButton, Reveal, SearchField, SegmentedTabs, Sheet,
  SkeletonList, Text, useSheet, useTabBarInset,
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
  { value: 'created_desc', label: 'Newest' }, { value: 'created_asc', label: 'Oldest' },
  { value: 'deadline_asc', label: 'Deadline soonest' }, { value: 'priority_desc', label: 'Priority highest' },
];
const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
];

/** Every task in the manager's scope: project chips, status tabs, search, a filter sheet, "+" to assign. */
export default function ManagerTasks() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const barScroll = useAutoHideTabBar();
  const params = useLocalSearchParams<{ status?: string; projectId?: string; employeeId?: string; view?: string }>();

  const [status, setStatus] = useState<StatusTab>('all');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [taskView, setTaskView] = useState<TaskView>('list');
  const [sort, setSort] = useState('created_desc');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [labelId, setLabelId] = useState<number | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<string | null>(null);

  const filterSheet = useSheet();
  const sortSheet = useSheet();
  const employeeSheet = useSheet();
  const prioritySheet = useSheet();
  const labelSheet = useSheet();

  useEffect(() => {
    if (params.view === 'board' || params.view === 'list') setTaskView(params.view);
    if (params.status && STATUS_TABS.some((s) => s.key === params.status)) setStatus(params.status as StatusTab);
    if (params.projectId) setProjectId(Number(params.projectId) || null);
    if (params.employeeId) setEmployeeId(Number(params.employeeId) || null);
  }, [params.status, params.projectId, params.employeeId, params.view]);

  const projects = useProjects(false);
  const team = useTeam();
  const labels = useLabels();
  const list = useTasks({
    status: status === 'all' ? undefined : status,
    projectId: projectId ?? undefined,
    employeeId: employeeId ?? undefined,
    priority: priority ?? undefined,
    labelId: labelId ?? undefined,
    deadlineTo: deadlineTo ?? undefined,
    search: search || undefined,
    sort,
    limit: 200,
  });

  const activeFilters = [employeeId, priority, labelId, deadlineTo].filter((v) => v != null).length + (sort !== 'created_desc' ? 1 : 0);
  const clearFilters = () => { setEmployeeId(null); setPriority(null); setLabelId(null); setDeadlineTo(null); setSort('created_desc'); };

  const employeeOptions = useMemo(() => (team.data ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.department ?? undefined })), [team.data]);
  const labelOptions = useMemo(() => (labels.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color })), [labels.data]);

  const overdue = (list.data?.items ?? []).filter((x) => x.effective_status === 'overdue').length;
  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16 }}>
      <PageIntro compact={taskView === 'board'} title="Tasks" tone="sage" eyebrow="KEEP WORK MOVING" subtitle={list.data ? `${list.data.total} in view${overdue ? ` · ${overdue} overdue` : ''}` : ' '} right={<><IconPillButton icon={SlidersHorizontal} tone="glass" badge={activeFilters || undefined} onPress={filterSheet.open} accessibilityLabel="Filters" />
        <IconPillButton icon={Plus} onPress={() => router.push({ pathname: '/tasks/assign', params: projectId ? { projectId: String(projectId) } : {} })} accessibilityLabel="Assign a task" /></>} />
      {(projects.data?.length ?? 0) > 0 ? (
        <SegmentedTabs
          scroll
          items={[{ key: 'all', label: 'All' }, ...(projects.data ?? []).map((p) => ({ key: String(p.id), label: p.project_key, count: p.counts.total }))]}
          value={projectId ? String(projectId) : 'all'}
          onChange={(k) => setProjectId(k === 'all' ? null : Number(k))}
        />
      ) : null}
      <SegmentedTabs scroll iconic={false} items={STATUS_TABS} value={status} onChange={setStatus} />
      <SearchField value={search} onChange={setSearch} placeholder="Search tasks, keys, people" loading={list.isFetching && !!search} />
      <TaskViewSwitch value={taskView} onChange={setTaskView} />
    </View>
  );

  const empty = !projects.isPending && (projects.data?.length ?? 0) === 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={list.isPending || taskView === 'board' ? [] : list.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <TaskCard task={item} showAssignee onPress={() => router.push(`/tasks/${item.id}`)} />
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={taskView === 'board' && !list.isPending && !list.isError && (list.data?.items.length ?? 0) > 0 ? <TaskBoard tasks={list.data!.items} total={list.data!.total} showAssignee /> : list.isPending ? <SkeletonList count={4} /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : empty ? (
          <EmptyState icon={ListChecks} title="No projects yet" body="Tasks live inside projects. Create one, then assign the first task." action={{ label: 'New project', onPress: () => router.push('/projects/new') }} />
        ) : (
          <EmptyState icon={ListChecks} title="Nothing here" body={activeFilters || search || status !== 'all' ? 'Try loosening the filters.' : 'Assign the first task with the + button.'} action={activeFilters || search ? { label: 'Clear filters', onPress: () => { clearFilters(); setSearch(''); setStatus('all'); } } : undefined} />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching}
        onRefresh={() => { void list.refetch(); void projects.refetch(); }}
        keyboardShouldPersistTaps="handled"
      />

      <Sheet ref={filterSheet.ref} title="Filters">
        <View style={{ gap: 14 }}>
          <PickerField label="Assignee" value={employeeOptions.find((o) => o.value === employeeId)?.label ?? null} placeholder="Anyone" onPress={employeeSheet.open} />
          <PickerField label="Priority" value={PRIORITIES.find((o) => o.value === priority)?.label ?? null} placeholder="Any" onPress={prioritySheet.open} />
          <PickerField label="Label" value={labelOptions.find((o) => o.value === labelId)?.label ?? null} placeholder="Any" onPress={labelSheet.open} />
          <DateField label="Deadline before" value={deadlineTo} onChange={setDeadlineTo} placeholder="Any time" />
          <PickerField label="Sort" value={SORTS.find((s) => s.value === sort)?.label ?? null} onPress={sortSheet.open} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <PillButton label="Clear" variant="ghost" onPress={clearFilters} style={{ flex: 1 }} block />
            <PillButton label="Done" onPress={filterSheet.close} style={{ flex: 1 }} block />
          </View>
        </View>
      </Sheet>
      <PickerSheet ref={employeeSheet.ref} title="Assignee" options={employeeOptions} value={employeeId} onSelect={setEmployeeId} searchable clearLabel="Anyone" onClear={() => setEmployeeId(null)} />
      <PickerSheet ref={prioritySheet.ref} title="Priority" options={PRIORITIES} value={priority} onSelect={setPriority} clearLabel="Any priority" onClear={() => setPriority(null)} />
      <PickerSheet ref={labelSheet.ref} title="Label" options={labelOptions} value={labelId} onSelect={setLabelId} clearLabel="Any label" onClear={() => setLabelId(null)} empty="No labels yet" />
      <PickerSheet ref={sortSheet.ref} title="Sort by" options={SORTS} value={sort} onSelect={setSort} />
    </View>
  );
}
