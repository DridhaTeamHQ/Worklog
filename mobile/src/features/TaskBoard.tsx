import { MotiView } from 'moti';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Columns3, List, Minus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { alpha, useReducedMotion, useTheme } from '@/theme';
import type { EffectiveStatus, Task, TaskStatus } from '@/types';
import { errorMessage } from '@/api/client';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import { IconPillButton, PickerSheet, SegmentedTabs, Text, useSheet, useToast } from '@/components';
import { TaskCard } from './TaskCard';

export type TaskView = 'list' | 'board';
export function TaskViewSwitch({ value, onChange }: { value: TaskView; onChange: (value: TaskView) => void }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.2, flexShrink: 1 }}>YOUR WORK, YOUR VIEW</Text>
    <View style={{ width: 160 }}><SegmentedTabs iconic={false} items={[{ key: 'list', label: 'List', icon: List }, { key: 'board', label: 'Board', icon: Columns3 }]} value={value} onChange={onChange} /></View>
  </View>;
}

const LANES: { key: EffectiveStatus; title: string; caption: string }[] = [
  { key: 'pending', title: 'To do', caption: 'Room for a beginning' },
  { key: 'in_progress', title: 'In motion', caption: 'Good work happening' },
  { key: 'overdue', title: 'Needs attention', caption: 'Bring it back on track' },
  { key: 'completed', title: 'Done', caption: 'A little more progress' },
];
const MOVES: { value: TaskStatus; label: string; hint: string }[] = [
  { value: 'pending', label: 'To do', hint: 'Ready when you are' },
  { value: 'in_progress', label: 'In progress', hint: 'Start moving it forward' },
  { value: 'completed', label: 'Done', hint: 'One less thing on your mind' },
];

/** Four distinct lanes. Every card has an explicit, accessible move action. */
export function TaskBoard({ tasks, showAssignee, total }: { tasks: Task[]; showAssignee?: boolean; total: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const laneWidth = Math.min(300, width - 76);
  const laneHeight = Math.max(340, Math.min(510, height * 0.62));
  const sheet = useSheet();
  const toast = useToast();
  const move = useUpdateTaskStatus();
  const [movingId, setMovingId] = useState<number | null>(null);
  const initialLane = useRef(Math.max(0, LANES.findIndex((lane) => tasks.some((task) => task.effective_status === lane.key))));
  const [activeLane, setActiveLane] = useState(initialLane.current);
  const board = useRef<FlatList>(null);
  const goToLane = (index: number) => {
    const next = Math.max(0, Math.min(LANES.length - 1, index));
    setActiveLane(next);
    board.current?.scrollToOffset({ offset: next * (laneWidth + 12), animated: !reduced });
  };
  const moving = tasks.find((task) => task.id === movingId);
  const lanes = useMemo(() => LANES.map((lane) => ({ ...lane, tasks: tasks.filter((task) => task.effective_status === lane.key) })), [tasks]);
  return <MotiView from={{ opacity: reduced ? 1 : 0, translateY: reduced ? 0 : 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: reduced ? 0 : 220 }} style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flex: 1, gap: 3 }}><Text variant="smallStrong">{LANES[activeLane].title}</Text><Text variant="caption" color="inkMuted">{activeLane + 1} / 4 lanes · swipe to explore</Text></View>
      <IconPillButton icon={ChevronLeft} size={36} tone="soft" accessibilityLabel="Previous board lane" disabled={activeLane === 0} onPress={() => goToLane(activeLane - 1)} />
      <IconPillButton icon={ChevronRight} size={36} tone="soft" accessibilityLabel="Next board lane" disabled={activeLane === 3} onPress={() => goToLane(activeLane + 1)} />
    </View>
    {total > tasks.length ? <Text variant="caption" color="inkMuted">Showing {tasks.length} of {total} matches. Narrow your filters to see the rest.</Text> : null}
    <FlatList ref={board} horizontal data={lanes} initialScrollIndex={initialLane.current} getItemLayout={(_, index) => ({ index, length: laneWidth + 12, offset: index * (laneWidth + 12) })} keyExtractor={(lane) => lane.key} showsHorizontalScrollIndicator={false} snapToInterval={laneWidth + 12} decelerationRate="fast" onMomentumScrollEnd={(event) => setActiveLane(Math.min(3, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / (laneWidth + 12)))))} contentContainerStyle={{ gap: 12, paddingBottom: 6, paddingRight: Math.max(0, width - 44 - laneWidth) }} renderItem={({ item: lane }) => {
      const color = t.tone('status', lane.key).color;
      return <View style={{ width: laneWidth, height: laneHeight, borderRadius: 26, borderWidth: 1, borderColor: t.colors.hairline, backgroundColor: alpha(color, t.isDark ? 0.045 : 0.05), overflow: 'hidden' }}>
        <View style={{ padding: 18, gap: 6, borderTopWidth: 3, borderTopColor: color }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /><Text variant="h3" style={{ flex: 1 }}>{lane.title}</Text><Text variant="mono" color={color}>{String(lane.tasks.length).padStart(2, '0')}</Text></View>
          <Text variant="caption" color="inkMuted">{lane.caption}</Text>
        </View>
        <FlatList data={lane.tasks} keyExtractor={(task) => String(task.id)} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 14, gap: 12 }} ListEmptyComponent={<View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 12 }}><Minus size={24} color={t.colors.inkFaint} /><Text variant="small" color="inkMuted">Nothing in this lane</Text></View>} renderItem={({ item: task }) => <MotiView from={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: reduced ? 0 : 200 }} style={{ gap: 5 }}>
          <TaskCard task={task} compact showAssignee={showAssignee} onPress={() => router.push(`/tasks/${task.id}`)} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Move ${task.task_key ?? task.title}`} disabled={move.isPending} onPress={() => { setMovingId(task.id); sheet.open(); }} style={({ pressed }) => ({ alignSelf: 'flex-end', flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: pressed ? t.colors.cardAlt : 'transparent' })}>
            <ArrowRightLeft size={13} color={t.colors.inkMuted} /><Text variant="caption" color="inkMuted">Move</Text>
          </Pressable>
        </MotiView>} />
      </View>;
    }} />
    <PickerSheet ref={sheet.ref} title={moving ? `Move ${moving.task_key ?? 'task'}` : 'Move task'} options={MOVES} value={moving?.status} onSelect={(status) => {
      if (!moving || move.isPending || status === moving.status) return;
      const laneKey = moving.effective_status === 'overdue' && status !== 'completed' ? 'overdue' : status;
      move.mutate({ id: moving.id, status }, { onSuccess: () => {
        goToLane(LANES.findIndex((lane) => lane.key === laneKey));
        toast.success(status === 'completed' ? 'A little more done.' : 'Status updated', laneKey === 'overdue' ? 'Past-due work stays in Needs attention.' : MOVES.find((item) => item.value === status)?.label);
      }, onError: (error) => toast.error('Could not move task', errorMessage(error)) });
    }} />
  </MotiView>;
}
