import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useReducedMotion, useTheme } from '@/theme';

export type CardTone = 'card' | 'alt' | 'accent' | 'hero' | 'glass' | 'outline';

interface Props {
  children: ReactNode;
  tone?: CardTone;
  padding?: number;
  radius?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Softer shadow for cards on the ground; none for nested ones. */
  elevated?: boolean;
  /**
   * Blur what is behind a glass card. Off by default: on the hero's flat gradient a
   * blur only adds haze, and the translucent tint alone gives the frosted look. Turn
   * it on when the card floats over content.
   */
  blur?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The white rounded card that the whole layout is made of. Pressable variants scale
 * down a touch with a spring and give a light haptic tick — the calm, physical feel
 * of the reference. `glass` is a frosted card for sitting over the hero.
 */
export function BentoCard({
  children, tone = 'card', padding, radius, onPress, onLongPress, disabled, elevated = true, blur = false, style, accessibilityLabel,
}: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pad = padding ?? t.spacing.xl;
  const r = radius ?? t.radius.lg;
  // A card asked to flex (a tile in a row) must flex from its outer wrapper too, or
  // the row sizes it by content instead of sharing the width.
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const outer: ViewStyle | undefined = flat?.flex != null ? { flex: flat.flex } : undefined;

  // A hairline edge separates a card from the ground in both themes: grey on white
  // needs definition without a shadow, and on black a shadow would vanish anyway.
  const edge = { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.hairline };
  const background: Record<CardTone, ViewStyle> = {
    card: { backgroundColor: t.colors.card, ...edge },
    alt: { backgroundColor: t.colors.cardAlt },
    accent: { backgroundColor: t.colors.accent },
    hero: { backgroundColor: t.colors.hero },
    // Frosted, but tinted like the hero it sits on — not a white slab over blue.
    glass: { backgroundColor: t.colors.glass, borderWidth: 1, borderColor: t.colors.glassBorder },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.colors.border },
  };

  const inner = (pressed: boolean) => (
    <MotiView
      animate={{ scale: pressed && !reduced ? t.motion.pressScale : 1, opacity: disabled ? 0.55 : 1 }}
      transition={reduced ? { type: 'timing', duration: 0 } : { type: 'spring', ...t.motion.spring }}
      style={[
        { borderRadius: r, padding: pad, overflow: tone === 'glass' ? 'hidden' : 'visible' },
        background[tone],
        elevated && !t.isDark && tone !== 'outline' && tone !== 'glass' ? t.shadow.card : null,
        style,
      ]}
    >
      {tone === 'glass' && blur ? (
        <BlurView
          intensity={24}
          tint="light"
         
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </MotiView>
  );

  if (!onPress && !onLongPress) return <View style={outer}>{inner(false)}</View>;

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      onLongPress={onLongPress ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onLongPress(); } : undefined}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={outer}
    >
      {({ pressed }) => inner(pressed)}
    </Pressable>
  );
}
