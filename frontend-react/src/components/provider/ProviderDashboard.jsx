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

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  // Record daily login + update streak badge on mount
  useEffect(() => {
    const updateStreak = () => {
      gamificationAPI.getMyStats()
        .then(data => {
          if (data?.currentStreak !== undefined) {
            window.dispatchEvent(new CustomEvent('streak-updated', {
              detail: { currentStreak: data.currentStreak }
            }));
          }
        })
        .catch(() => {});
    };
    gamificationAPI.recordLogin()
      .then(result => {
        if (result?.newStreak !== undefined) {
          window.dispatchEvent(new CustomEvent('streak-updated', {
            detail: { currentStreak: result.newStreak }
          }));
        } else {
          updateStreak();
        }
      })
      .catch(updateStreak);
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

  // Sidebar items for provider
  const sidebarItems = [
    {
      section: 'Main',
      items: [
        { path: '#dashboard',    icon: 'home',         label: 'Dashboard' },
        { path: '#profile',      icon: 'profile',      label: 'Profile' },
        { path: '#founders',     icon: 'users',        label: 'Founders' },
        { path: '#posts',        icon: 'posts',        label: 'Posts' },
        { path: '#requests',     icon: 'requests',     label: 'Requests', badge: requestsCount },
        { path: '#chat',         icon: 'chat',         label: 'Chat', badge: chatCount },
        { path: '#gamification', icon: 'gamification', label: 'Streaks & Rewards' },
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
      <DashboardBottomNav requestsCount={requestsCount} chatCount={chatCount} />
    </div>
  );
}
