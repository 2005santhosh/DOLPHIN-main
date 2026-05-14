import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose, requestsCount = 0, chatCount = 0, navItems }) {
  const location = useLocation();
  
  const isActive = (path) => {
    return location.hash === path || (path === '#dashboard' && !location.hash);
  };

  // Default nav items for founder (if not provided)
  const defaultNavItems = [
    {
      section: 'Main',
      items: [
        { path: '#dashboard', icon: 'home', label: 'Dashboard' },
        { path: '#profile', icon: 'profile', label: 'Profile' },
        { path: '#stages', icon: 'check', label: 'Validation Stages' },
        { path: '#tasks', icon: 'tasks', label: 'Growth Roadmap' },
      ]
    },
    {
      section: 'Resources',
      items: [
        { path: '#analytics', icon: 'analytics', label: 'Analytics' },
        { path: '#investors-providers', icon: 'users', label: 'Investors & Providers' },
        { path: '#posts', icon: 'posts', label: 'Posts' },
        { path: '#requests', icon: 'requests', label: 'Requests', badge: requestsCount },
        { path: '#chat', icon: 'chat', label: 'Chat', badge: chatCount },
      ]
    },
    {
      section: 'Settings',
      items: [
        { path: '#settings', icon: 'settings', label: 'Settings' },
      ]
    }
  ];

  const items = navItems || defaultNavItems;

  const getIcon = (iconName) => {
    const icons = {
      home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>,
      profile: <><rect x="3" y="12" width="7" height="9"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="7" y="5" width="10" height="7"></rect></>,
      check: <><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></>,
      tasks: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></>,
      analytics: <><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></>,
      users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
      posts: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>,
      requests: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></>,
      chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>,
      settings: <><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></>,
    };
    return icons[iconName] || null;
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <nav
        style={{
          width: '260px',
          height: 'calc(100vh - 73px)',
          position: 'sticky',
          top: '73px',
          background: 'white',
          borderRight: '1px solid #E5E7EB',
          overflowY: 'auto',
          padding: '1.5rem 0',
          flexShrink: 0,
          transition: 'transform 300ms ease',
        }}
        className={`sidebar ${isOpen ? 'open' : ''}`}
      >
        {items.map((section, idx) => (
          <div key={idx} style={{ marginBottom: '2rem' }}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 1.5rem',
              marginBottom: '0.75rem',
            }}>
              {section.section}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {section.items.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1.5rem',
                      color: isActive(item.path) ? '#3B82F6' : '#6B7280',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      background: isActive(item.path) ? '#EFF6FF' : 'transparent',
                      borderLeft: isActive(item.path) ? '3px solid #3B82F6' : '3px solid transparent',
                      transition: 'all 200ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.background = '#F9FAFB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {getIcon(item.icon)}
                    </svg>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge > 0 && (
                      <span style={{
                        background: '#EF4444',
                        color: 'white',
                        borderRadius: '9999px',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        padding: '0.125rem 0.5rem',
                        minWidth: '1.25rem',
                        textAlign: 'center',
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            top: 73px !important;
            left: 0 !important;
            z-index: 1000 !important;
            transform: translateX(-100%) !important;
            box-shadow: 4px 0 16px rgba(0,0,0,0.12) !important;
            height: calc(100vh - 73px) !important;
          }
          .sidebar.open {
            transform: translateX(0) !important;
          }
          .sidebar-overlay {
            position: fixed !important;
            inset: 0 !important;
            background: rgba(0,0,0,0.5) !important;
            z-index: 999 !important;
          }
        }
      `}</style>
    </>
  );
}
