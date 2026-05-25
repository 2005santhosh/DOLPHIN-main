import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// ─── API base: use relative path so Vite proxy handles CORS in dev ────────────
// In production (Vercel), VITE_API_URL is set to https://api.dolphinorg.in/api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── raw fetch helper ─────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
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
  // ── Synchronous init from localStorage ────────────────────────────────────
  // This runs BEFORE the first render, so ProtectedRoute sees the correct state immediately.
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(localStorage.getItem('token') && localStorage.getItem('user'))
  );

  // loading is always false — we read synchronously from localStorage
  const [loading] = useState(false);

  const timerRef = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const _setAuth = useCallback((userData) => {
    if (!userData) return;
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const _clearAuth = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('startupData');
  }, []);

  // ── refreshProfile ─────────────────────────────────────────────────────────
  // Updates user data from server. On 401 (expired token) → auto logout.
  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const data = await apiFetch('/auth/profile');
      const profile = data.profile || data;
      _setAuth(profile);
      return profile;
    } catch (err) {
      // 401 = token expired or invalid → force logout
      if (err.status === 401) {
        console.warn('[Auth] Token expired — logging out');
        _clearAuth();
        // Only redirect if currently on a dashboard page
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return null;
      }
      // Other errors (network, 5xx) — keep user logged in with cached data
      console.warn('[Auth] refreshProfile error (ignored):', err.message);
      return null;
    }
  }, [_setAuth, _clearAuth]);

  // ── on mount: refresh profile + streak immediately ────────────────────────
  useEffect(() => {
    if (localStorage.getItem('token')) {
      // Fire immediately — don't wait
      refreshProfile();
    }

    // Refresh every 2 minutes
    timerRef.current = setInterval(() => {
      if (localStorage.getItem('token')) refreshProfile();
    }, 120_000);

    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ──────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) localStorage.setItem('token', data.token);
    if (data.user) _setAuth(data.user);
    toast.success(`Welcome back, ${data.user?.name || 'User'}!`);
    // Fetch full profile right after login to get all fields
    setTimeout(() => refreshProfile(), 300);
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
    if (data.token) localStorage.setItem('token', data.token);
    if (data.user) _setAuth(data.user);
    toast.success(`Welcome, ${data.user?.name || 'User'}!`);
    setTimeout(() => refreshProfile(), 300);
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
