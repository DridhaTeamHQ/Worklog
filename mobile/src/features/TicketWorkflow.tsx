import { Pressable, View } from 'react-native';
import { Circle, CircleCheck, CircleDot, CircleX } from 'lucide-react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { alpha, useReducedMotion, useTheme } from '@/theme';
import type { TicketStatus } from '@/types';
import { Text } from '@/components/Text';

const STATES = [
  { key: 'open', label: 'Open', icon: Circle },
  { key: 'in_progress', label: 'In progress', icon: CircleDot },
  { key: 'resolved', label: 'Resolved', icon: CircleCheck },
  { key: 'closed', label: 'Closed', icon: CircleX },
] as const;

/** Current state, not a claimed history of states the ticket has passed through. */
export function TicketWorkflow({ value, onChange, busy }: { value: TicketStatus; onChange?: (status: TicketStatus) => void; busy?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return <View style={{ gap: 12 }}>
    <Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.5, paddingHorizontal: 4 }}>CURRENT STATUS</Text>
    <View style={{ flexDirection: 'row', gap: 6 }}>{STATES.map(({ key, label, icon: Icon }) => {
      const selected = value === key;
      const color = selected ? t.colors.hero : t.colors.inkMuted;
      return <Pressable key={key} accessibilityRole={onChange ? 'radio' : 'text'} accessibilityLabel={`${label}${selected ? ', current status' : ''}`} accessibilityState={onChange ? { checked: selected, disabled: !!busy } : undefined} aria-checked={onChange ? selected : undefined} disabled={!onChange || busy} onPress={() => { if (!selected) { Haptics.selectionAsync().catch(() => {}); onChange?.(key); } }} style={{ flex: 1 }}>
        {({ pressed }) => <MotiView animate={{ scale: pressed && !reduced ? 0.97 : 1, backgroundColor: selected ? alpha(t.colors.hero, 0.12) : t.colors.card }} transition={{ type: 'timing', duration: reduced ? 0 : 180 }} style={{ minHeight: 88, borderRadius: 20, borderWidth: 1, borderColor: selected ? alpha(t.colors.hero, 0.4) : t.colors.hairline, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 3 }}>
          <Icon size={23} color={color} strokeWidth={1.5} /><Text variant="caption" color={color} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
        </MotiView>}
      </Pressable>;
    })}</View>
  </View>;
}
