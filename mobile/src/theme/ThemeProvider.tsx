import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, radius, spacing, type, shadow, motion, fonts, semantics, softOf, type Colors, type ColorName } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: Colors;
  radius: typeof radius;
  spacing: typeof spacing;
  type: typeof type;
  shadow: typeof shadow;
  motion: typeof motion;
  fonts: typeof fonts;
  /** The colour a status/priority/severity/ticket status renders with, and its tint. */
  tone: (group: keyof typeof semantics, value: string) => { color: string; soft: string; name: ColorName };
}

interface ThemeContextValue {
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'taskr.theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves the user's choice (system / light / dark) against the OS, and hands every
 * component the same token object. The choice persists per device; dark is the
 * default. Existing saved preferences, including system, always take precedence.
 */
export function ThemeProvider({ children, initialMode = 'dark' }: { children: ReactNode; initialMode?: ThemeMode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => { if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored); })
      .catch(() => { /* first run, or storage unavailable */ });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => { /* cosmetic */ });
  }, []);

  const theme = useMemo<Theme>(() => {
    const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
    const colors = (isDark ? palette.dark : palette.light) as Colors;
    return {
      mode, isDark, colors, radius, spacing, type, shadow, motion, fonts,
      tone: (group, value) => {
        const table = semantics[group] as Record<string, ColorName>;
        const name = table[value] ?? 'inkMuted';
        return { color: colors[name], soft: colors[softOf[name] ?? 'neutralSoft'], name };
      },
    };
  }, [mode, system]);

  const value = useMemo(() => ({ theme, setMode }), [theme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx.theme;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside a ThemeProvider');
  return { mode: ctx.theme.mode, setMode: ctx.setMode, isDark: ctx.theme.isDark };
}

/**
 * `const styles = useStyles((t) => ({ card: { backgroundColor: t.colors.card } }))`
 * — a StyleSheet built from the current theme and memoised on it.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory]);
}

/** `alpha('#5B7FE8', 0.12)` → 'rgba(91,127,232,0.12)'. */
export function alpha(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}
