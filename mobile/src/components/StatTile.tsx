import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { BentoCard, type CardTone } from './BentoCard';
import { Text } from './Text';
import { Sparkline, MiniBars } from './Charts';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface TileProps {
  icon?: LucideIcon;
  label: string;
  value: number | string;
  unit?: string;
  /** A small red numeric badge (tasks overdue, critical tickets…). */
  badge?: number;
  trend?: number[];
  bars?: number[];
  tone?: CardTone;
  /** Colour for the chart; the number itself stays ink. */
  color?: string;
  onPress?: () => void;
  compact?: boolean;
}

/**
 * One number, one word, on a card. A small muted icon at the top if given; the
 * number carries the weight. Optional sparkline underneath.
 */
export function StatTile({ icon: Icon, label, value, unit, badge, trend, bars, tone = 'card', color, onPress, compact }: TileProps) {
  const t = useTheme();
  const onDark = tone === 'hero';
  const numeric = typeof value === 'number';
  const counted = useAnimatedNumber(numeric ? value : 0);
  const fg = onDark ? '#FFFFFF' : 'ink';
  const muted = onDark ? 'onHeroMuted' : 'inkMuted';
  const accent = color ?? (onDark ? '#FFFFFF' : t.colors.hero);

  return (
    <BentoCard tone={tone} onPress={onPress} padding={t.spacing.lg} style={{ flex: 1, minHeight: compact ? 96 : 120, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {Icon ? <Icon size={16} color={onDark ? 'rgba(255,255,255,0.8)' : t.colors.inkFaint} strokeWidth={2} /> : <View />}
        {badge ? (
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" color="#FFFFFF" style={{ fontFamily: t.fonts.semibold }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: compact ? 10 : 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant={compact ? 'h1' : 'stat'} color={fg}>{numeric ? counted : value}</Text>
          {unit ? <Text variant="small" color={muted}>{unit}</Text> : null}
        </View>
        <Text variant="small" color={muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </View>
      {trend && trend.length > 1 ? <View style={{ marginTop: 12 }}><Sparkline data={trend} color={accent} height={36} /></View> : null}
      {bars && bars.length ? <View style={{ marginTop: 12 }}><MiniBars data={bars.map((v) => ({ value: v }))} color={accent} height={32} /></View> : null}
    </BentoCard>
  );
}

export interface StatItem {
  label: string;
  value: number | string;
  /** Colour the number when it deserves attention (overdue in red, say). */
  color?: string;
  onPress?: () => void;
}

/**
 * Several numbers side by side in one card, separated by hairlines — the calm
 * alternative to a grid of tiles when the figures belong together.
 */
export function StatRow({ items, tone = 'card' }: { items: StatItem[]; tone?: CardTone }) {
  const t = useTheme();
  const onDark = tone === 'hero' || tone === 'glass';
  return (
    <BentoCard tone={tone} padding={0}>
      <View style={{ flexDirection: 'row' }}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            disabled={!item.onPress}
            style={({ pressed }) => ({
              flex: 1, paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.sm, alignItems: 'center', gap: 2,
              borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: onDark ? 'rgba(255,255,255,0.18)' : t.colors.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="h1" color={item.color ?? (onDark ? '#FFFFFF' : 'ink')} numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
            <Text variant="caption" color={onDark ? 'onHeroMuted' : 'inkMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </BentoCard>
  );
}
