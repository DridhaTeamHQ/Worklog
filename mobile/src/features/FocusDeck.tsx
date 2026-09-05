import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ArrowRight, ChevronLeft, ChevronRight, MoveUpRight } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { useReducedMotion, useTheme } from '@/theme';
import type { Task } from '@/types';
import { deadlineLabel, taskLabel } from '@/lib/format';
import { Avatar, IconPillButton, PillButton, Text } from '@/components';
import { AuroraSurface } from '@/components/AuroraCard';

/** A small, live queue: overdue first, then priority and the nearest deadline. */
export function FocusDeck({ tasks, manager = false }: { tasks: Task[]; manager?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queue = useMemo(() => {
    const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
    return tasks.filter((task) => task.status !== 'completed').sort((a, b) =>
      Number(b.effective_status === 'overdue') - Number(a.effective_status === 'overdue') ||
      priority[a.priority] - priority[b.priority] ||
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.id - b.id
    ).slice(0, 5);
  }, [tasks]);
  const index = Math.max(0, queue.findIndex((task) => task.id === selectedId));
  const task = queue[index];
  if (!task) return null;
  const due = deadlineLabel(task.deadline, task.effective_status);
  const step = (direction: number) => setSelectedId(queue[(index + direction + queue.length) % queue.length].id);

  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 }}>
      <Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.8 }}>{manager ? 'IN THE SPOTLIGHT' : 'ONE THING AT A TIME'}</Text>
      <Text variant="mono" color="inkMuted">{String(index + 1).padStart(2, '0')} / {String(queue.length).padStart(2, '0')}</Text>
    </View>
    <View style={{ borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.hairline, backgroundColor: t.colors.card }}>
      <View style={{ height: 5, backgroundColor: task.effective_status === 'overdue' ? t.colors.danger : t.colors.accent }} />
      <View style={{ padding: 22, gap: 22 }}>
        <View pointerEvents="none" accessible={false} style={{ position: 'absolute', width: 190, height: 190, right: -80, top: -95, borderRadius: 95, overflow: 'hidden', opacity: t.isDark ? 0.55 : 0.18 }}><AuroraSurface tone="sage" /></View>
        <MotiView key={task.id} from={{ opacity: reduced ? 1 : 0, translateY: reduced ? 0 : 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: reduced ? 0 : 220 }} style={{ gap: 13 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Text variant="mono" color="inkMuted" style={{ flexShrink: 1 }}>{task.task_key ?? 'TASK'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MoveUpRight size={12} color={t.tone('priority', task.priority).color} />
              <Text variant="caption" color={t.tone('priority', task.priority).color}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority</Text>
            </View>
          </View>
          <Text variant="h2" numberOfLines={3} style={{ fontFamily: t.fonts.medium, letterSpacing: -0.8 }}>{taskLabel(task)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {manager ? <Avatar name={task.employee_name} src={task.employee_profile_image} size="sm" /> : null}
            <Text variant="small" color={due.tone === 'danger' ? 'danger' : 'inkMuted'} style={{ flex: 1 }}>{manager ? `${task.employee_name.split(' ')[0]} · ` : ''}{due.text}</Text>
          </View>
        </MotiView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <PillButton label="Open task" iconRight={ArrowRight} size="sm" variant="accent" onPress={() => router.push(`/tasks/${task.id}`)} />
          {queue.length > 1 ? <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconPillButton icon={ChevronLeft} size={40} tone="soft" accessibilityLabel="Previous focus task" onPress={() => step(-1)} />
            <IconPillButton icon={ChevronRight} size={40} tone="soft" accessibilityLabel="Next focus task" onPress={() => step(1)} />
          </View> : null}
        </View>
      </View>
    </View>
  </View>;
}
