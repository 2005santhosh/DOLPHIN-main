import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';

import DashboardPage from './pages/DashboardPage';
import StartupsPage from './pages/StartupsPage';
import WatchlistPage from './pages/WatchlistPage';
import PostsPage from '../founder/pages/PostsPage';
import RequestsPage from './pages/RequestsPage';
import ChatPage from '../founder/pages/ChatPage';
import SettingsPage from '../founder/pages/SettingsPage';

export default function InvestorDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

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

  const sidebarItems = [
    {
      section: 'Main',
      items: [
        { path: '#dashboard',  icon: 'home',     label: 'Dashboard' },
        { path: '#startups',   icon: 'users',    label: 'Startups' },
        { path: '#watchlist',  icon: 'check',    label: 'Watchlist' },
        { path: '#posts',      icon: 'posts',    label: 'Posts' },
        { path: '#requests',   icon: 'requests', label: 'Requests', badge: requestsCount },
        { path: '#chat',       icon: 'chat',     label: 'Chat',     badge: chatCount },
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
      case 'dashboard':  return <DashboardPage />;
      case 'startups':   return <StartupsPage />;
      case 'watchlist':  return <WatchlistPage />;
      case 'posts':      return <PostsPage />;
      case 'requests':   return <RequestsPage setRequestsCount={setRequestsCount} />;
      case 'chat':       return <ChatPage setChatCount={setChatCount} />;
      case 'settings':   return <SettingsPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div style={{ display: 'flex' }}>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          requestsCount={requestsCount}
          chatCount={chatCount}
          navItems={sidebarItems}
        />
        <main style={{ flex: 1, padding: '2rem', maxWidth: '100%', minHeight: 'calc(100vh - 73px)' }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
