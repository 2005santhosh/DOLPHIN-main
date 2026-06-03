/**
 * AppUpdateBanner — detects a new deployment during an active session.
 *
 * How it works:
 *   Every 5 minutes it fetches /version.json (a tiny file Vite generates).
 *   If the version in that file differs from the version baked into the current
 *   bundle (import.meta.env.VITE_APP_VERSION), a new deploy has happened.
 *   It then shows a non-intrusive banner prompting the user to reload.
 *
 * Why this is the correct approach:
 *   - No service worker needed
 *   - No aggressive polling (5-minute interval)
 *   - User is in control — they decide when to reload
 *   - Works on Vercel (index.html is always fresh because of no-cache headers,
 *     but JS bundles are still the old hashed ones until the user reloads)
 *
 * /version.json is generated automatically by the Vite plugin below.
 * It contains: { "version": "2026-06-03-14-35-abc12" }
 */

import { useState, useEffect, useRef } from 'react';

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export default function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const intervalRef = useRef(null);

  const checkForUpdate = async () => {
    // Don't check in dev — version.json doesn't exist in dev mode
    if (import.meta.env.DEV) return;

    try {
      // Add cache-busting param so the browser doesn't serve a stale version.json
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== CURRENT_VERSION) {
        setUpdateAvailable(true);
        // Stop checking once we know an update is available
        clearInterval(intervalRef.current);
      }
    } catch {
      // Silently ignore network errors — don't spam console
    }
  };

  useEffect(() => {
    // First check after 30s (give the page time to load fully)
    const initialTimer = setTimeout(() => {
      checkForUpdate();
      intervalRef.current = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    }, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!updateAvailable) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)', // above bottom nav on mobile
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        background: '#0F172A',
        color: 'white',
        borderRadius: 12,
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        fontSize: '0.875rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        animation: 'update-slide-up 0.3s ease',
        maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>🚀</span>
      <span>New version available</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.375rem 1rem',
          background: '#84CC16',
          color: '#0F172A',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: '0.8rem',
          flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        Reload
      </button>
      <button
        onClick={() => setUpdateAvailable(false)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#9CA3AF',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>

      <style>{`
        @keyframes update-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
