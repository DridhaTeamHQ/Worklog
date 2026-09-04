import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Sleek vector loading: an arc that sweeps around a faint ring. Drawn with SVG so it
 * is crisp at any size and takes the accent colour; spun with a calm 900 ms loop.
 */
export function Spinner({ size = 22, color, track = true, stroke }: { size?: number; color?: string; track?: boolean; stroke?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = color ?? t.colors.hero;
  const sw = stroke ?? Math.max(2, Math.round(size / 9));
  const r = (size - sw) / 2;
  const circumference = 2 * Math.PI * r;
  const ring = (
    <Svg width={size} height={size}>
      {track ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={c} strokeOpacity={0.18} strokeWidth={sw} fill="none" /> : null}
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"
        strokeDasharray={`${circumference * 0.28} ${circumference}`}
      />
    </Svg>
  );
  if (reduced) return ring;
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={{ rotate: '360deg' }}
      transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: false }}
      style={{ width: size, height: size }}
    >
      {ring}
    </MotiView>
  );
}

/** Three dots breathing in sequence — for inline "working…" moments. */
export function PulseDots({ color, size = 6 }: { color?: string; size?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = color ?? t.colors.inkMuted;
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.8, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          from={{ opacity: 0.25, scale: 0.8 }}
          animate={reduced ? { opacity: 0.6, scale: 1 } : { opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 520, delay: i * 160, loop: !reduced, repeatReverse: true }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }}
        />
      ))}
    </View>
  );
}

/**
 * A success mark that pops: the circle springs in, then the tick draws itself.
 * Use once, at the moment something is saved — never decoratively.
 */
export function SuccessMark({ size = 56, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const c = color ?? t.colors.success;
  const sw = Math.max(2, Math.round(size / 14));
  const r = (size - sw) / 2;
  return (
    <MotiView
      from={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 180 }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c} strokeWidth={sw} fill={t.colors.successSoft} />
        <Path d={`M ${size * 0.3} ${size * 0.52} L ${size * 0.44} ${size * 0.66} L ${size * 0.71} ${size * 0.37}`} stroke="transparent" fill="none" />
      </Svg>
      <MotiView
        from={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 220, delay: 140 }}
      >
        <Check size={size * 0.46} color={c} strokeWidth={3} />
      </MotiView>
    </MotiView>
  );
}

/** A whole-screen "fetching this" moment: the spinner, centred, with a quiet word. */
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300, delay: 120 }} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 16 }}>
      <Spinner size={34} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="small" color="inkMuted">{label}</Text>
        <PulseDots size={4} />
      </View>
    </MotiView>
  );
}
