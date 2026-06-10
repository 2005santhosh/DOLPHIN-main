import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { gamificationAPI, connectionsAPI } from '../../services/api';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import DashboardBottomNav from '../shared/DashboardBottomNav';
import LoadingSpinner from '../shared/LoadingSpinner';
import VerifiedPromoModal from '../shared/VerifiedPromoModal';
import ErrorBoundary from '../shared/ErrorBoundary';

const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage'));
const FoundersPage     = lazy(() => import('./pages/FoundersPage'));
const PostsPage        = lazy(() => import('../founder/pages/PostsPage'));
const RequestsPage     = lazy(() => import('./pages/RequestsPage'));
const ChatPage         = lazy(() => import('../founder/pages/ChatPage'));
const SettingsPage     = lazy(() => import('../founder/pages/SettingsPage'));
const GamificationPage = lazy(() => import('../shared/GamificationPage'));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage'));

/** Returns true only if user has an active payment-based verified badge */
function isActivelyVerified(user) {
  if (!user) return false;
  if (!user.isVerified) return false;
  if (user.verifiedSource !== 'payment') return false;
  if (user.verifiedUntil && new Date(user.verifiedUntil) <= new Date()) return false;
  return true;
}

/**
 * Full-page gate shown when user tries to access a verified-only feature.
 * `onVerify` navigates to the verification/settings page.
 */
function VerifiedOnlyGate({ onVerify }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 160px)',
      padding: '2rem 1.5rem',
      textAlign: 'center',
    }}>
      {/* Lock icon */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 24px rgba(245,158,11,0.2)',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      {/* Badge preview */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: '#F0FDF4', border: '1px solid #BBF7D0',
        borderRadius: 999, padding: '4px 14px', marginBottom: '1.25rem',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16A34A', letterSpacing: '0.03em' }}>
          Verified Members Only
        </span>
      </div>

      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.4rem', fontWeight: 800, color: '#111827', maxWidth: 400 }}>
        Opportunities is a Verified Feature
      </h2>
      <p style={{ margin: '0 0 2rem', fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.65, maxWidth: 420 }}>
        Get your profile verified to unlock access to curated job opportunities,
        internships, government jobs, and remote roles — all in one place.
      </p>

      <button
        onClick={onVerify}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: 'linear-gradient(135deg, #16A34A, #15803D)',
          color: 'white', border: 'none', borderRadius: 10,
          padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,163,74,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,163,74,0.35)'; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Verify My Profile
      </button>

      <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: '#9CA3AF' }}>
        One-time verification · Instant access after payment
      </p>
    </div>
  );
}

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  // Fetch pending requests count on mount
  useEffect(() => {
    connectionsAPI.getPendingCount()
      .then(data => { if (data?.count > 0) setRequestsCount(data.count); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Record daily login + update streak badge on mount.
  // Always fetch fresh stats after recordLogin to guarantee the Header
  // shows the post-login streak (fixes the race where Header fetches
  // before recordLogin writes to DB)
  useEffect(() => {
    const syncStreak = (streak) => {
      if (streak !== undefined && streak !== null) {
        window.dispatchEvent(new CustomEvent('streak-updated', { detail: { currentStreak: streak } }));
      }
    };

    const fetchFreshStreak = () =>
      gamificationAPI.getMyStats()
        .then(data => syncStreak(data?.currentStreak))
        .catch(() => {});

    gamificationAPI.recordLogin()
      .then(result => {
        if (result?.newStreak !== undefined) syncStreak(result.newStreak);
        fetchFreshStreak();
      })
      .catch(() => fetchFreshStreak());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle hash navigation — supports #chat?userId=xxx
  useEffect(() => {
    const handleHashChange = () => {
      const full = window.location.hash.replace('#', '');
      const [page] = full.split('?');
      setCurrentPage(page || 'dashboard');
      setSidebarOpen(false);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const getOpenUserId = () => {
    const full = window.location.hash.replace('#', '');
    const [, query] = full.split('?');
    if (!query) return null;
    return new URLSearchParams(query).get('userId') || null;
  };

  const sidebarItems = [
    {
      section: 'Main',
      items: [
        { path: '#dashboard',      icon: 'home',         label: 'Dashboard' },
        { path: '#profile',        icon: 'profile',      label: 'Profile' },
        { path: '#founders',       icon: 'users',        label: 'Founders' },
        { path: '#opportunities',  icon: 'briefcase',    label: 'Opportunities' },
        { path: '#posts',          icon: 'posts',        label: 'Posts' },
        { path: '#requests',       icon: 'requests',     label: 'Requests', badge: requestsCount },
        { path: '#chat',           icon: 'chat',         label: 'Chat', badge: chatCount },
        { path: '#gamification',   icon: 'gamification', label: 'Streaks & Rewards' },
      ]
    },
    {
      section: 'Settings',
      items: [
        { path: '#settings', icon: 'settings', label: 'Settings' },
      ]
    }
  ];

  // Render current page
  const renderPage = () => {
    const pageProps = { setRequestsCount, setChatCount };

    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'profile':
        return <ProfilePage />;
      case 'founders':
        return <FoundersPage />;
      case 'posts':
        return <PostsPage />;
      case 'requests':
        return <RequestsPage {...pageProps} />;
      case 'chat':
        return <ChatPage {...pageProps} setChatCount={setChatCount} openUserId={getOpenUserId()} />;
      case 'settings':
        return <SettingsPage />;
      case 'opportunities':
        return isActivelyVerified(user)
          ? <OpportunitiesPage user={user} />
          : <VerifiedOnlyGate onVerify={() => setCurrentPage('settings')} />;
      case 'gamification':
        return <GamificationPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ErrorBoundary>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <VerifiedPromoModal />
      <div style={{ display: 'flex' }}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          requestsCount={requestsCount}
          chatCount={chatCount}
          navItems={sidebarItems}
        />
        
        <main
          className="dashboard-main"
          style={{
            flex: 1,
            maxWidth: '100%',
            minHeight: 'calc(100vh - 73px)',
            overflowX: 'hidden',
          }}
        >
          <Suspense fallback={<LoadingSpinner message="Loading..." />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
      <DashboardBottomNav
        requestsCount={requestsCount}
        chatCount={chatCount}
        items={[
          {
            hash: 'dashboard',
            label: 'Home',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            ),
          },
          {
            hash: 'opportunities',
            label: 'Opportunities',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            ),
          },
          {
            hash: 'posts',
            label: 'Posts',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
            ),
          },
          {
            hash: 'chat',
            label: 'Chat',
            badgeKey: 'chat',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            ),
          },
          {
            hash: 'settings',
            label: 'Settings',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            ),
          },
        ]}
      />
    </div>
    </ErrorBoundary>
  );
}
