import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react-native';
import { MotiView } from 'moti';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from './Text';

/**
 * The big-quiet pairing at the top of a metric screen: a small accent icon, a very
 * large value, its unit in a lighter weight beside it, and one plain sentence under
 * it saying what the number means. Nothing else competes with it.
 */
export function BigNumber({ icon: Icon, value, unit, verdict, delta, color, size = 'lg' }: {
  icon?: LucideIcon;
  /** `md` for list screens, where the number introduces a list rather than owning the page. */
  size?: 'lg' | 'md';
  value: string | number;
  unit?: string;
  /** One sentence, second person: "You are on track. Keep it up." */
  verdict?: string;
  /** A small comparison line: { label: '+1.2 vs last week', tone: 'up' | 'down' | 'flat' }. */
  delta?: { label: string; tone?: 'up' | 'down' | 'flat'; good?: boolean };
  color?: string;
}) {
  const t = useTheme();
  const accent = color ?? t.colors.hero;
  const deltaColor = delta?.good === undefined ? t.colors.inkMuted : delta.good ? t.colors.success : t.colors.danger;
  const DeltaIcon = delta?.tone === 'down' ? TrendingDown : TrendingUp;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {Icon ? <Icon size={size === 'lg' ? 22 : 18} color={accent} strokeWidth={2.4} style={{ marginTop: size === 'lg' ? 6 : 4 }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
          <Text variant={size === 'lg' ? 'hero' : 'heroSm'} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
          {unit ? <Text variant={size === 'lg' ? 'unit' : 'body'} color="inkMuted">{unit}</Text> : null}
        </View>
      </View>
      {verdict ? <Text variant={size === 'lg' ? 'body' : 'small'} color="inkMuted">{verdict}</Text> : null}
      {delta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {delta.tone && delta.tone !== 'flat' ? <DeltaIcon size={14} color={deltaColor} strokeWidth={2.4} /> : null}
          <Text variant="smallStrong" color={deltaColor}>{delta.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The one dark card on a screen: an eyebrow, a bold statement, a line of context,
 * and a single accent arrow that goes somewhere. The reference's "AI suggestion"
 * card, without the stock photo.
 */
export function InsightCard({ eyebrow = 'Suggestion', title, detail, icon: Icon, onPress, children }: {
  eyebrow?: string;
  title: string;
  detail?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const bg = t.isDark ? '#141416' : '#0B0B0C';
  return (
    <Pressable
      onPress={onPress ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed && !reduced ? t.motion.pressScale : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          style={{ backgroundColor: bg, borderRadius: t.radius.xl, padding: t.spacing.xl, overflow: 'hidden', borderWidth: t.isDark ? 1 : 0, borderColor: t.colors.border }}
        >
          {/* A warm glow in the corner so the black card is not a hole in the page. */}
          <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: t.colors.hero, opacity: 0.16 }} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="caption" color="rgba(255,255,255,0.6)">{eyebrow}</Text>
              <Text variant="h2" color="#FFFFFF">{title}</Text>
              {detail ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {Icon ? <Icon size={14} color="rgba(255,255,255,0.7)" strokeWidth={2.2} /> : null}
                  <Text variant="small" color="rgba(255,255,255,0.7)">{detail}</Text>
                </View>
              ) : null}
              {children}
            </View>
            {onPress ? (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.hero, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
                <ArrowUpRight size={22} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            ) : null}
          </View>
        </MotiView>
      )}
    </Pressable>
  );
}

/**
 * "How far along": the percentage, what it is of, and a small half-ring. One card,
 * one figure — the number the original brief's dashboard asked for.
 */
export function ProgressCard({ done, total, label = 'of tasks completed', onPress }: { done: number; total: number; label?: string; onPress?: () => void }) {
  const t = useTheme();
  const value = total > 0 ? done / total : 0;
  const pct = Math.round(value * 100);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={{ backgroundColor: t.colors.card, borderRadius: t.radius.xl, padding: t.spacing.lg, paddingLeft: t.spacing.xl, borderWidth: 1, borderColor: t.colors.hairline, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="stat">{pct}%</Text>
          <Text variant="small" color="inkMuted">{label}</Text>
          <Text variant="caption" color="inkFaint" style={{ marginTop: 6 }}>{total ? `${done} of ${total} done` : 'Nothing assigned yet'}</Text>
        </View>
        <MiniGauge value={value} />
      </View>
    </Pressable>
  );
}

function MiniGauge({ value, size = 104, stroke = 11 }: { value: number; size?: number; stroke?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const cy = r + stroke / 2;
  const len = Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const d = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`;
  return (
    <MotiView from={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 400 }} style={{ width: size, height: cy + stroke / 2 }}>
      <Svg width={size} height={cy + stroke / 2}>
        <Path d={d} stroke={t.colors.cardAlt} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <Path d={d} stroke={t.colors.hero} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len * v} ${len}`} />
      </Svg>
    </MotiView>
  );
}

/** A circular top-bar button: hairline ring, glyph only. Back, settings, more. */
export function CircleButton({ icon: Icon, onPress, accessibilityLabel, size = 42, filled }: { icon: LucideIcon; onPress?: () => void; accessibilityLabel: string; size?: number; filled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress ? () => { Haptics.selectionAsync().catch(() => {}); onPress(); } : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? t.colors.pill : pressed ? t.colors.cardAlt : t.colors.card,
        borderWidth: filled ? 0 : 1, borderColor: t.colors.border,
      })}
    >
      <Icon size={Math.round(size * 0.46)} color={filled ? t.colors.onPill : t.colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * One of the two big cards on a home screen: an icon, a title, one line, an arrow.
 * The original brief's "Tasks Done" / "Tasks Assigned" cards, in this language.
 */
export function LaunchCard({ icon: Icon, title, line, tone = 'muted', onPress, compact }: {
  icon: LucideIcon;
  title: string;
  line: string;
  /** `accent` colours the line — for "not written yet". */
  tone?: 'muted' | 'accent';
  onPress: () => void;
  /** Half-width, for two side by side. */
  compact?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} accessibilityRole="button" accessibilityLabel={title} style={compact ? { flex: 1 } : undefined}>
      {({ pressed }) => (
        <MotiView
          animate={{ scale: pressed && !reduced ? t.motion.pressScale : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          style={{ backgroundColor: t.colors.card, borderRadius: t.radius.xl, padding: compact ? t.spacing.lg : t.spacing.xl, borderWidth: 1, borderColor: t.colors.hairline, minHeight: compact ? 124 : 132, justifyContent: 'space-between', flex: compact ? 1 : undefined }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: compact ? 38 : 44, height: compact ? 38 : 44, borderRadius: 22, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={compact ? 18 : 21} color={t.colors.hero} strokeWidth={2.2} />
            </View>
            <ArrowUpRight size={18} color={t.colors.inkFaint} strokeWidth={2.2} />
          </View>
          <View style={{ marginTop: compact ? 14 : 18, gap: 2 }}>
            <Text variant={compact ? 'bodyStrong' : 'h3'}>{title}</Text>
            <Text variant="small" color={tone === 'accent' ? 'hero' : 'inkMuted'} numberOfLines={2}>{line}</Text>
          </View>
        </MotiView>
      )}
    </Pressable>
  );
}
