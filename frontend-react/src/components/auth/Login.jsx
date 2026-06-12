import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from '../shared/Icons';
import DolphinLogo from '../shared/DolphinLogo';

/**
 * Wipes ALL browser storage for this app and reloads the page.
 * Used when users are stuck due to corrupt state (e.g. Chrome account switch).
 */
function hardResetStorage() {
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  // Clear all cookies for this domain
  document.cookie.split(';').forEach(c => {
    document.cookie = c.replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
  });
  window.location.reload();
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      const response = await login(formData.email, formData.password);
      const routes = {
        founder: '/dashboard',
        investor: '/investor-dashboard',
        provider: '/provider-dashboard',
        admin: '/admin-dashboard',
      };
      navigate(routes[response.user?.role] || '/');
    } catch (err) {
      setLoginAttempts(n => n + 1);
      // Email not verified — backend re-sent OTP, redirect to OTP screen
      if (err.data?.requiresVerification || (err.status === 403 && err.message?.includes('not verified'))) {
        toast('A new OTP has been sent to your email. Please verify to continue.', { icon: '📧' });
        navigate('/register', {
          state: { step: 'otp', email: formData.email },
        });
        return;
      }
      toast.error(err.message || 'Login failed. Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '2.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <DolphinLogo size={52} iconOnly />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Welcome Back</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in to your Dolphin account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Email Address</label>
              <input
                type="email" name="email" value={formData.email} onChange={handleChange}
                placeholder="you@example.com" required className="form-input" autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={formData.password}
                  onChange={handleChange} placeholder="••••••••" required className="form-input"
                  style={{ paddingRight: '3rem' }} autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
            </p>
          </form>

          {/* Self-healing panel — shown after 1 failed attempt OR always visible as a fallback */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 10,
              padding: '0.875rem 1rem',
            }}>
              <p style={{ fontSize: '0.8rem', color: '#92400E', margin: '0 0 0.625rem', fontWeight: 600 }}>
                🔧 Having trouble logging in or seeing your data?
              </p>
              <p style={{ fontSize: '0.75rem', color: '#78350F', margin: '0 0 0.625rem', lineHeight: 1.5 }}>
                This can happen if you recently switched browser accounts or cleared cookies. Click below to reset your browser session — you'll need to log in again.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('This will clear all saved data in your browser for Dolphin and reload the page. You will need to log in again. Continue?')) {
                    hardResetStorage();
                  }
                }}
                style={{
                  background: 'none',
                  border: '1px solid #F59E0B',
                  borderRadius: 7,
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#B45309',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF3C7'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                🔄 Clear Browser Session & Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
