/**
 * AuthContext — production-hardened auth state management.
 *
 * Auth states:
 *   loading=true  → bootstrap in progress, ProtectedRoute shows spinner
 *   loading=false + isAuthenticated=true  → logged in
 *   loading=false + isAuthenticated=false → not logged in, redirect to /login
 *
 * Session persistence:
 *   Primary:   Bearer token in localStorage (fast, synchronous read)
 *   Fallback:  HttpOnly cookie (works when localStorage is blocked by extensions)
 *
 * Redirect-to-login bug fix:
 *   - loading starts true, only becomes false after server check completes
 *   - network errors (5xx, timeout) do NOT clear auth — only genuine 401 does
 *   - if localStorage is blocked but cookie exists, server check succeeds via cookie
 *   - isAuthenticated is set to true if EITHER localStorage token OR server check succeeds
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── Safe localStorage wrapper ────────────────────────────────────────────────
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* blocked — cookie auth still works */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignored */ }
  },
};

// ─── raw fetch helper ─────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = storage.get('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // always send HttpOnly cookie
    ...options,
    headers,
  });

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
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  // Synchronous init — read from localStorage immediately so ProtectedRoute
  // doesn't flash the login page for users who are clearly logged in
  const [user, setUser] = useState(() => {
    try {
      const s = storage.get('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  // isAuthenticated starts true if we have BOTH token AND user in localStorage.
  // This prevents the login flash for users who are clearly authenticated.
  // The server check will correct this if the token is actually expired.
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(storage.get('token') && storage.get('user'))
  );

  // loading=true until the server auth check completes.
  // ProtectedRoute shows a spinner while loading=true.
  // This prevents redirect-to-login before we know the real auth state.
  const [loading, setLoading] = useState(true);

  const timerRef = useRef(null);
  const initDoneRef = useRef(false);

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
  const refreshProfile = useCallback(async (isInitialLoad = false) => {
    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;
      _setAuth(profile);
      // If we authenticated via cookie (no localStorage token), save the token
      if (!storage.get('token') && data.token) {
        storage.set('token', data.token);
      }
      return profile;
    } catch (err) {
      if (err.status === 401) {
        // Genuine 401 — token is invalid/expired
        _clearAuth();
        // On initial load: do NOT redirect here — ProtectedRoute handles it
        // after loading becomes false. This prevents the redirect-to-login bug.
        if (!isInitialLoad) {
          const path = window.location.pathname;
          if (path !== '/login' && path !== '/register' && path !== '/') {
            window.location.href = '/login';
          }
        }
        return null;
      }
      // Network error, 5xx, timeout — do NOT clear auth.
      // The user is probably still logged in; this is a transient failure.
      // Keep existing isAuthenticated state so they stay on the dashboard.
      console.warn('[Auth] refreshProfile network/server error (keeping auth state):', err.message);
      return null;
    }
  }, [_setAuth, _clearAuth]);

  // ── Bootstrap on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Always verify with server — even if localStorage has a token.
      // This handles: expired tokens, cookie-only auth, stale localStorage.
      try {
        await refreshProfile(true);
      } catch {
        // refreshProfile handles all errors internally
      } finally {
        if (!cancelled) {
          setLoading(false);
          initDoneRef.current = true;
        }
      }
    };

    bootstrap();

    // Refresh every 3 minutes to keep session alive
    timerRef.current = setInterval(() => {
      if (initDoneRef.current) refreshProfile(false);
    }, 3 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) storage.set('token', data.token);
    if (data.user) _setAuth(data.user);
    toast.success(`Welcome back, ${data.user?.name || 'User'}!`);
    // Fetch full profile to get all fields (isVerified, isFounderVerified, etc.)
    setTimeout(() => refreshProfile(false), 200);
    return data;
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
    const data = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    if (data.token) storage.set('token', data.token);
    if (data.user) _setAuth(data.user);
    toast.success(`Welcome, ${data.user?.name || 'User'}!`);
    setTimeout(() => refreshProfile(false), 200);
    return data;
  };

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = async (silent = false) => {
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
