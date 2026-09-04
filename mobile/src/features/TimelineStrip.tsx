import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { addDaysIso, formatDate, formatTime, taskLabel, todayIso } from '@/lib/format';
import type { Task } from '@/types';
import { BentoCard, IconPillButton, Text, TextButton } from '@/components';

/** Six weeks at a glance, the same span the web strip covers. */
const DAYS_SHOWN = 42;
const DAY_WIDTH = 36;

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
const weekdayIndex = (iso: string) => (asDate(iso).getDay() + 6) % 7;
const WEEKDAY_INITIAL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Kind = 'starts' | 'due' | 'completed';
interface Entry { task: Task; kind: Kind; at: string | null }
const KIND_LABEL: Record<Kind, string> = { starts: 'Starts', due: 'Due', completed: 'Completed' };

interface Props {
  tasks: Task[];
  onPressTask: (task: Task) => void;
}

/**
 * The schedule strip: six weeks of days, a pin on every day that has something on it
 * (coloured by the most urgent thing that day), and a panel for the day you pick.
 * Ported from the web's TimelineStrip; start dates and deadlines are plain dates and
 * show no clock time, only completions do.
 */
export function TimelineStrip({ tasks, onPressTask }: Props) {
  const t = useTheme();
  const today = todayIso();
  const [anchor, setAnchor] = useState(() => addDaysIso(today, -(weekdayIndex(today) + 14)));
  const [selected, setSelected] = useState<string | null>(today);
  const scroller = useRef<ScrollView>(null);

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDaysIso(anchor, i)), [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const push = (day: string | null, entry: Entry) => {
      if (!day) return;
      const list = map.get(day);
      if (list) list.push(entry); else map.set(day, [entry]);
    };
    for (const task of tasks) {
      push(dayOf(task.start_date), { task, kind: 'starts', at: null });
      push(dayOf(task.deadline), { task, kind: 'due', at: null });
      push(dayOf(task.completed_at), { task, kind: 'completed', at: task.completed_at });
    }
    return map;
  }, [tasks]);

  const pinColor = (entries: Entry[]) => {
    if (entries.some((e) => e.task.effective_status === 'overdue')) return t.colors.danger;
    if (entries.some((e) => e.kind === 'due' && e.task.status !== 'completed')) return t.colors.warning;
    if (entries.some((e) => e.kind === 'completed')) return t.colors.success;
    return t.colors.hero;
  };

  const selectedEntries = selected ? byDay.get(selected) ?? [] : [];
  const goToday = () => {
    setAnchor(addDaysIso(today, -(weekdayIndex(today) + 14)));
    setSelected(today);
    scroller.current?.scrollTo({ x: 14 * DAY_WIDTH - 40, animated: true });
  };

  return (
    <BentoCard padding={t.spacing.md}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} color={t.colors.hero} />
          <Text variant="h3" style={{ flex: 1 }}>Schedule</Text>
          <IconPillButton icon={ChevronLeft} size={32} tone="soft" onPress={() => setAnchor((a) => addDaysIso(a, -7))} accessibilityLabel="Previous week" />
          <TextButton label="Today" onPress={goToday} />
          <IconPillButton icon={ChevronRight} size={32} tone="soft" onPress={() => setAnchor((a) => addDaysIso(a, 7))} accessibilityLabel="Next week" />
        </View>

        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: 14 * DAY_WIDTH - 40, y: 0 }}>
          <View style={{ flexDirection: 'row' }}>
            {days.map((day) => {
              const entries = byDay.get(day);
              const isToday = day === today;
              const isSelected = day === selected;
              const monday = weekdayIndex(day) === 0;
              return (
                <Pressable key={day} onPress={() => setSelected(day)} style={{ width: DAY_WIDTH, alignItems: 'center', gap: 6, paddingVertical: 4, borderLeftWidth: monday ? 1 : 0, borderLeftColor: t.colors.border }}>
                  <View style={{ height: 22, justifyContent: 'flex-end' }}>
                    {entries?.length ? (
                      <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: pinColor(entries), alignItems: 'center', justifyContent: 'center', borderWidth: isSelected ? 2 : 0, borderColor: t.colors.ink }}>
                        <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, fontFamily: t.fonts.semibold }}>{entries.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" color={isToday ? 'hero' : 'inkFaint'}>{WEEKDAY_INITIAL[weekdayIndex(day)]}</Text>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? t.colors.pill : isToday ? t.colors.infoSoft : 'transparent' }}>
                    <Text variant="smallStrong" color={isSelected ? t.colors.onPill : isToday ? 'hero' : 'ink'}>{Number(day.slice(8, 10))}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: t.colors.hairline, paddingTop: 12 }}>
          <Text variant="caption" color="inkMuted">{selected ? formatDate(selected) : 'Pick a day'}</Text>
          {selectedEntries.length === 0 ? <Text variant="small" color="inkFaint">Nothing scheduled.</Text> : null}
          {selectedEntries.map((e, i) => {
            const dot = e.kind === 'completed' ? t.colors.success : e.kind === 'due' ? (e.task.effective_status === 'overdue' ? t.colors.danger : t.colors.warning) : t.colors.hero;
            return (
              <Pressable key={`${e.task.id}-${e.kind}-${i}`} onPress={() => onPressTask(e.task)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 6 }} />
                <Text variant="small" numberOfLines={2} style={{ flex: 1 }}>{taskLabel(e.task)}</Text>
                <Text variant="caption" color="inkMuted" style={{ marginTop: 2 }}>{KIND_LABEL[e.kind]}{e.at ? ` ${formatTime(e.at)}` : ''}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </BentoCard>
  );
}
