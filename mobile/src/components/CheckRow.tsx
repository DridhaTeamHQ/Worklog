import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  checked: boolean;
  label: string;
  meta?: string | null;
  onToggle?: (next: boolean) => void;
  right?: ReactNode;
  onPressLabel?: () => void;
  disabled?: boolean;
  /** Line through the label when checked (default) or keep it plain. */
  strike?: boolean;
}

/**
 * The checklist row from the reference: a round circle that fills with a tick, the
 * label beside it. The circle animates and gives a small haptic on toggle.
 */
export function CheckRow({ checked, label, meta, onToggle, right, onPressLabel, disabled, strike = true }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const toggle = () => {
    if (disabled || !onToggle) return;
    Haptics.impactAsync(checked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onToggle(!checked);
  };
  const circle = { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: disabled ? 0.6 : 1 }}>
      <Pressable onPress={toggle} hitSlop={10} accessibilityLabel={label} accessibilityRole="checkbox" aria-checked={checked} aria-disabled={disabled || !onToggle} accessibilityState={{ checked, disabled: disabled || !onToggle }} disabled={disabled || !onToggle}>
        {reduced ? (
          <View style={[circle, { backgroundColor: checked ? t.colors.hero : 'transparent', borderColor: checked ? t.colors.hero : t.colors.inkFaint }]}>
            {checked ? <Check size={15} color={t.colors.onHero} strokeWidth={3} /> : null}
          </View>
        ) : (
          <MotiView
            animate={{ backgroundColor: checked ? t.colors.hero : 'rgba(0,0,0,0)', borderColor: checked ? t.colors.hero : t.colors.inkFaint, scale: checked ? 1 : 0.96 }}
            transition={{ type: 'spring', damping: 16, stiffness: 240 }}
            style={circle}
          >
            <MotiView animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ type: 'spring', damping: 14, stiffness: 260 }}>
              <Check size={15} color={t.colors.onHero} strokeWidth={3} />
            </MotiView>
          </MotiView>
        )}
      </Pressable>
      <Pressable onPress={onPressLabel ?? toggle} style={{ flex: 1 }} disabled={disabled || (!onPressLabel && !onToggle)}>
        <Text variant="body" color={checked && strike ? 'inkMuted' : 'ink'} style={checked && strike ? { textDecorationLine: 'line-through' } : undefined}>{label}</Text>
        {meta ? <Text variant="small" color="inkFaint">{meta}</Text> : null}
      </Pressable>
      {right}
    </View>
  );
}
