import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { useReducedMotion } from '@/theme';

/** Small integer readouts ease from their current value, including live API updates. */
export function useAnimatedNumber(value: number, duration = 850) {
  const target = Number.isFinite(value) ? value : 0;
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const current = useRef(reduced ? target : 0);
  const [shown, setShown] = useState(current.current);

  useEffect(() => {
    if (reduced || !focused || duration <= 0) {
      current.current = target;
      setShown(target);
      return;
    }
    const from = current.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const elapsed = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      current.current = from + (target - from) * eased;
      const next = Math.round(current.current);
      setShown((previous) => previous === next ? previous : next);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced, focused]);

  return reduced || !focused ? target : shown;
}
