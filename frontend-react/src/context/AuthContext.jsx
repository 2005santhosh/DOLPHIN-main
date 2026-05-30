import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── Safe localStorage wrapper — extensions may block it ─────────────────────
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
  // Attach Bearer token if available (localStorage); cookie is sent automatically via credentials
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // always send HttpOnly cookie — works even if localStorage is blocked
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
  // ── Synchronous init from localStorage (may be null if extension blocks it) ─
  const [user, setUser] = useState(() => {
    try {
      const s = storage.get('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(storage.get('token') && storage.get('user'))
  );

  // KEY FIX: loading = true until we've verified auth with the server.
  // This prevents ProtectedRoute from redirecting to /login before the
  // cookie-based auth check completes (critical for users with localStorage blocked).
  const [loading, setLoading] = useState(true);

  const timerRef = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────
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
  // Verifies auth with the server. Works via:
  //   1. Bearer token from localStorage (normal case)
  //   2. HttpOnly cookie (when localStorage is blocked by extensions)
  // On 401 → clears auth and redirects to login.
  const refreshProfile = useCallback(async (isInitialLoad = false) => {
    const token = storage.get('token');

    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;
      _setAuth(profile);
      if (!token && data.token) {
        storage.set('token', data.token);
      }
      return profile;
    } catch (err) {
      if (err.status === 401) {
        // On initial load: clear auth silently, do NOT redirect
        // The ProtectedRoute will handle the redirect after loading=false
        _clearAuth();
        if (!isInitialLoad &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/register' &&
          window.location.pathname !== '/') {
          window.location.href = '/login';
        }
        return null;
      }
      // Network/5xx errors — keep existing auth state
      console.warn('[Auth] refreshProfile error (ignored):', err.message);
      return null;
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [_setAuth, _clearAuth]);

  // ── on mount: always verify with server before making auth decisions ───────
  useEffect(() => {
    // Always call refreshProfile on mount — even if localStorage is empty.
    // The HttpOnly cookie will authenticate the request if localStorage is blocked.
    refreshProfile(true).finally(() => setLoading(false));

    // Refresh every 2 minutes to keep session fresh
    timerRef.current = setInterval(() => {
      refreshProfile(false);
    }, 120_000);

    return () => clearInterval(timerRef.current);
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
    setTimeout(() => refreshProfile(false), 300);
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
    setTimeout(() => refreshProfile(false), 300);
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
