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
 * 6. Proactive token refresh: ~24h before the 30-day JWT expires, a new token
 *    is issued silently so users never hit a hard 401 from expiry.
 * 7. On a 401 from any API call, one token refresh is attempted before giving up.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Token is valid for 30 days. Refresh when ≤ 2 days remaining (28 days after issue).
const TOKEN_REFRESH_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

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

// ─── Decode JWT expiry without verifying signature ────────────────────────────
function getTokenExpiryMs(token) {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

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
  const refreshingRef   = useRef(false); // prevents concurrent token refresh calls

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

  // ── tryRefreshToken ────────────────────────────────────────────────────────
  // Calls POST /auth/refresh-token to get a new JWT. Returns true on success.
  // Uses a guard to prevent multiple simultaneous refresh calls.
  const tryRefreshToken = useCallback(async () => {
    if (refreshingRef.current) return false;
    const token = storage.get('token');
    if (!token) return false;
    refreshingRef.current = true;
    try {
      const data = await apiFetch('/auth/refresh-token', { method: 'POST' });
      if (data?.token) {
        storage.set('token', data.token);
        console.log('[Auth] Token refreshed successfully');
        return true;
      }
      return false;
    } catch (err) {
      // If refresh itself gets 401, the token is truly dead
      if (err.status === 401) return false;
      // Network error — keep existing token, don't clear
      console.warn('[Auth] Token refresh network error:', err.message);
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // ── refreshProfile ─────────────────────────────────────────────────────────
  // mode:
  //   'bootstrap' — initial page load
  //   'background' — periodic keep-alive, attempts token refresh on 401
  //   'force'     — post-login full profile fetch, always updates state
  const refreshProfile = useCallback(async (mode = 'background') => {
    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;

      if (mode === 'force' || !loginActiveRef.current) {
        _setAuth(profile);
      }

      if (!storage.get('token') && data.token) {
        storage.set('token', data.token);
      }

      // Proactive token refresh: if token expires within 2 days, renew it now
      const expiry = getTokenExpiryMs(storage.get('token'));
      if (expiry && (expiry - Date.now()) < TOKEN_REFRESH_THRESHOLD_MS) {
        tryRefreshToken().catch(() => {});
      }

      return profile;
    } catch (err) {
      if (err.status === 401) {
        if (mode === 'background') {
          // Before giving up, try one token refresh
          const refreshed = await tryRefreshToken();
          if (refreshed) {
            // Retry the profile fetch with the new token
            try {
              const retryData = await apiFetch('/auth/profile');
              const retryProfile = retryData.profile || retryData;
              if (!loginActiveRef.current) _setAuth(retryProfile);
              return retryProfile;
            } catch {
              // Refresh succeeded but profile still fails — very unlikely, keep auth
              return null;
            }
          }
          // Refresh failed (token truly expired/blacklisted) — clear silently
          // Don't redirect — let ProtectedRoute handle it on next navigation
          console.warn('[Auth] Token expired and refresh failed — clearing auth silently');
          _clearAuth();
          return null;
        }

        if (mode === 'bootstrap' || mode === 'force') {
          if (!loginActiveRef.current) {
            _clearAuth();
          }
          return null;
        }
      }
      // Network/timeout/5xx — keep existing auth, don't touch state
      if (!err.isTimeout) {
        console.warn('[Auth] refreshProfile non-401 error (keeping auth):', err.message);
      }
      return null;
    }
  }, [_setAuth, _clearAuth, tryRefreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Uses 'background' mode — attempts token refresh on 401 before clearing auth
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

    // Wipe ALL stale data BEFORE the request — handles Chrome account switch corruption
    storage.clearAll();

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Write fresh session data
      if (data.token) storage.set('token', data.token);
      if (data.user) _setAuth(data.user);

      setLoading(false);
      initDoneRef.current = true;

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
      login, register, verifyOtp, logout, updateUser, refreshProfile, tryRefreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
