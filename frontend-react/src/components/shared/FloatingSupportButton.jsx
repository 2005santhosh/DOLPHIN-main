/**
 * FloatingSupportButton — fixed-position "Having an issue?" button
 * visible on every page in every dashboard and auth flow.
 *
 * On mobile: compact icon-only pill at bottom-left, above the bottom nav.
 * On desktop: text pill at bottom-right corner.
 * Redirects to /support (the existing SupportPage).
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function FloatingSupportButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);

  // Hide on the support page itself to avoid redundancy
  if (location.pathname === '/support') return null;

  const handleClick = () => navigate('/support');

  return (
    <>
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Having an issue? Get support"
        title="Having an issue? Get support"
        className="floating-support-btn"
        style={{
          position: 'fixed',
          zIndex: 9990,
          bottom: 'var(--support-bottom, 24px)',
          right: 'var(--support-right, 20px)',
          left: 'var(--support-left, auto)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: hovered
            ? 'linear-gradient(135deg, #7DBB13, #15803D)'
            : 'linear-gradient(135deg, #84CC16, #16A34A)',
          color: 'white',
          border: 'none',
          borderRadius: 9999,
          padding: '0 14px',
          height: 36,
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: hovered
            ? '0 4px 16px rgba(22,163,74,0.45)'
            : '0 2px 10px rgba(22,163,74,0.3)',
          transition: 'all 0.2s ease',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
        }}
      >
        {/* Question mark icon */}
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="white" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="support-btn-text">Having an issue?</span>
      </button>

      <style>{`
        /* Desktop: bottom-right, full text */
        .floating-support-btn {
          --support-bottom: 24px;
          --support-right: 20px;
          --support-left: auto;
        }

        /* Mobile: bottom-left, above bottom nav (60px) + safe area */
        @media (max-width: 767px) {
          .floating-support-btn {
            --support-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
            --support-right: auto;
            --support-left: 12px;
            height: 32px;
            padding: 0 10px;
            font-size: 0.72rem;
          }
        }

        /* Extra small screens — icon only, very compact */
        @media (max-width: 360px) {
          .support-btn-text {
            display: none;
          }
          .floating-support-btn {
            padding: 0;
            width: 36px;
            justify-content: center;
          }
        }

        /* Ensure it stays above modals with z-index < 9990 */
        @media print {
          .floating-support-btn { display: none !important; }
        }
      `}</style>
    </>
  );
}
