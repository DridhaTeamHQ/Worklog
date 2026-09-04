import { AccessibilityInfo, Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Whether entrance and ambient animations should run.
 *
 * Off when the phone's accessibility settings ask for reduced motion, and — on the
 * web preview only — when the page is opened with `?nomotion=1`, which is how the
 * screens are checked in environments that do not render animation frames.
 * Press feedback and layout transitions are quick and functional, so they stay.
 */
interface MotionPrefs {
  reduced: boolean;
  setReduced: (reduced: boolean) => void;
}

export const useMotionPrefs = create<MotionPrefs>((set) => ({
  reduced: false,
  setReduced: (reduced) => set({ reduced }),
}));

export function initMotionPrefs() {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && /[?&]nomotion=1/.test(window.location.search)) {
        useMotionPrefs.getState().setReduced(true);
        return () => {};
      }
    } catch { /* not a browser */ }
  }
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => useMotionPrefs.getState().setReduced(Boolean(v)))
    .catch(() => {});
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => useMotionPrefs.getState().setReduced(Boolean(v)));
  return () => sub.remove();
}

export const useReducedMotion = () => useMotionPrefs((s) => s.reduced);
