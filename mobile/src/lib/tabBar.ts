import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { create } from 'zustand';

interface TabBarState {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

/** Whether the floating tab bar is tucked away because the user is scrolling down. */
export const useTabBarStore = create<TabBarState>((set) => ({
  hidden: false,
  setHidden: (hidden) => set((s) => {
    if (s.hidden === hidden) return s;
    if (__DEV__) console.log('[tabbar]', hidden ? 'hide' : 'show');
    return { hidden };
  }),
}));

/**
 * Scroll handler for any scrolling tab screen. Direction decides: a few points
 * downward tucks the bar away, a few points upward brings it back, and the top of
 * the page always shows it. Attach with `onScroll={bar.onScroll} scrollEventThrottle={16}`.
 */
export function useAutoHideTabBar() {
  const setHidden = useTabBarStore((s) => s.setHidden);
  const lastY = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    // Clamp so the rubber-band past either end never counts as a direction.
    const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
    const y = Math.max(0, Math.min(contentOffset.y, maxY));
    const dy = y - lastY.current;
    lastY.current = y;
    if (y <= 4) { setHidden(false); return; }
    if (dy > 3) setHidden(true);
    else if (dy < -3) setHidden(false);
  };
  return { onScroll, scrollEventThrottle: 16 as const };
}
