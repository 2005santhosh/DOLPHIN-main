import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { founderAPI } from '../../services/api';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import ErrorBoundary from '../shared/ErrorBoundary';

// Import pages
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import StagesPage from './pages/StagesPage';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InvestorsProvidersPage from './pages/InvestorsProvidersPage';
import PostsPage from './pages/PostsPage';
import RequestsPage from './pages/RequestsPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';

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

  // Handle hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      setCurrentPage(hash);
      setSidebarOpen(false); // Close sidebar on mobile when navigating
    };

    handleHashChange(); // Initial load
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          return <ChatPage {...pageProps} setChatCount={setChatCount} />;
        case 'settings':
          return <SettingsPage {...pageProps} />;
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
        
        <div style={{ display: 'flex' }}>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            requestsCount={requestsCount}
            chatCount={chatCount}
          />
          
          <main style={{
            flex: 1,
            padding: '2rem',
            maxWidth: '100%',
            minHeight: 'calc(100vh - 73px)',
          }}>
            {renderPage()}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
