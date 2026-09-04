import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Clock, Plus, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import type { ReportItemInput, ReportSuggestion } from '@/api/endpoints';
import { formatMinutes } from '@/lib/format';
import { IconPillButton, KeyChip, StatusChip, Text, Chip } from '@/components';

export interface DraftItem extends ReportItemInput {
  /** Local key for React; not sent. */
  key: string;
  taskKey?: string | null;
  taskTitle?: string | null;
}

interface Props {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  suggestions: ReportSuggestion[];
}

const newKey = () => `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The structured half of the report: lines, each optionally tied to a task and timed.
 * Suggestions (tasks in progress today) become lines with one tap.
 */
export function ReportItemsEditor({ items, onChange, suggestions }: Props) {
  const t = useTheme();
  const [draft, setDraft] = useState('');
  const linked = new Set(items.map((i) => i.taskId).filter(Boolean));
  const offered = suggestions.filter((s) => !linked.has(s.id));

  const update = (key: string, patch: Partial<DraftItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeItem = (key: string) => onChange(items.filter((i) => i.key !== key));
  const addFree = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { key: newKey(), text, taskId: null, minutes: null }]);
    setDraft('');
  };
  const addSuggestion = (s: ReportSuggestion) => onChange([
    ...items,
    { key: newKey(), text: s.title || s.task_key || 'Worked on this task', taskId: s.id, taskKey: s.task_key, taskTitle: s.title, minutes: null },
  ]);
  const bump = (key: string, delta: number) => {
    const cur = items.find((i) => i.key === key);
    const next = Math.max(0, Math.min(1440, (Number(cur?.minutes) || 0) + delta));
    update(key, { minutes: next || null });
  };

  return (
    <View style={{ gap: 12 }}>
      {offered.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color={t.colors.warning} />
            <Text variant="smallStrong" color="inkMuted">Worked on today?</Text>
          </View>
          <View style={{ gap: 6 }}>
            {offered.map((s) => (
              <Pressable key={s.id} onPress={() => addSuggestion(s)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? t.colors.neutralSoft : t.colors.cardAlt, borderRadius: t.radius.md, paddingHorizontal: 12, paddingVertical: 10 })}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={14} color={t.colors.hero} strokeWidth={2.6} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <KeyChip value={s.task_key} />
                  <Text variant="small" numberOfLines={2}>{s.title || 'Untitled'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {items.map((item) => (
        <View key={item.key} style={{ backgroundColor: t.colors.cardAlt, borderRadius: t.radius.md, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.taskKey ? <KeyChip value={item.taskKey} /> : <Chip label="Note" size="sm" />}
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => removeItem(item.key)} hitSlop={8} accessibilityLabel="Remove line">
              <X size={16} color={t.colors.inkFaint} />
            </Pressable>
          </View>
          <TextInput
            maxFontSizeMultiplier={1.15}
            value={item.text}
            onChangeText={(text) => update(item.key, { text })}
            placeholder="What did you do?"
            placeholderTextColor={t.colors.inkFaint}
            multiline
            style={{ color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0, lineHeight: 21 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
              <Clock size={14} color={item.minutes ? t.colors.hero : t.colors.inkFaint} />
              <Text variant="small" color={item.minutes ? 'ink' : 'inkFaint'}>{item.minutes ? formatMinutes(item.minutes) : 'Add time'}</Text>
            </View>
            {[15, 30, 60].map((m) => (
              <Pressable key={m} onPress={() => bump(item.key, m)} accessibilityLabel={`Add ${m} minutes`} style={({ pressed }) => ({ paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: pressed ? t.colors.border : t.colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.colors.border })}>
                <Text variant="caption" style={{ letterSpacing: 0 }}>+{m}</Text>
              </Pressable>
            ))}
            {item.minutes ? (
              <Pressable onPress={() => update(item.key, { minutes: null })} hitSlop={6} accessibilityLabel="Clear time" style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, backgroundColor: pressed ? t.colors.border : t.colors.neutralSoft, alignItems: 'center', justifyContent: 'center' })}>
                <RotateCcw size={12} color={t.colors.inkMuted} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: t.colors.cardAlt, borderRadius: t.radius.pill, paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
          <TextInput
            maxFontSizeMultiplier={1.15}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a line…"
            placeholderTextColor={t.colors.inkFaint}
            onSubmitEditing={addFree}
            returnKeyType="done"
            blurOnSubmit={false}
            style={{ color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0 }}
          />
        </View>
        <IconPillButton icon={Plus} size={40} onPress={addFree} disabled={!draft.trim()} accessibilityLabel="Add line" />
      </View>
    </View>
  );
}

/** Rebuild draft rows from a saved report. */
export function draftsFromReport(items: { id: number; task_id: number | null; text: string; minutes: number | null; task_key: string | null; task_title: string | null }[]): DraftItem[] {
  return items.map((i) => ({ key: `s${i.id}`, taskId: i.task_id, text: i.text, minutes: i.minutes, taskKey: i.task_key, taskTitle: i.task_title }));
}

export { StatusChip };
