import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { userApi } from '../services/endpoints';

const STORAGE_KEY = 'campus-coin-ui';
const ThemeContext = createContext(null);

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Theme + accessibility preferences (dark mode, font size, reduced motion).
 * Persisted locally for instant boot and synced to the user profile when signed
 * in so the choice follows the student across devices.
 */
export function ThemeProvider({ children }) {
  const { user, isAuthenticated, updatePreferences } = useAuth();
  const [preferences, setPreferences] = useState(() => ({
    theme: 'system',
    fontSize: 'base',
    reducedMotion: false,
    ...readStored(),
  }));

  const applyToDocument = useCallback((next) => {
    const root = document.documentElement;
    const dark = next.theme === 'dark' || (next.theme === 'system' && systemPrefersDark());
    root.classList.toggle('dark', dark);
    root.style.fontSize = next.fontSize === 'sm' ? '15px' : next.fontSize === 'lg' ? '17.5px' : '16px';
    root.classList.toggle('reduce-motion', Boolean(next.reducedMotion));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0B1020' : '#F5F6FB');
  }, []);

  // Local persistence + DOM application.
  useEffect(() => {
    applyToDocument(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, applyToDocument]);

  // Follow the server profile when the user signs in or edits settings.
  useEffect(() => {
    if (!isAuthenticated || !user?.preferences) return;
    const { theme, fontSize, reducedMotion } = user.preferences;
    setPreferences((prev) => {
      const next = { theme: theme || prev.theme, fontSize: fontSize || prev.fontSize, reducedMotion: reducedMotion ?? prev.reducedMotion };
      if (next.theme === prev.theme && next.fontSize === prev.fontSize && next.reducedMotion === prev.reducedMotion) return prev;
      return { ...prev, ...next };
    });
  }, [isAuthenticated, user?.preferences]);

  // Keep 'system' in sync with OS-level changes.
  useEffect(() => {
    if (preferences.theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyToDocument({ ...preferences, theme: 'system' });
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [preferences, applyToDocument]);

  const setPreference = useCallback((key, value, { sync = true } = {}) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      if (sync && isAuthenticated) {
        const serverKey = key === 'fontSize' ? 'fontSize' : key;
        updatePreferences({ [serverKey]: value }).catch(() => {});
      }
      return next;
    });
  }, [isAuthenticated, updatePreferences]);

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setPreference('theme', isDark ? 'light' : 'dark');
  }, [setPreference]);

  const value = useMemo(
    () => ({
      ...preferences,
      isDark: document.documentElement.classList.contains('dark'),
      setPreference,
      toggleTheme,
      setTheme: (theme) => setPreference('theme', theme),
      setFontSize: (fontSize) => setPreference('fontSize', fontSize),
      setReducedMotion: (reducedMotion) => setPreference('reducedMotion', reducedMotion),
    }),
    [preferences, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
};

export { STORAGE_KEY, userApi };
