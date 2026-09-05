import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion, useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  /** Position in a list, for a gentle stagger. */
  index?: number;
  /** Base delay in ms before the stagger. */
  delay?: number;
  from?: 'up' | 'down' | 'none';
  style?: ViewStyle;
}

/**
 * A calm entrance: fade in and settle up by a few points. Lists pass their index so
 * cards arrive one after another rather than all at once.
 */
export function Reveal({ children, index = 0, delay = 0, from = 'up', style }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const offset = from === 'none' ? 0 : from === 'up' ? 14 : -14;
  return (
    <MotiView
      from={{ opacity: reduced ? 1 : 0, translateY: reduced ? 0 : offset }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: reduced ? 0 : t.motion.slow, delay: reduced ? 0 : delay + Math.min(index, 8) * 45 }}
      style={style}
    >
      {children}
    </MotiView>
  );
}
