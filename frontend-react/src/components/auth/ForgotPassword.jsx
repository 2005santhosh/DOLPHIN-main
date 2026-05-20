import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { KeyRound, CheckCircle2 } from '../shared/Icons';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Please enter your email address'); return; }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
      toast.success('Reset link sent! Check your inbox.');
    } catch (err) {
      // Backend always returns 200 for security (even if email not found)
      // so we treat any response as success to avoid user enumeration
      setSent(true);
      toast.success('If that email exists, a reset link has been sent.');
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
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <KeyRound size={40} color="var(--primary, #84CC16)" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '0.5rem' }}>
              Forgot Password?
            </h1>
            <p style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '0.9rem' }}>
              No worries — we'll send you a reset link.
            </p>
          </div>

          {sent ? (
            /* Success state */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#D1FAE5', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 1.25rem',
              }}>
                <CheckCircle2 size={32} color="#059669" />
              </div>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary, #111827)', marginBottom: '0.5rem' }}>
                Check your email
              </h3>
              <p style={{ color: 'var(--text-secondary, #6B7280)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                We sent a password reset link to <strong>{email}</strong>.
                The link expires in <strong>10 minutes</strong>.
              </p>
              <p style={{ color: 'var(--text-tertiary, #9CA3AF)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary, #84CC16)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', padding: 0 }}
                >
                  try again
                </button>.
              </p>
              <Link
                to="/login"
                style={{
                  display: 'block', textAlign: 'center', padding: '0.75rem',
                  background: 'var(--primary, #84CC16)', color: 'white',
                  borderRadius: 'var(--radius-md, 10px)', textDecoration: 'none',
                  fontWeight: 600, fontSize: '0.95rem',
                }}
              >
                Back to Login
              </Link>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #374151)', marginBottom: '0.5rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="form-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <Link
                to="/login"
                style={{
                  display: 'block', textAlign: 'center',
                  fontSize: '0.875rem', color: 'var(--text-secondary, #6B7280)',
                  textDecoration: 'none',
                }}
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
