import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail } from '../shared/Icons';
import DolphinLogo from '../shared/DolphinLogo';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp } = useAuth();

  // If redirected from Login with requiresVerification, start on OTP step
  const locationState = location.state || {};
  const [step, setStep] = useState(locationState.step === 'otp' ? 'otp' : 'register');
  const [formData, setFormData] = useState({
    name: '', email: locationState.email || '', password: '', confirmPassword: '',
    role: 'founder', acceptTerms: false,
  });
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all fields'); return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    if (!formData.acceptTerms) {
      toast.error('Please accept the terms and conditions'); return;
    }
    setIsLoading(true);
    try {
      await authAPI.register(formData.name, formData.email, formData.password, formData.role);
      toast.success('OTP sent to your email!');
      setStep('otp');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) { toast.error('Please enter the OTP'); return; }
    setIsLoading(true);
    try {
      const data = await verifyOtp(formData.email, otp.trim());
      const routes = {
        founder: '/dashboard',
        investor: '/investor-dashboard',
        provider: '/provider-dashboard',
        admin: '/admin-dashboard',
      };
      navigate(routes[data.user?.role] || '/');
    } catch (err) {
      toast.error(err.message || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!formData.email) return;
    setIsLoading(true);
    try {
      await authAPI.resendOtp(formData.email);
      toast.success('New OTP sent to your email!');
      setOtp('');
    } catch (err) {
      toast.error(err.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OTP step ────────────────────────────────────────────────────────────────
  if (step === 'otp') {
    const cameFromLogin = locationState.step === 'otp'; // redirected from login page

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '2.5rem', border: '1px solid var(--border-color)' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Mail size={32} color="#84CC16" />
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Verify your email
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                We sent a 6-digit code to<br />
                <strong style={{ color: 'var(--text-primary)' }}>{formData.email}</strong>
              </p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Check your inbox and spam folder. The code expires in 10 minutes.
              </p>
            </div>

            {/* OTP form */}
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>
                  Enter 6-digit code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="form-input"
                  style={{
                    textAlign: 'center',
                    fontSize: '2rem',
                    letterSpacing: '0.75rem',
                    fontWeight: 700,
                    padding: '0.75rem',
                  }}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length < 6}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}
              >
                {isLoading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              {/* Resend OTP */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading}
                style={{
                  width: '100%', background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', padding: '0.625rem',
                  color: 'var(--text-secondary)', cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem', marginBottom: '0.75rem',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {isLoading ? 'Sending…' : '↺ Resend code'}
              </button>

              {/* Back link */}
              {cameFromLogin ? (
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                    ← Back to login
                  </Link>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('register')}
                  style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  ← Back to registration
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Register step ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: '2.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <DolphinLogo size={52} iconOnly />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Create Account</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Join Dolphin — founders, freelancers, and investors</p>
          </div>

          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required className="form-input" />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required className="form-input" />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">I am a</label>
              <select name="role" value={formData.role} onChange={handleChange} className="form-select">
                <option value="founder">Founder</option>
                <option value="investor">Investor</option>
                <option value="provider">Service Provider / Freelancer</option>
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                  placeholder="Min 8 characters" required className="form-input" style={{ paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Confirm Password</label>
              <input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                placeholder="••••••••" required className="form-input" />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} />
                I accept the{' '}
                <a href="/terms" target="_blank" style={{ color: 'var(--primary)' }}>Terms & Conditions</a>
              </label>
            </div>
            <button type="submit" disabled={isLoading} className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
