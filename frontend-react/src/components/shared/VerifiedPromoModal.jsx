import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import VerifiedBadge from './VerifiedBadge';

/**
 * VerifiedPromoModal — shown once per day on dashboard load for unverified users.
 * Motivates users to get the verified badge via urgency + benefit framing.
 *
 * Display rules:
 * - Never shown to already-verified users (payment-based)
 * - Shown once per calendar day (localStorage key: dolphin_promo_last_shown)
 * - Appears after 1.5s delay so dashboard loads first
 * - Clicking CTA navigates to #settings (where the payment flow is)
 */

const STORAGE_KEY = 'dolphin_promo_last_shown';

function isPaymentVerified(user) {
  return (
    user?.isVerified === true &&
    user?.verifiedSource === 'payment' &&
    !!user?.verifiedUntil &&
    new Date(user.verifiedUntil) > new Date()
  );
}

function shouldShowToday() {
  try {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last) return true;
    const lastDate = new Date(last).toDateString();
    const today    = new Date().toDateString();
    return lastDate !== today;
  } catch {
    return true;
  }
}

function markShownToday() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch {}
}

const BENEFITS = [
  { icon: '✅', title: 'Trust Badge', desc: 'Blue verified tick visible on your profile, posts, and connection cards.' },
  { icon: '🚀', title: 'Boosted Visibility', desc: 'Verified profiles appear higher in investor and provider searches.' },
  { icon: '🤝', title: 'Higher Connect Rate', desc: 'Investors trust verified founders 3× more before sending requests.' },
  { icon: '🔒', title: 'Credibility Signal', desc: 'Stand out from the crowd — signal you are serious and committed.' },
];

export default function VerifiedPromoModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Don't show if already verified
    if (isPaymentVerified(user)) return;
    // Don't show if already shown today
    if (!shouldShowToday()) return;

    const timer = setTimeout(() => {
      markShownToday();
      setOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]);

  const close = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 280);
  };

  const goVerify = () => {
    close();
    // Small delay so modal closes before navigation
    setTimeout(() => { window.location.hash = 'settings'; }, 300);
  };

  if (!open) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          animation: closing ? 'promo-fade-out 0.28s ease forwards' : 'promo-fade-in 0.3s ease',
        }}
      />

      {/* ── Modal ── */}
      <div
        style={{
          position: 'fixed', zIndex: 9991,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 32px))',
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          animation: closing ? 'promo-slide-out 0.28s ease forwards' : 'promo-slide-in 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* ── Hero banner ── */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f4c2a 100%)',
          padding: '2rem 1.75rem 1.5rem',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(132,204,22,0.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', pointerEvents: 'none' }} />

          {/* Close button */}
          <button
            onClick={close}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 30, height: 30,
              cursor: 'pointer', color: 'white', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            ×
          </button>

          {/* Badge icon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 70, height: 70, borderRadius: '50%',
            background: 'linear-gradient(135deg, #84CC16, #16A34A)',
            boxShadow: '0 8px 32px rgba(132,204,22,0.45)',
            marginBottom: '1rem',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 4.8L20 8l-4 3.9L17.6 18 12 15.1 6.4 18 8 11.9 4 8l5.6-1.2z"/>
              <polyline points="9 12 11 14 15 10" strokeWidth="2" />
            </svg>
          </div>

          <h2 style={{ margin: '0 0 0.4rem', color: 'white', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
            Get Your Verified Badge
          </h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Join the top creators on Dolphin. Only <strong style={{ color: '#84CC16' }}>₹99/month</strong> — less than a cup of coffee.
          </p>

          {/* Urgency ribbon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '0.875rem',
            padding: '5px 14px',
            background: 'rgba(239,68,68,0.18)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 9999,
            color: '#FCA5A5',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0, animation: 'promo-pulse 1.4s ease-in-out infinite' }} />
            Limited slots available — claim yours now
          </div>
        </div>

        {/* ── Benefits grid ── */}
        <div style={{ padding: '1.25rem 1.75rem 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {BENEFITS.map(b => (
              <div key={b.title} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.75rem',
                background: '#F9FAFB',
                borderRadius: 12,
                border: '1px solid #E5E7EB',
              }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{b.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#111827', marginBottom: 2 }}>{b.title}</div>
                  <div style={{ fontSize: '0.74rem', color: '#6B7280', lineHeight: 1.45 }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Social proof strip ── */}
        <div style={{
          margin: '1rem 1.75rem 0',
          padding: '0.6rem 0.875rem',
          background: '#F0FDF4',
          borderRadius: 10,
          border: '1px solid #BBF7D0',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          fontSize: '0.8rem', color: '#15803D',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#16A34A" stroke="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span><strong>Verified profiles</strong> get 3× more connection requests and appear in priority slots.</span>
        </div>

        {/* ── CTA section ── */}
        <div style={{ padding: '1.25rem 1.75rem 1.75rem' }}>
          <button
            onClick={goVerify}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #84CC16, #16A34A)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(132,204,22,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(132,204,22,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(132,204,22,0.4)'; }}
          >
            <VerifiedBadge size={18} />
            Get Verified – ₹99/month
          </button>

          <button
            onClick={close}
            style={{
              width: '100%', marginTop: '0.625rem',
              padding: '0.625rem',
              background: 'transparent', border: 'none',
              color: '#9CA3AF', fontSize: '0.82rem',
              cursor: 'pointer', borderRadius: 8,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
            onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
          >
            Maybe later
          </button>
        </div>
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes promo-fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes promo-fade-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes promo-slide-in {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.93) }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
        @keyframes promo-slide-out {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1) }
          to   { opacity: 0; transform: translate(-50%, -46%) scale(0.93) }
        }
        @keyframes promo-pulse {
          0%, 100% { opacity: 1; transform: scale(1) }
          50%       { opacity: 0.5; transform: scale(1.35) }
        }
      `}</style>
    </>
  );
}
