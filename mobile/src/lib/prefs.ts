import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-device preferences that are not server state: whether the onboarding screen
 * has been seen, and how the push permission prompt has been answered. Small, and
 * persisted as one JSON blob.
 */
interface Prefs {
  loaded: boolean;
  onboardingSeen: boolean;
  pushPermission: 'unknown' | 'granted' | 'denied';
  /** ISO timestamp until which the "turn on notifications" card stays hidden. */
  pushPromptSnoozedUntil: string | null;
  lastTab: string | null;

  load: () => Promise<void>;
  set: (patch: Partial<Omit<Prefs, 'load' | 'set' | 'loaded'>>) => void;
}

const KEY = 'taskr.prefs';

export const usePrefs = create<Prefs>((set, get) => ({
  loaded: false,
  onboardingSeen: false,
  pushPermission: 'unknown',
  pushPromptSnoozedUntil: null,
  lastTab: null,

  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ ...(JSON.parse(raw) as Partial<Prefs>), loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  set(patch) {
    set(patch);
    const { onboardingSeen, pushPermission, pushPromptSnoozedUntil, lastTab } = { ...get(), ...patch };
    AsyncStorage.setItem(KEY, JSON.stringify({ onboardingSeen, pushPermission, pushPromptSnoozedUntil, lastTab }))
      .catch(() => { /* cosmetic */ });
  },
}));
