import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, AlertTriangle, CheckCircle2 } from '../shared/Icons';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // If no token in URL, show error immediately
  const hasToken = !!token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) { toast.error('Please fill in all fields'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Reset failed');
      }

      // Backend returns token + user on success — store them
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

      setDone(true);
      toast.success('Password reset successfully!');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        const routes = {
          founder: '/dashboard',
          investor: '/investor-dashboard',
          provider: '/provider-dashboard',
          admin: '/admin-dashboard',
        };
        navigate(routes[data.user?.role] || '/login');
      }, 2000);
    } catch (err) {
      toast.error(err.message || 'Reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg, #F8FAFC)', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{
          background: 'var(--bg-surface, white)',
          borderRadius: 'var(--radius-lg, 16px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          padding: '2.5rem',
          border: '1px solid var(--border-color, #E5E7EB)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <Lock size={40} color="var(--primary, #84CC16)" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '0.5rem' }}>
              Reset Password
            </h1>
            <p style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '0.9rem' }}>
              Enter your new password below.
            </p>
          </div>

          {!hasToken ? (
            /* No token */
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <AlertTriangle size={48} color="#D97706" />
              </div>
              <p style={{ color: 'var(--text-secondary, #6B7280)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Invalid or missing reset token. Please request a new password reset link.
              </p>
              <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                Request New Link
              </Link>
            </div>
          ) : done ? (
            /* Success */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#D1FAE5', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 1.25rem',
              }}>
                <CheckCircle2 size={32} color="#059669" />
              </div>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '0.5rem' }}>
                Password Updated!
              </h3>
              <p style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Redirecting you to your dashboard…
              </p>
              <div className="spinner" style={{ width: '2rem', height: '2rem', margin: '0 auto' }} />
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #374151)', marginBottom: '0.5rem' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    autoFocus
                    className="form-input"
                    style={{ width: '100%', paddingRight: '3rem', boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary, #9CA3AF)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #374151)', marginBottom: '0.5rem' }}>
                  Confirm New Password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Password strength hint */}
              {password.length > 0 && (
                <div style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 9999,
                        background: password.length >= i * 3 ? (password.length >= 10 ? '#10B981' : '#F59E0B') : '#E5E7EB',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  <span style={{ color: password.length >= 10 ? '#059669' : password.length >= 6 ? '#D97706' : '#DC2626' }}>
                    {password.length < 6 ? 'Too short' : password.length < 10 ? 'Fair' : 'Strong'}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>

              <Link
                to="/login"
                style={{ display: 'block', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary, #6B7280)', textDecoration: 'none' }}
              >
                ← Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
