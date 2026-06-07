import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { founderAPI, gamificationAPI } from '../../services/api';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import ErrorBoundary from '../shared/ErrorBoundary';
import DashboardBottomNav from '../shared/DashboardBottomNav';
import LoadingSpinner from '../shared/LoadingSpinner';
import VerifiedPromoModal from '../shared/VerifiedPromoModal';

// Lazy-load all pages to prevent circular dependency issues at bundle time
const DashboardPage         = lazy(() => import('./pages/DashboardPage'));
const ProfilePage           = lazy(() => import('./pages/ProfilePage'));
const StagesPage            = lazy(() => import('./pages/StagesPage'));
const TasksPage             = lazy(() => import('./pages/TasksPage'));
const AnalyticsPage         = lazy(() => import('./pages/AnalyticsPage'));
const InvestorsProvidersPage = lazy(() => import('./pages/InvestorsProvidersPage'));
const PostsPage             = lazy(() => import('./pages/PostsPage'));
const RequestsPage          = lazy(() => import('./pages/RequestsPage'));
const ChatPage              = lazy(() => import('./pages/ChatPage'));
const SettingsPage          = lazy(() => import('./pages/SettingsPage'));
const GamificationPage      = lazy(() => import('../shared/GamificationPage'));

export default function FounderDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  // Fetch startup data
  const { data: startup, isLoading, refetch } = useQuery({
    queryKey: ['startup'],
    queryFn: founderAPI.getMyStartup,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Record daily login + update streak badge on mount.
  // Strategy: call recordLogin() first (writes new streak to DB), then
  // always fetch fresh stats afterward so the Header badge reflects today's streak.
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
        // recordLogin returns the updated streak immediately — use it
        if (result?.newStreak !== undefined) {
          syncStreak(result.newStreak);
        }
        // Always fetch fresh stats after recordLogin to guarantee the Header
        // shows the post-login streak (fixes the race where Header fetches
        // before recordLogin writes to DB)
        fetchFreshStreak();
      })
      .catch(() => fetchFreshStreak());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle hash navigation — supports #chat?userId=xxx
  useEffect(() => {
    const handleHashChange = () => {
      const full = window.location.hash.replace('#', '');
      const [page, query] = full.split('?');
      setCurrentPage(page || 'dashboard');
      setSidebarOpen(false);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Parse openUserId from hash query string
  const getOpenUserId = () => {
    const full = window.location.hash.replace('#', '');
    const [, query] = full.split('?');
    if (!query) return null;
    const params = new URLSearchParams(query);
    return params.get('userId') || null;
  };

  // Calculate points from user, not startup
  const points = user?.rewardPoints || 0;

  // Render current page
  const renderPage = () => {
    const pageProps = { startup, refetch, isLoading };

    try {
      switch (currentPage) {
        case 'dashboard':
          return <DashboardPage {...pageProps} />;
        case 'profile':
          return <ProfilePage {...pageProps} />;
        case 'stages':
          return <StagesPage {...pageProps} />;
        case 'tasks':
          return <TasksPage {...pageProps} />;
        case 'analytics':
          return <AnalyticsPage {...pageProps} />;
        case 'investors-providers':
          return <InvestorsProvidersPage {...pageProps} />;
        case 'posts':
          return <PostsPage {...pageProps} />;
        case 'requests':
          return <RequestsPage {...pageProps} setRequestsCount={setRequestsCount} />;
        case 'chat':
          return <ChatPage {...pageProps} setChatCount={setChatCount} openUserId={getOpenUserId()} />;
        case 'settings':
          return <SettingsPage {...pageProps} />;
        case 'gamification':
          return <GamificationPage />;
        default:
          return <DashboardPage {...pageProps} />;
      }
    } catch (error) {
      console.error('Error rendering page:', error);
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Error loading page</h2>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
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
      </div>
      <DashboardBottomNav requestsCount={requestsCount} chatCount={chatCount} />
    </ErrorBoundary>
  );
}
