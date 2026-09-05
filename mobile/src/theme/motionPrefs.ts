import { AccessibilityInfo, Platform } from 'react-native';
import { create } from 'zustand';

/**
 * Whether entrance and ambient animations should run.
 *
 * Off when the phone's accessibility settings ask for reduced motion, and — on the
 * web preview only — when the page is opened with `?nomotion=1`, which is how the
 * screens are checked in environments that do not render animation frames.
 * Reduced motion removes spatial movement and looping effects; controls stay usable.
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
      if (typeof window !== 'undefined' && window.matchMedia) {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => useMotionPrefs.getState().setReduced(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
      }
    } catch { /* not a browser */ }
  }
  let disposed = false;
  let changed = false;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => { if (!disposed && !changed) useMotionPrefs.getState().setReduced(Boolean(v)); })
    .catch(() => {});
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
    changed = true;
    useMotionPrefs.getState().setReduced(Boolean(v));
  });
  return () => { disposed = true; sub.remove(); };
}

export const useReducedMotion = () => useMotionPrefs((s) => s.reduced);
