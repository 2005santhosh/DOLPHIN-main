/**
 * VerificationModal
 * No AuthContext import. No top-level const that could cause TDZ issues.
 * verificationAPI is called lazily (inside async function) to avoid bundler TDZ.
 */
import { useState } from 'react';
import VerifiedBadge from './VerifiedBadge';
import toast from 'react-hot-toast';

// Call verificationAPI lazily to avoid bundler circular-init issues
async function createPaymentLink(fullName, phone, email) {
  const { verificationAPI } = await import('../../services/api');
  return verificationAPI.createPaymentLink(fullName, phone, email);
}

export default function VerificationModal({ isOpen, onClose, userName = '', userEmail = '' }) {
  const [step, setStep] = useState('benefits');
  const [form, setForm] = useState({ fullName: userName, phone: '', email: userEmail });
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.phone.trim() || !/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, '')))
      e.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setStep('loading');
    try {
      const result = await createPaymentLink(form.fullName.trim(), form.phone.trim(), form.email.trim());
      if (result.link_url) {
        window.location.href = result.link_url;
      } else {
        throw new Error('No payment link received');
      }
    } catch (err) {
      setStep('form');
      if (err.message?.includes('already verified')) {
        toast.success('Your profile is already verified!');
        onClose();
        return;
      }
      toast.error(err.message || 'Failed to create payment link. Please try again.');
    }
  };

  const handleClose = () => { setStep('benefits'); setErrors({}); onClose(); };

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', zIndex: 9999, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100% - 2rem)', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

        {step === 'benefits' && (
          <div>
            <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #166534 100%)', borderRadius: '20px 20px 0 0', padding: '2rem 1.5rem 1.5rem', position: 'relative', textAlign: 'center' }}>
              <button onClick={handleClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #84CC16, #16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 0 0 8px rgba(132,204,22,0.2)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><polyline points="7 12 10.5 15.5 17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ color: 'white', margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800 }}>Get Verified on Dolphin</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', margin: 0, fontSize: '0.9rem' }}>Stand out in the startup ecosystem with a verified badge</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(132,204,22,0.2)', border: '1px solid rgba(132,204,22,0.4)', borderRadius: 9999, padding: '6px 16px', marginTop: '1rem' }}>
                <span style={{ color: '#84CC16', fontWeight: 800, fontSize: '1.25rem' }}>₹99</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>per month · cancel anytime</span>
              </div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '0.75rem' }}>What you get</p>
              <div style={{ borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '1.5rem' }}>
                {[
                  { icon: '✓', text: 'Verified badge beside your profile name' },
                  { icon: '📈', text: 'Increased profile visibility across the platform' },
                  { icon: '🤝', text: 'Higher chances of getting connections & collaborations' },
                  { icon: '⭐', text: 'Priority visibility in posts and networking feed' },
                  { icon: '🏆', text: 'Early supporter recognition in the Dolphin ecosystem' },
                  { icon: '🔒', text: 'Better trust and credibility with investors & providers' },
                ].map((b, i, arr) => (
                  <div key={i} style={{ padding: '0.75rem 1rem', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{b.icon}</span>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>{b.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {['🔐 Secure Payment', '⚡ Instant Activation', '💳 Cashfree Powered'].map(t => (
                  <span key={t} style={{ fontSize: '0.75rem', color: '#6B7280', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 9999, padding: '4px 10px' }}>{t}</span>
                ))}
              </div>
              <button onClick={() => setStep('form')} style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, #84CC16, #16A34A)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(132,204,22,0.35)' }}>
                <VerifiedBadge size={18} /> Get Verified – ₹99
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.75rem' }}>Secure payment via Cashfree · ₹99/month · Cancel anytime</p>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #F3F4F6' }}>
              <button onClick={() => setStep('benefits')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Your Details</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280' }}>We'll send your receipt to these details</p>
              </div>
              <button onClick={handleClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '1px solid #BBF7D0', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><VerifiedBadge size={16} /> Dolphin Verified Badge</div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>Monthly · Renews every 30 days</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#16A34A' }}>₹99</div>
              </div>

              {[
                { key: 'fullName', label: 'Full Name *', type: 'text', placeholder: 'Your full name' },
                { key: 'email', label: 'Email Address *', type: 'email', placeholder: 'your@email.com' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${errors[key] ? '#EF4444' : '#E5E7EB'}`, borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.target.style.borderColor = '#84CC16'; }}
                    onBlur={e => { e.target.style.borderColor = errors[key] ? '#EF4444' : '#E5E7EB'; }}
                  />
                  {errors[key] && <p style={{ color: '#EF4444', fontSize: '0.78rem', margin: '4px 0 0' }}>{errors[key]}</p>}
                </div>
              ))}

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>Phone Number *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ padding: '0.625rem 0.75rem', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', color: '#374151', flexShrink: 0 }}>🇮🇳 +91</div>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile number"
                    style={{ flex: 1, padding: '0.625rem 0.875rem', border: `1.5px solid ${errors.phone ? '#EF4444' : '#E5E7EB'}`, borderRadius: 8, fontSize: '0.9rem', outline: 'none' }}
                    onFocus={e => { e.target.style.borderColor = '#84CC16'; }}
                    onBlur={e => { e.target.style.borderColor = errors.phone ? '#EF4444' : '#E5E7EB'; }}
                  />
                </div>
                {errors.phone && <p style={{ color: '#EF4444', fontSize: '0.78rem', margin: '4px 0 0' }}>{errors.phone}</p>}
              </div>

              <button type="submit" style={{ width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg, #84CC16, #16A34A)', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 16px rgba(132,204,22,0.35)' }}>
                Proceed to Pay ₹99 →
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.75rem', lineHeight: 1.5 }}>🔐 Secured by Cashfree · Your payment info is never stored on our servers</p>
            </form>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #84CC16, #16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', animation: 'vmPulse 1.5s ease-in-out infinite' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polyline points="7 12 10.5 15.5 17 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Creating your payment link…</h3>
            <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>You'll be redirected to the secure Cashfree payment page in a moment.</p>
            <style>{`@keyframes vmPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
          </div>
        )}
      </div>
    </>
  );
}
