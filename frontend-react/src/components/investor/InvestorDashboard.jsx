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
const StartupsPage     = lazy(() => import('./pages/StartupsPage'));
const WatchlistPage    = lazy(() => import('./pages/WatchlistPage'));
const PostsPage        = lazy(() => import('../founder/pages/PostsPage'));
const RequestsPage     = lazy(() => import('./pages/RequestsPage'));
const ChatPage         = lazy(() => import('../founder/pages/ChatPage'));
const SettingsPage     = lazy(() => import('../founder/pages/SettingsPage'));
const GamificationPage = lazy(() => import('../shared/GamificationPage'));

export default function InvestorDashboard() {
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
        { path: '#dashboard',     icon: 'home',         label: 'Dashboard' },
        { path: '#startups',      icon: 'users',        label: 'Startups' },
        { path: '#watchlist',     icon: 'check',        label: 'Watchlist' },
        { path: '#posts',         icon: 'posts',        label: 'Posts' },
        { path: '#requests',      icon: 'requests',     label: 'Requests', badge: requestsCount },
        { path: '#chat',          icon: 'chat',         label: 'Chat',     badge: chatCount },
        { path: '#gamification',  icon: 'gamification', label: 'Streaks & Rewards' },
      ],
    },
    {
      section: 'Settings',
      items: [
        { path: '#settings', icon: 'settings', label: 'Settings' },
      ],
    },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':     return <DashboardPage />;
      case 'startups':      return <StartupsPage />;
      case 'watchlist':     return <WatchlistPage />;
      case 'posts':         return <PostsPage />;
      case 'requests':      return <RequestsPage setRequestsCount={setRequestsCount} />;
      case 'chat':          return <ChatPage setChatCount={setChatCount} openUserId={getOpenUserId()} />;
      case 'settings':      return <SettingsPage />;
      case 'gamification':  return <GamificationPage />;
      default:              return <DashboardPage />;
    }
  };

  return (
    <ErrorBoundary>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
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
          style={{ flex: 1, maxWidth: '100%', minHeight: 'calc(100vh - 73px)', overflowX: 'hidden' }}
        >
          <Suspense fallback={<LoadingSpinner message="Loading..." />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
      <DashboardBottomNav requestsCount={requestsCount} chatCount={chatCount} />
    </div>
    </ErrorBoundary>
  );
}
