import { View, type DimensionValue } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion, useTheme } from '@/theme';
import { useIsFocused } from 'expo-router';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}

/** A soft pulsing placeholder in the shape of the thing that is loading. */
export function Skeleton({ width = '100%', height = 16, radius, style }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const shape = [{ width, height, borderRadius: radius ?? t.radius.sm, backgroundColor: t.colors.neutralSoft }, style];
  if (reduced || !focused) return <View style={shape} />;
  return (
    <MotiView
      from={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
      style={shape}
    />
  );
}

/** A card-shaped skeleton: a title line and two body lines. */
export function SkeletonCard({ lines = 2, height }: { lines?: number; height?: number }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.colors.card, borderRadius: t.radius.lg, padding: t.spacing.lg, gap: 12, minHeight: height }, t.shadow.card]}>
      <Skeleton width="55%" height={18} />
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} width={i === lines - 1 ? '70%' : '92%'} height={12} />)}
    </View>
  );
}

export function SkeletonList({ count = 3, lines }: { count?: number; lines?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}
    </View>
  );
}
