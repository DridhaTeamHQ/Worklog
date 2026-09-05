import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Spinner } from './Loaders';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from './Text';

type Variant = 'white' | 'ink' | 'hero' | 'ghost' | 'danger' | 'accent' | 'soft';
type Size = 'lg' | 'md' | 'sm';

interface PillButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  haptic?: 'light' | 'medium' | 'success' | 'none';
  style?: StyleProp<ViewStyle>;
}

/**
 * The big rounded pill CTA from the reference ("Get started"). White on the hero, ink
 * on the ground, and a few quieter variants for secondary actions.
 */
export function PillButton({
  label, onPress, variant = 'ink', size = 'md', icon: Icon, iconRight: IconRight, loading, disabled, block, haptic = 'light', style,
}: PillButtonProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = t.colors;
  const looks: Record<Variant, { bg: string; fg: string; border?: string }> = {
    // Literal white: this variant sits on the blue hero, which is blue in both themes.
    white: { bg: '#FFFFFF', fg: '#0F1222' },
    ink: { bg: c.pill, fg: c.onPill },
    hero: { bg: c.hero, fg: c.onHero },
    ghost: { bg: 'transparent', fg: c.ink, border: c.border },
    danger: { bg: c.danger, fg: '#FFFFFF' },
    accent: { bg: c.accent, fg: c.onAccent },
    soft: { bg: c.neutralSoft, fg: c.ink },
  };
  const look = looks[variant];
  const heights: Record<Size, number> = { lg: 58, md: 50, sm: 40 };
  const padX: Record<Size, number> = { lg: 28, md: 22, sm: 16 };
  const textVariant = size === 'sm' ? 'smallStrong' : 'bodyStrong';
  const iconSize = size === 'sm' ? 16 : 18;

  const fire = () => {
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  return (
    <Pressable onPress={fire} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} style={block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }}>
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed && !reduced ? t.motion.pressScale : 1, opacity: disabled ? 0.5 : 1 }}
          transition={reduced ? { type: 'timing', duration: 0 } : { type: 'spring', ...t.motion.spring }}
          style={[
            {
              height: heights[size],
              paddingHorizontal: padX[size],
              borderRadius: t.radius.pill,
              backgroundColor: look.bg,
              borderWidth: look.border ? 1 : 0,
              borderColor: look.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            },
            variant === 'white' || variant === 'ink' || variant === 'hero' ? t.shadow.card : null,
            style,
          ]}
        >
          {loading ? <Spinner size={size === 'lg' ? 22 : 18} color={look.fg} track={false} /> : (
            <>
              {Icon ? <Icon size={iconSize} color={look.fg} strokeWidth={2.4} /> : null}
              <Text variant={textVariant} color={look.fg}>{label}</Text>
              {IconRight ? <IconRight size={iconSize} color={look.fg} strokeWidth={2.4} /> : null}
            </>
          )}
        </MotiView>
      )}
    </Pressable>
  );
}

interface IconPillButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  tone?: 'ink' | 'white' | 'hero' | 'glass' | 'soft' | 'accent' | 'danger' | 'plain';
  badge?: number;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** The black circle icon button (and its glass twin for sitting on the hero). */
export function IconPillButton({
  icon: Icon, onPress, size = 44, tone = 'ink', badge, disabled, accessibilityLabel, style,
}: IconPillButtonProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = t.colors;
  const looks = {
    ink: { bg: c.pill, fg: c.onPill, border: 'transparent' },
    white: { bg: c.card, fg: c.ink, border: t.isDark ? c.border : 'transparent' },
    hero: { bg: c.hero, fg: c.onHero, border: 'transparent' },
    glass: { bg: 'rgba(255,255,255,0.12)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.24)' },
    soft: { bg: c.neutralSoft, fg: c.ink, border: 'transparent' },
    accent: { bg: c.accent, fg: c.onAccent, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: 'transparent' },
    // Just the glyph — for headers, where a circle behind every icon is clutter.
    plain: { bg: 'transparent', fg: c.ink, border: 'transparent' },
  }[tone];

  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed && !reduced ? 0.94 : 1, opacity: disabled ? 0.5 : 1 }}
          transition={reduced ? { type: 'timing', duration: 0 } : { type: 'spring', ...t.motion.spring }}
          style={[
            {
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: looks.bg, borderWidth: 1, borderColor: looks.border,
              alignItems: 'center', justifyContent: 'center',
            },
            tone === 'ink' || tone === 'white' ? t.shadow.card : null,
            style,
          ]}
        >
          <Icon size={Math.round(size * (tone === 'plain' ? 0.52 : 0.44))} color={looks.fg} strokeWidth={tone === 'plain' ? 2 : 2.2} />
          {badge ? (
            <View style={{
              position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5,
              borderRadius: 10, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: tone === 'glass' ? c.hero : c.ground,
            }}
            >
              <Text variant="caption" color={t.isDark ? t.colors.onAccent : '#FFFFFF'} style={{ letterSpacing: 0 }}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </MotiView>
      )}
    </Pressable>
  );
}

/** A quiet text-only action ("Mark all read", "See all"). */
export function TextButton({ label, onPress, color = 'hero', icon: Icon }: { label: string; onPress?: () => void; color?: string; icon?: LucideIcon }) {
  const t = useTheme();
  const resolved = (t.colors as Record<string, string>)[color] ?? color;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Icon ? <Icon size={15} color={resolved} strokeWidth={2.4} /> : null}
      <Text variant="smallStrong" color={resolved}>{label}</Text>
    </Pressable>
  );
}
