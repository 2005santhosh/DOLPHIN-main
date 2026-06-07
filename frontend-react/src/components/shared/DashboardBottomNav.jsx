/**
 * DashboardBottomNav — mobile-only bottom navigation bar
 * Shown on all dashboards. Uses hash-based routing.
 * Pass a custom `items` array to override the default nav items.
 */
import { useState, useEffect } from 'react';

const DEFAULT_ITEMS = [
  {
    hash: 'dashboard',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    hash: 'posts',
    label: 'Posts',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    hash: 'chat',
    label: 'Chat',
    badgeKey: 'chat',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    hash: 'requests',
    label: 'Requests',
    badgeKey: 'requests',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    hash: 'settings',
    label: 'Settings',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function DashboardBottomNav({ requestsCount = 0, chatCount = 0, items }) {
  const [hash, setHash] = useState(
    () => window.location.hash.replace('#', '').split('?')[0] || 'dashboard'
  );

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash.replace('#', '').split('?')[0] || 'dashboard');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Resolve badge counts by key
  const badgeCounts = { requests: requestsCount, chat: chatCount };

  const navItems = (items || DEFAULT_ITEMS).map(item => ({
    ...item,
    badge: item.badge !== undefined ? item.badge : (item.badgeKey ? badgeCounts[item.badgeKey] || 0 : 0),
  }));

  return (
    <>
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'white',
        borderTop: '1px solid #E5E7EB',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 998,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }} className="dashboard-bottom-nav">
        {navItems.map(item => {
          const active = hash === item.hash;
          return (
            <a
              key={item.hash}
              href={`#${item.hash}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                flex: 1,
                height: '100%',
                textDecoration: 'none',
                color: active ? '#84CC16' : '#9CA3AF',
                position: 'relative',
                transition: 'color 0.15s',
                fontSize: '0.62rem',
                fontWeight: active ? 700 : 500,
              }}
            >
              {/* Active indicator */}
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28,
                  height: 3,
                  background: '#84CC16',
                  borderRadius: '0 0 3px 3px',
                }} />
              )}

              {/* Icon with badge */}
              <span style={{ position: 'relative', display: 'flex' }}>
                {item.icon}
                {item.badge > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    background: '#EF4444',
                    color: 'white',
                    borderRadius: '9999px',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '1px 4px',
                    minWidth: 14,
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>

              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-bottom-nav {
            display: flex !important;
          }
          /* Push main content up so it's not hidden behind bottom nav */
          .dashboard-main {
            padding-bottom: calc(60px + env(safe-area-inset-bottom) + 0.5rem) !important;
          }
        }
      `}</style>
    </>
  );
}
