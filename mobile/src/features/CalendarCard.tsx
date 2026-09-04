import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bug, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { addDaysIso, formatDate, todayIso } from '@/lib/format';
import type { Task, Ticket } from '@/types';
import { BentoCard, IconPillButton, Text, TextButton } from '@/components';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Kind = 'starts' | 'due' | 'overdue' | 'completed' | 'ticket';
interface Entry { kind: Kind; task?: Task; ticket?: Ticket; key: string; title: string; sub: string }

const KIND_LABEL: Record<Kind, string> = { starts: 'Starts', due: 'Due', overdue: 'Overdue', completed: 'Done', ticket: 'Ticket' };

const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const asDate = (iso: string) => new Date(`${iso}T00:00:00`);
const mondayIndex = (iso: string) => (asDate(iso).getDay() + 6) % 7;
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftMonth = (iso: string, by: number) => { const d = asDate(monthStart(iso)); d.setMonth(d.getMonth() + by); return isoOf(d); };
const monthTitle = (iso: string) => asDate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

interface Props {
  tasks: Task[];
  tickets?: Ticket[];
  onPressTask: (task: Task) => void;
  onPressTicket?: (ticket: Ticket) => void;
  /** Show who each task belongs to (the manager's view). */
  showAssignee?: boolean;
}

/**
 * A month at a glance: a dot under every day that has something on it — a task
 * starting, due, overdue or finished, a ticket raised — and, under the grid, the
 * things on the day you pick. Tap one to open it.
 */
export function CalendarCard({ tasks, tickets = [], onPressTask, onPressTicket, showAssignee }: Props) {
  const t = useTheme();
  const today = todayIso();
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const push = (day: string | null, entry: Entry) => {
      if (!day) return;
      const list = map.get(day);
      if (list) list.push(entry); else map.set(day, [entry]);
    };
    for (const task of tasks) {
      const sub = [task.task_key, showAssignee ? task.employee_name : null].filter(Boolean).join(' · ');
      const base = { task, key: `t${task.id}`, title: task.title, sub };
      if (task.status !== 'completed') push(dayOf(task.start_date), { ...base, kind: 'starts', key: `${base.key}s` });
      if (task.status !== 'completed') push(dayOf(task.deadline), { ...base, kind: task.effective_status === 'overdue' ? 'overdue' : 'due', key: `${base.key}d` });
      push(dayOf(task.completed_at), { ...base, kind: 'completed', key: `${base.key}c` });
    }
    for (const ticket of tickets) {
      push(dayOf(ticket.created_at), { ticket, kind: 'ticket', key: `k${ticket.id}`, title: ticket.title, sub: [ticket.ticket_key, showAssignee ? ticket.reporter_name : null].filter(Boolean).join(' · ') });
    }
    return map;
  }, [tasks, tickets, showAssignee]);

  const colorOf = (kind: Kind) => ({ starts: t.colors.hero, due: t.colors.warning, overdue: t.colors.danger, completed: t.colors.success, ticket: t.colors.info }[kind]);

  // Six rows of seven, starting on the Monday on or before the 1st.
  const cells = useMemo(() => {
    const first = monthStart(month);
    const start = addDaysIso(first, -mondayIndex(first));
    return Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
  }, [month]);

  const entries = byDay.get(selected) ?? [];
  const inMonth = (day: string) => day.slice(0, 7) === month.slice(0, 7);
  const goToday = () => { setMonth(monthStart(today)); setSelected(today); };

  return (
    <BentoCard padding={t.spacing.lg}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="h3" style={{ flex: 1 }}>{monthTitle(month)}</Text>
          {month !== monthStart(today) ? <TextButton label="Today" onPress={goToday} /> : null}
          <IconPillButton icon={ChevronLeft} size={32} tone="soft" onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityLabel="Previous month" />
          <IconPillButton icon={ChevronRight} size={32} tone="soft" onPress={() => setMonth((m) => shiftMonth(m, 1))} accessibilityLabel="Next month" />
        </View>

        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="caption" color="inkFaint">{w}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 4 }}>
          {Array.from({ length: 6 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {cells.slice(row * 7, row * 7 + 7).map((day) => {
                const dayEntries = byDay.get(day);
                const isToday = day === today;
                const isSelected = day === selected;
                const muted = !inMonth(day);
                const dots = [...new Set((dayEntries ?? []).map((e) => e.kind))].slice(0, 3);
                return (
                  <Pressable key={day} onPress={() => setSelected(day)} accessibilityRole="button" accessibilityLabel={formatDate(day)} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                    <View style={{
                      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSelected ? t.colors.pill : 'transparent',
                      borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: t.colors.hero,
                    }}
                    >
                      <Text variant="smallStrong" color={isSelected ? t.colors.onPill : muted ? 'inkFaint' : isToday ? 'hero' : 'ink'} style={{ letterSpacing: 0 }}>{Number(day.slice(8, 10))}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 1 }}>
                      {dots.map((kind) => <View key={kind} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colorOf(kind), opacity: muted ? 0.45 : 1 }} />)}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: t.colors.hairline, paddingTop: 12 }}>
          <Text variant="caption" color="inkMuted">{selected === today ? `Today · ${formatDate(selected)}` : formatDate(selected)}</Text>
          {entries.length === 0 ? <Text variant="small" color="inkFaint">Nothing on this day.</Text> : null}
          {entries.map((e) => (
            <Pressable
              key={e.key}
              onPress={() => (e.task ? onPressTask(e.task) : e.ticket && onPressTicket ? onPressTicket(e.ticket) : undefined)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              {e.kind === 'ticket'
                ? <Bug size={12} color={colorOf(e.kind)} strokeWidth={2.4} style={{ marginTop: 4 }} />
                : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorOf(e.kind), marginTop: 6 }} />}
              <View style={{ flex: 1 }}>
                <Text variant="small" numberOfLines={2}>{e.title}</Text>
                {e.sub ? <Text variant="caption" color="inkFaint">{e.sub}</Text> : null}
              </View>
              <Text variant="caption" color={e.kind === 'overdue' ? 'danger' : 'inkMuted'} style={{ marginTop: 2 }}>{KIND_LABEL[e.kind]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </BentoCard>
  );
}
