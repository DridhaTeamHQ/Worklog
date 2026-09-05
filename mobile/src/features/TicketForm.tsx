import { Pressable, View } from 'react-native';
import { alpha, useTheme } from '@/theme';
import type { TicketSeverity } from '@/types';
import { Field, Text } from '@/components';

// Just the word: four tiles across a phone leave no room for a second line.
const SEVERITIES: { value: TicketSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function SeverityPicker({ value, onChange }: { value: TicketSeverity; onChange: (v: TicketSeverity) => void }) {
  const t = useTheme();
  return (
    <Field label="Severity">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SEVERITIES.map((s) => {
          const selected = value === s.value;
          const color = t.tone('severity', s.value).color;
          return (
            <Pressable key={s.value} onPress={() => onChange(s.value)} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} style={{ flex: 1, borderRadius: t.radius.md, paddingVertical: 13, paddingHorizontal: 6, borderWidth: 1.5, borderColor: selected ? color : t.colors.border, backgroundColor: selected ? alpha(color, t.isDark ? 0.22 : 0.1) : t.colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="smallStrong" color={selected ? color : 'inkMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

export const TICKET_PLACEHOLDER = 'Steps to reproduce:\n1. …\n\nExpected:\n…\n\nActual:\n…';
