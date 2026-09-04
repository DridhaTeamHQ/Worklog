import { View } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion, useTheme } from '@/theme';

interface Props {
  /** 0..1 */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  /** Over the hero: white on translucent white. */
  onHero?: boolean;
}

/** A rounded bar that eases to its value rather than jumping there. */
export function ProgressBar({ value, color, track, height = 8, onHero }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const fill = { height, borderRadius: height / 2, backgroundColor: color ?? (onHero ? '#FFFFFF' : t.colors.hero) };
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track ?? (onHero ? 'rgba(255,255,255,0.25)' : t.colors.neutralSoft), overflow: 'hidden' }}>
      {reduced ? <View style={[fill, { width: `${clamped * 100}%` }]} /> : (
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ type: 'timing', duration: t.motion.slow + 200 }}
          style={fill}
        />
      )}
    </View>
  );
}
