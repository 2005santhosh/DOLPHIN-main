import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import VerifiedBadge from './VerifiedBadge';
import VerificationModal from './VerificationModal';
import toast from 'react-hot-toast';

/**
 * VerifiedPromoModal — shown once per day on dashboard load for unverified users.
 *
 * Display rules:
 * - Never shown to already-verified users (payment-based)
 * - Shown once per calendar day (localStorage: dolphin_promo_last_shown)
 * - Appears after 1.5s delay so dashboard loads first
 * - "Get Verified" opens VerificationModal (Cashfree payment) directly
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
    return new Date(last).toDateString() !== new Date().toDateString();
  } catch { return true; }
}

function markShownToday() {
  try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch {}
}

const BENEFITS = [
  { icon: '✅', title: 'Trust Badge',         desc: 'Verified tick on your profile, posts and cards.' },
  { icon: '🚀', title: 'Boosted Visibility',  desc: 'Show up higher in investor & provider searches.' },
  { icon: '🤝', title: '3× More Connections', desc: 'Investors connect with verified profiles first.' },
  { icon: '🔒', title: 'Credibility Signal',  desc: 'Signal you are serious and committed to growth.' },
];

export default function VerifiedPromoModal() {
  const { user, updateUser, refreshProfile } = useAuth();
  const [open, setOpen]               = useState(false);
  const [closing, setClosing]         = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  useEffect(() => {
    if (isPaymentVerified(user)) return;
    if (!shouldShowToday()) return;
    const timer = setTimeout(() => { markShownToday(); setOpen(true); }, 1500);
    return () => clearTimeout(timer);
  }, [user]);

  /* ── smooth close ── */
  const close = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 260);
  };

  /* ── open Cashfree payment modal ── */
  const openPayment = () => {
    close();
    // wait for promo to finish closing before opening payment
    setTimeout(() => setPayModalOpen(true), 320);
  };

  /* ── called by VerificationModal after checkout submitted ── */
  const handlePaymentComplete = (orderId) => {
    setPayModalOpen(false);
    // poll status — reuse the same logic as SettingsPage
    toast.loading('Verifying your payment…', { id: 'promo-verify' });
    pollStatus(orderId);
  };

  const pollStatus = async (orderId) => {
    let activated = false;
    for (let i = 0; i < 8; i++) {
      try {
        const { verificationAPI } = await import('../../services/api');
        const s = orderId
          ? await verificationAPI.refreshStatus(orderId)
          : await verificationAPI.getStatus();
        if (s.isVerified) {
          activated = true;
          if (updateUser && user) {
            updateUser({ ...user, isVerified: true, verifiedSource: 'payment', verifiedUntil: s.verifiedUntil, verifiedAt: s.verifiedAt });
          }
          if (refreshProfile) refreshProfile(false).catch(() => {});
          toast.success('🎉 Your profile is now Verified!', { id: 'promo-verify' });
          break;
        }
        if (['FAILED', 'CANCELLED'].includes(s.orderStatus)) {
          toast.error('Payment failed. Please try again.', { id: 'promo-verify' });
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 4000));
    }
    if (!activated) toast.dismiss('promo-verify');
  };

  if (!open && !payModalOpen) return null;

  return (
    <>
      {/* ────────────────────────────────────────────────
          Promo popup — only rendered while open
      ──────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 9900,
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(3px)',
              animation: closing ? 'pf-out 0.26s ease forwards' : 'pf-in 0.26s ease',
            }}
          />

          {/* Card — strictly sized, never full-height */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Get Verified Badge"
            style={{
              position: 'fixed',
              zIndex: 9901,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              /* width clamps between 300px and 480px with 16px gutter each side */
              width: 'min(480px, calc(100vw - 32px))',
              /* max-height so it never overflows viewport on small phones */
              maxHeight: 'min(680px, calc(100vh - 48px))',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 20px 80px rgba(0,0,0,0.25)',
              /* animation */
              animation: closing
                ? 'ps-out 0.26s ease forwards'
                : 'ps-in 0.30s cubic-bezier(0.34,1.46,0.64,1)',
            }}
          >
            {/* ── Dark hero header ── */}
            <div style={{
              position: 'relative',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0f4c2a 100%)',
              padding: '1.75rem 1.5rem 1.35rem',
              textAlign: 'center',
              flexShrink: 0,
            }}>
              {/* decorative blobs */}
              <div style={{ position: 'absolute', top: -24, right: -24, width: 120, height: 120, borderRadius: '50%', background: 'rgba(132,204,22,0.1)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -16, left: -16, width: 90, height: 90, borderRadius: '50%', background: 'rgba(59,130,246,0.09)', pointerEvents: 'none' }} />

              {/* ✕ close button */}
              <button
                onClick={close}
                aria-label="Close"
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)', border: 'none',
                  color: 'white', fontSize: '1.15rem', lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.24)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                ×
              </button>

              {/* badge icon */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 62, height: 62, borderRadius: '50%',
                background: 'linear-gradient(135deg, #84CC16, #16A34A)',
                boxShadow: '0 6px 28px rgba(132,204,22,0.45)',
                marginBottom: '0.875rem',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.4 4.8L20 8l-4 3.9L17.6 18 12 15.1 6.4 18 8 11.9 4 8l5.6-1.2z"/>
                  <polyline points="9 12 11 14 15 10" strokeWidth="2" />
                </svg>
              </div>

              <h2 style={{ margin: '0 0 0.35rem', color: '#fff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Get Your Verified Badge
              </h2>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.68)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Only <strong style={{ color: '#84CC16' }}>₹99/month</strong> — less than a cup of coffee.
              </p>

              {/* urgency pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: '0.75rem',
                padding: '4px 13px',
                background: 'rgba(239,68,68,0.16)',
                border: '1px solid rgba(239,68,68,0.38)',
                borderRadius: 9999,
                color: '#FCA5A5',
                fontSize: '0.75rem', fontWeight: 700,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#EF4444', flexShrink: 0,
                  animation: 'pp-pulse 1.4s ease-in-out infinite',
                }} />
                Limited slots — claim yours now
              </div>
            </div>

            {/* ── Benefits grid ── */}
            <div style={{ padding: '1.1rem 1.25rem 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                {BENEFITS.map(b => (
                  <div key={b.title} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.65rem 0.7rem',
                    background: '#F9FAFB',
                    borderRadius: 11,
                    border: '1px solid #E5E7EB',
                  }}>
                    <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{b.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#111827', marginBottom: 2 }}>{b.title}</div>
                      <div style={{ fontSize: '0.71rem', color: '#6B7280', lineHeight: 1.4 }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Social proof ── */}
            <div style={{
              margin: '0.875rem 1.25rem 0',
              padding: '0.55rem 0.8rem',
              background: '#F0FDF4', borderRadius: 9, border: '1px solid #BBF7D0',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.77rem', color: '#15803D',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#16A34A"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              <span><strong>Verified profiles</strong> get 3× more connection requests.</span>
            </div>

            {/* ── CTA buttons ── */}
            <div style={{ padding: '1rem 1.25rem 1.4rem' }}>
              {/* Primary — opens payment directly */}
              <button
                onClick={openPayment}
                style={{
                  width: '100%', padding: '0.8rem',
                  background: 'linear-gradient(135deg, #84CC16, #16A34A)',
                  color: 'white', border: 'none', borderRadius: 11,
                  fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                  boxShadow: '0 4px 18px rgba(132,204,22,0.38)',
                  transition: 'transform 0.14s, box-shadow 0.14s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(132,204,22,0.50)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(132,204,22,0.38)'; }}
              >
                <VerifiedBadge size={17} />
                Get Verified – ₹99/month
              </button>

              {/* Dismiss */}
              <button
                onClick={close}
                style={{
                  width: '100%', marginTop: '0.5rem', padding: '0.55rem',
                  background: 'transparent', border: 'none',
                  color: '#9CA3AF', fontSize: '0.8rem',
                  cursor: 'pointer', borderRadius: 8,
                  transition: 'color 0.14s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
                onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
              >
                Maybe later
              </button>
            </div>
          </div>
        </>
      )}

      {/* ────────────────────────────────────────────────
          Cashfree payment modal — mounted separately
          so it renders even after promo closes
      ──────────────────────────────────────────────── */}
      <VerificationModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        userName={user?.name || ''}
        userEmail={user?.email || ''}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes pf-in  { from { opacity:0 } to { opacity:1 } }
        @keyframes pf-out { from { opacity:1 } to { opacity:0 } }
        @keyframes ps-in  {
          from { opacity:0; transform:translate(-50%,-47%) scale(0.92) }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1) }
        }
        @keyframes ps-out {
          from { opacity:1; transform:translate(-50%,-50%) scale(1) }
          to   { opacity:0; transform:translate(-50%,-47%) scale(0.92) }
        }
        @keyframes pp-pulse {
          0%,100% { opacity:1; transform:scale(1) }
          50%     { opacity:0.45; transform:scale(1.4) }
        }
      `}</style>
    </>
  );
}
