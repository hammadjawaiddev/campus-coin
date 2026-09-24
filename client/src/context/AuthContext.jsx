import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, userApi } from '../services/endpoints';
import { setUnauthorizedHandler, tokenStore } from '../services/api';

const AuthContext = createContext(null);

/**
 * Session state for the whole app.
 * The JWT is persisted in localStorage and re-validated on boot via /auth/me,
 * so a stale or revoked token can never leave the UI in a "logged in" state
 * that the API would reject.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [bootError, setBootError] = useState(null);
  const sessionExpired = useRef(false);

  const persist = useCallback((token, nextUser) => {
    if (token) tokenStore.set(token);
    setUser(nextUser);
    setStatus(nextUser ? 'authenticated' : 'anonymous');
  }, []);

  const refresh = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setStatus('anonymous');
      setUser(null);
      return null;
    }
    try {
      const { data } = await authApi.me();
      setUser(data.user);
      setStatus('authenticated');
      return data.user;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
      } else {
        // Backend unreachable: keep the cached user so the app still renders.
        setBootError(error.message);
        setStatus('anonymous');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    // A single global handler turns any 401 into a clean sign-out.
    setUnauthorizedHandler((error) => {
      if (sessionExpired.current) return;
      sessionExpired.current = true;
      tokenStore.clear();
      setUser(null);
      setStatus('anonymous');
      window.dispatchEvent(new CustomEvent('cc:session-expired', { detail: error }));
      setTimeout(() => { sessionExpired.current = false; }, 3000);
    });
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials);
    persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const register = useCallback(async (payload) => {
    const { data } = await authApi.register(payload);
    persist(data.token, data.user);
    return data.user;
  }, [persist]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* signing out locally is enough even if the call fails */
    }
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const { data } = await userApi.update(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const updatePreferences = useCallback(async (payload) => {
    const { data } = await userApi.updatePreferences(payload);
    setUser(data.user);
    return data.user;
  }, []);

  /** Applied after onboarding / password change responses. */
  const applySession = useCallback((token, nextUser) => persist(token, nextUser), [persist]);

  const value = useMemo(
    () => ({
      user,
      status,
      bootError,
      isAuthenticated: status === 'authenticated',
      isAdmin: user?.role === 'admin',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      refresh,
      updateProfile,
      updatePreferences,
      applySession,
      setUser,
    }),
    [user, status, bootError, login, register, logout, refresh, updateProfile, updatePreferences, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
