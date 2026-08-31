/**
 * Light and dark, chosen by the user.
 *
 * The class lives on <html> rather than on a React root, because the page's own
 * background is painted from `body` before React has rendered anything. It is applied
 * twice: once by a small script in index.html that runs before first paint, and again
 * from here whenever the choice changes — without the first, the app would flash the
 * light theme on every load for anyone who picked dark.
 */
export type Theme = 'light' | 'dark';

const KEY = 'taskr.theme';

/** What the operating system asks for, when the user has expressed no preference. */
export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // Private browsing, or storage disabled. The theme still works for this visit.
    return null;
  }
}

export function currentTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* nothing to do */ }
}
