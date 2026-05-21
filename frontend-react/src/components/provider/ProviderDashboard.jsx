import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { providerAPI } from '../../services/api';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import DashboardBottomNav from '../shared/DashboardBottomNav';

// Import pages
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import FoundersPage from './pages/FoundersPage';
import PostsPage from '../founder/pages/PostsPage'; // Reuse
import RequestsPage from './pages/RequestsPage';
import ChatPage from '../founder/pages/ChatPage'; // Reuse
import SettingsPage from '../founder/pages/SettingsPage'; // Reuse
import GamificationPage from '../shared/GamificationPage';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  // Handle hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      setCurrentPage(hash);
      setSidebarOpen(false);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
        return <ChatPage {...pageProps} />;
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
      
      <div style={{ display: 'flex' }}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          requestsCount={requestsCount}
          chatCount={chatCount}
          navItems={sidebarItems}
        />
        
        <main style={{
          flex: 1,
          padding: '2rem',
          maxWidth: '100%',
          minHeight: 'calc(100vh - 73px)',
          overflowX: 'hidden',
        }} className="dashboard-main">
          {renderPage()}
        </main>
      </div>
      <DashboardBottomNav requestsCount={requestsCount} chatCount={chatCount} />
    </div>
  );
}
