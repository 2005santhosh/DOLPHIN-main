import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { gamificationAPI } from '../../services/api';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import DashboardBottomNav from '../shared/DashboardBottomNav';
import LoadingSpinner from '../shared/LoadingSpinner';
import VerifiedPromoModal from '../shared/VerifiedPromoModal';

const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage'));
const FoundersPage     = lazy(() => import('./pages/FoundersPage'));
const PostsPage        = lazy(() => import('../founder/pages/PostsPage'));
const RequestsPage     = lazy(() => import('./pages/RequestsPage'));
const ChatPage         = lazy(() => import('../founder/pages/ChatPage'));
const SettingsPage     = lazy(() => import('../founder/pages/SettingsPage'));
const GamificationPage = lazy(() => import('../shared/GamificationPage'));
const OpportunitiesPage = lazy(() => import('./pages/OpportunitiesPage'));

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

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
        return <OpportunitiesPage user={user} />;
      case 'gamification':
        return <GamificationPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
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
            hash: 'requests',
            label: 'Requests',
            badgeKey: 'requests',
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
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
  );
}
