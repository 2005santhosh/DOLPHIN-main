/**
 * AuthContext — production-hardened auth state management.
 *
 * ── Key fixes in this version ──────────────────────────────────────────────
 * 1. login() immediately sets loading=false after success so ProtectedRoute
 *    never blocks navigation with a stale loading=true spinner.
 * 2. Removed the 200ms setTimeout before refreshProfile after login/verifyOtp.
 *    The profile fetch now happens synchronously in the background AFTER
 *    navigation — it no longer races with ProtectedRoute's auth check.
 * 3. Bootstrap no longer clears auth on network errors — only genuine 401.
 * 4. Token stored in sessionStorage as BACKUP for extensions that block
 *    localStorage (e.g. privacy extensions, Safari ITP in private mode).
 *    Priority: localStorage → sessionStorage → cookie.
 * 5. apiFetch now has a 12s timeout — prevents hanging indefinitely.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── Safe storage wrapper — localStorage with sessionStorage fallback ────────
// Handles: localStorage blocked by extensions, Safari ITP, private browsing.
const storage = {
  get(key) {
    try {
      const ls = localStorage.getItem(key);
      if (ls !== null) return ls;
    } catch { /* blocked */ }
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    let lsOk = false;
    try { localStorage.setItem(key, value); lsOk = true; } catch { /* blocked */ }
    // Always mirror to sessionStorage as backup
    try { sessionStorage.setItem(key, value); } catch { /* blocked */ }
    return lsOk;
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignored */ }
    try { sessionStorage.removeItem(key); } catch { /* ignored */ }
  },
};

// ─── apiFetch with timeout ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = storage.get('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000); // 12s max

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      signal: controller.signal,
      ...options,
      headers,
    });
    clearTimeout(timer);

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (!res.ok) {
      const err = new Error(data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Request timed out. Check your connection.');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const s = storage.get('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(storage.get('token') && storage.get('user'))
  );

  // loading=true until the initial server check completes.
  // If we already have a token+user in storage, start as false to prevent
  // the login flash — the server check will correct if the token is expired.
  const [loading, setLoading] = useState(
    () => !(storage.get('token') && storage.get('user'))
  );

  const timerRef   = useRef(null);
  const initDoneRef = useRef(false);
  // Track whether we're in the middle of an explicit login/verifyOtp call
  // so that a concurrent bootstrap doesn't override isAuthenticated.
  const loginInProgressRef = useRef(false);

  const _setAuth = useCallback((userData) => {
    if (!userData) return;
    setUser(userData);
    setIsAuthenticated(true);
    storage.set('user', JSON.stringify(userData));
  }, []);

  const _clearAuth = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    storage.remove('user');
    storage.remove('token');
    storage.remove('startupData');
  }, []);

  // ── refreshProfile ─────────────────────────────────────────────────────────
  // forceUpdate: bypass the loginInProgressRef guard — used by the post-login
  // background refresh to guarantee the full profile overwrites the minimal
  // login response stored in localStorage.
  const refreshProfile = useCallback(async (isInitialLoad = false, forceUpdate = false) => {
    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;

      // Always update when forceUpdate=true (post-login full profile fetch).
      // Otherwise skip if a login is actively in progress (bootstrap race guard).
      if (forceUpdate || !loginInProgressRef.current) {
        _setAuth(profile);
      }

      // If authenticated via cookie (no localStorage token), persist token
      if (!storage.get('token') && data.token) {
        storage.set('token', data.token);
      }
      return profile;
    } catch (err) {
      if (err.status === 401) {
        // Only clear auth if no login is in progress
        if (!loginInProgressRef.current) {
          _clearAuth();
          if (!isInitialLoad) {
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/register' && path !== '/') {
              window.location.href = '/login';
            }
          }
        }
        return null;
      }
      // Network error / timeout / 5xx — keep existing auth state
      console.warn('[Auth] refreshProfile error (keeping auth state):', err.message);
      return null;
    }
  }, [_setAuth, _clearAuth]);

  // ── Bootstrap on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // If we already have valid-looking credentials in storage, mark loading
      // done immediately so ProtectedRoute doesn't flash a spinner.
      // The server check below will validate and correct if needed.
      const hasStoredCreds = !!(storage.get('token') && storage.get('user'));
      if (hasStoredCreds) {
        setLoading(false);
        initDoneRef.current = true;
      }

      try {
        await refreshProfile(true);
      } catch {
        // handled inside refreshProfile
      } finally {
        if (!cancelled) {
          setLoading(false);
          initDoneRef.current = true;
        }
      }
    };

    bootstrap();

    // Keep session alive — refresh every 4 minutes
    timerRef.current = setInterval(() => {
      if (initDoneRef.current && !loginInProgressRef.current) {
        refreshProfile(false);
      }
    }, 4 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    loginInProgressRef.current = true;
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Persist token FIRST before setting auth state
      if (data.token) storage.set('token', data.token);
      if (data.user) _setAuth(data.user);

      // Immediately clear loading — ProtectedRoute must not block navigation
      setLoading(false);
      initDoneRef.current = true;

      toast.success(`Welcome back, ${data.user?.name || 'User'}!`);

      // Fetch full profile in background AFTER navigation completes.
      // Use requestIdleCallback so it runs after paint — doesn't block navigation.
      // NOTE: loginInProgressRef stays true until this completes, then is cleared.
      // We pass a flag to refreshProfile to allow it to update even while loginInProgress.
      const doProfileRefresh = () => refreshProfile(false, true).finally(() => {
        loginInProgressRef.current = false;
      });
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doProfileRefresh, { timeout: 3000 });
      } else {
        setTimeout(doProfileRefresh, 500);
      }

      return data;
    } catch (err) {
      loginInProgressRef.current = false;
      throw err;
    }
  };

  // ── register ───────────────────────────────────────────────────────────────
  const register = async (name, email, password, role) => {
    return await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  };

  // ── verifyOtp ──────────────────────────────────────────────────────────────
  const verifyOtp = async (email, otp) => {
    loginInProgressRef.current = true;
    try {
      const data = await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });

      if (data.token) storage.set('token', data.token);
      if (data.user) _setAuth(data.user);

      // Immediately clear loading — same fix as login
      setLoading(false);
      initDoneRef.current = true;

      toast.success(`Welcome, ${data.user?.name || 'User'}!`);

      const doProfileRefresh = () => refreshProfile(false, true).finally(() => {
        loginInProgressRef.current = false;
      });
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doProfileRefresh, { timeout: 3000 });
      } else {
        setTimeout(doProfileRefresh, 500);
      }

      return data;
    } catch (err) {
      loginInProgressRef.current = false;
      throw err;
    }
  };

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = async (silent = false) => {
    loginInProgressRef.current = false;
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    _clearAuth();
    if (!silent) toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  // ── updateUser ─────────────────────────────────────────────────────────────
  const updateUser = useCallback((u) => { _setAuth(u); }, [_setAuth]);

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated,
      login, register, verifyOtp, logout, updateUser, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
