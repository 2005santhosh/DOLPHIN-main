/**
 * AuthContext — production-hardened auth state management.
 *
 * Key design decisions:
 * 1. Login immediately sets auth state from the login response (no waiting).
 * 2. Background profile refresh runs after login to fetch full profile fields.
 * 3. The 4-minute keep-alive interval NEVER redirects to login on error —
 *    only explicit navigation to a protected page (ProtectedRoute) does.
 * 4. Auto-logout only happens on a deliberate explicit action (logout button)
 *    or when the user manually navigates while unauthenticated.
 * 5. Token stored in both localStorage and sessionStorage for resilience.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── Safe storage wrapper ─────────────────────────────────────────────────────
const storage = {
  get(key) {
    try { const ls = localStorage.getItem(key); if (ls !== null) return ls; } catch { /* blocked */ }
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* blocked */ }
    try { sessionStorage.setItem(key, value); } catch { /* blocked */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignored */ }
    try { sessionStorage.removeItem(key); } catch { /* ignored */ }
  },
  // Parse JSON from storage safely — returns null on corrupt/missing data
  getParsed(key) {
    try {
      const raw = storage.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Sanity check: user object must have at minimum _id and role
      if (key === 'user' && (!parsed?._id || !parsed?.role)) return null;
      return parsed;
    } catch {
      // Corrupt JSON — remove it to prevent future parse errors
      storage.remove(key);
      return null;
    }
  },
  // Wipe all Dolphin auth keys — used before writing fresh login data
  clearAll() {
    ['token', 'user', 'startupData'].forEach(k => storage.remove(k));
  },
};

// ─── apiFetch with timeout ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = storage.get('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000); // 15s

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
      const e = new Error('Request timed out');
      e.isTimeout = true;
      throw e;
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
    // Use getParsed which validates the user object structure
    // If the stored user is corrupt/incomplete, returns null cleanly
    return storage.getParsed('user');
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(storage.get('token') && storage.getParsed('user'))
  );

  const [loading, setLoading] = useState(
    () => !(storage.get('token') && storage.getParsed('user'))
  );

  const timerRef        = useRef(null);
  const initDoneRef     = useRef(false);
  const loginActiveRef  = useRef(false); // true while explicit login/verifyOtp in flight
  // Tracks consecutive 401s from background refresh — only clear after 3 in a row
  // to avoid a single transient failure logging the user out
  const consecutive401Ref = useRef(0);

  const _setAuth = useCallback((userData) => {
    if (!userData) return;
    setUser(userData);
    setIsAuthenticated(true);
    storage.set('user', JSON.stringify(userData));
    consecutiveRef401Reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const consecutiveRef401Reset = () => { consecutive401Ref.current = 0; };

  const _clearAuth = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    storage.remove('user');
    storage.remove('token');
    storage.remove('startupData');
  }, []);

  // ── refreshProfile ─────────────────────────────────────────────────────────
  // mode:
  //   'bootstrap' — initial page load, can redirect on 401 after retries
  //   'background' — periodic keep-alive, NEVER redirects (avoids spurious logout)
  //   'force'     — post-login full profile fetch, always updates state
  const refreshProfile = useCallback(async (mode = 'background') => {
    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;

      // Always update for 'force' mode (post-login)
      // For 'bootstrap' and 'background': only update if not in the middle of login
      if (mode === 'force' || !loginActiveRef.current) {
        _setAuth(profile);
      }

      if (!storage.get('token') && data.token) {
        storage.set('token', data.token);
      }
      consecutiveRef401Reset();
      return profile;
    } catch (err) {
      if (err.status === 401) {
        if (mode === 'force' || mode === 'bootstrap') {
          // On bootstrap: first 401 → just clear auth quietly, ProtectedRoute handles redirect
          if (!loginActiveRef.current) {
            _clearAuth();
          }
          return null;
        }

        // background mode: track consecutive 401s
        consecutive401Ref.current += 1;
        console.warn(`[Auth] Background refresh 401 (${consecutive401Ref.current}/3)`);

        if (consecutive401Ref.current >= 3) {
          // 3 consecutive 401s in background — token is genuinely expired
          // Clear auth but DON'T redirect — let ProtectedRoute handle it on next navigation
          console.warn('[Auth] 3 consecutive 401s — clearing auth state silently');
          _clearAuth();
          consecutive401Ref.current = 0;
        }
        return null;
      }
      // Network/timeout/5xx — keep existing auth, don't touch state
      if (!err.isTimeout) {
        console.warn('[Auth] refreshProfile non-401 error (keeping auth):', err.message);
      }
      return null;
    }
  }, [_setAuth, _clearAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Storage integrity check: if token exists but user is missing/corrupt,
      // clear both and start fresh (handles Chrome account switch corruption)
      const token = storage.get('token');
      const userParsed = storage.getParsed('user');
      if (token && !userParsed) {
        // Token present but user object is missing or corrupt
        // Don't wipe the token — the server will validate it during profile fetch
        storage.remove('user');
      }

      const hasStored = !!(token && userParsed);
      if (hasStored) {
        setLoading(false);
        initDoneRef.current = true;
      }

      try {
        await refreshProfile('bootstrap');
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

    // Background keep-alive every 5 minutes
    // Uses 'background' mode — NEVER logs user out on transient failure
    timerRef.current = setInterval(() => {
      if (initDoneRef.current && !loginActiveRef.current) {
        refreshProfile('background');
      }
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    loginActiveRef.current = true;
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Clear any stale/corrupt data from previous sessions or Chrome account switches
      // BEFORE writing new data — ensures clean state
      storage.clearAll();

      if (data.token) storage.set('token', data.token);
      if (data.user) _setAuth(data.user);

      setLoading(false);
      initDoneRef.current = true;
      consecutiveRef401Reset();

      toast.success(`Welcome back, ${data.user?.name || 'User'}!`);

      // Fetch full profile after navigation — 'force' bypasses the loginActive guard
      const doFullRefresh = () => refreshProfile('force').finally(() => {
        loginActiveRef.current = false;
      });
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doFullRefresh, { timeout: 4000 });
      } else {
        setTimeout(doFullRefresh, 600);
      }

      return data;
    } catch (err) {
      loginActiveRef.current = false;
      throw err;
    }
  };

  // ── register ─────────────────────────────────────────────────────────────
  const register = async (name, email, password, role) => {
    return await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  };

  // ── verifyOtp ─────────────────────────────────────────────────────────────
  const verifyOtp = async (email, otp) => {
    loginActiveRef.current = true;
    try {
      const data = await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });

      // Clear any stale storage before writing new session data
      storage.clearAll();

      if (data.token) storage.set('token', data.token);
      if (data.user) _setAuth(data.user);

      setLoading(false);
      initDoneRef.current = true;
      consecutiveRef401Reset();

      toast.success(`Welcome, ${data.user?.name || 'User'}!`);

      const doFullRefresh = () => refreshProfile('force').finally(() => {
        loginActiveRef.current = false;
      });
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doFullRefresh, { timeout: 4000 });
      } else {
        setTimeout(doFullRefresh, 600);
      }

      return data;
    } catch (err) {
      loginActiveRef.current = false;
      throw err;
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = async (silent = false) => {
    loginActiveRef.current = false;
    consecutiveRef401Reset();
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    _clearAuth();
    if (!silent) toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  // ── updateUser ────────────────────────────────────────────────────────────
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
