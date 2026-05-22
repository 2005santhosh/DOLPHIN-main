import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Header from '../shared/Header';
import Sidebar from '../shared/Sidebar';
import DashboardBottomNav from '../shared/DashboardBottomNav';

import DashboardPage from './pages/DashboardPage';
import StartupsPage from './pages/StartupsPage';
import WatchlistPage from './pages/WatchlistPage';
import PostsPage from '../founder/pages/PostsPage';
import RequestsPage from './pages/RequestsPage';
import ChatPage from '../founder/pages/ChatPage';
import SettingsPage from '../founder/pages/SettingsPage';
import GamificationPage from '../shared/GamificationPage';

export default function InvestorDashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [requestsCount, setRequestsCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

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
        <main style={{ flex: 1, padding: '2rem', maxWidth: '100%', minHeight: 'calc(100vh - 73px)', overflowX: 'hidden' }} className="dashboard-main">
          {renderPage()}
        </main>
      </div>
      <DashboardBottomNav requestsCount={requestsCount} chatCount={chatCount} />
    </div>
  );
}
