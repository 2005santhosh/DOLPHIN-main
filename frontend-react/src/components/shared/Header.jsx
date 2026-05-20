import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI, providerAPI } from '../../services/api';
import toast from 'react-hot-toast';
import DolphinLogo from './DolphinLogo';

const VERIFIED_STATES = ['APPROVED','STAGE_1','STAGE_2','STAGE_3','STAGE_4','STAGE_5','STAGE_6','STAGE_7'];

function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function buildImageUrl(pic) {
  if (!pic || pic.trim() === '') return null;
  if (pic.startsWith('http://') || pic.startsWith('https://')) return pic;
  return `${window.location.origin}${pic}`;
}

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [providerRating, setProviderRating] = useState(null);
  const notifRef = useRef(null);
  const bellRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => { setImgError(false); }, [user?.profilePicture]);

  useEffect(() => {
    if (user?.role === 'provider') {
      providerAPI.getMyProfile()
        .then(p => { if (p?.avgRating != null) setProviderRating(Number(p.avgRating).toFixed(1)); })
        .catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // every 60s
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalculate dropdown position so it never overflows the viewport
  const openNotifications = () => {
    if (!bellRef.current) { setShowNotifications(v => !v); return; }
    const rect = bellRef.current.getBoundingClientRect();
    const dropW = Math.min(340, window.innerWidth - 16);
    // Try to align right edge of dropdown with right edge of bell button
    let left = rect.right - dropW;
    // Clamp so it doesn't go off the left edge
    if (left < 8) left = 8;
    // Clamp so it doesn't go off the right edge
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left,
      width: dropW,
    });
    setShowNotifications(v => !v);
  };

  const loadNotifications = async () => {
    try {
      const data = await notificationsAPI.getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (_) {}
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark as read'); }
  };

  const clearNotifications = async () => {
    if (!confirm('Clear all notifications?')) return;
    try {
      await notificationsAPI.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
      toast.success('Notifications cleared');
    } catch { toast.error('Failed to clear notifications'); }
  };

  // Navigate to profile page (hash-based routing)
  const goToProfile = () => {
    window.location.hash = 'profile';
  };

  // Derived
  const isVerified = VERIFIED_STATES.includes(user?.state);
  const avatarUrl  = buildImageUrl(user?.profilePicture);
  const showImage  = !!avatarUrl && !imgError;
  const isProvider = user?.role === 'provider';
  const statValue  = isProvider ? (providerRating ?? '—') : (user?.rewardPoints ?? 0);
  const statTitle  = isProvider ? 'Avg Rating' : 'Reward Points';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'white', borderBottom: '1px solid #E5E7EB',
      padding: '0.75rem 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>

        {/* Left: hamburger + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <button
            onClick={onMenuToggle}
            className="mobile-menu-btn"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: '#6B7280', flexShrink: 0 }}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
            <DolphinLogo size={30} textColor="#111827" />
          </span>
        </div>

        {/* Right: stat + bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>

          {/* Stat (points / rating) */}
          <div title={statTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#6B7280', fontSize: '0.875rem', fontWeight: 500 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={isProvider ? '#F59E0B' : '#6B7280'} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span style={{ fontWeight: 700, color: '#374151' }}>{statValue}</span>
          </div>

          {/* Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              ref={bellRef}
              onClick={openNotifications}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0.375rem', color: '#6B7280', display: 'flex', alignItems: 'center' }}
              aria-label="Notifications"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '1px', right: '1px',
                  background: '#EF4444', color: 'white', borderRadius: '9999px',
                  fontSize: '0.58rem', fontWeight: 700, padding: '1px 4px',
                  minWidth: '15px', textAlign: 'center', lineHeight: 1.4,
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown — position: fixed, viewport-aware */}
            {showNotifications && (
              <div style={{
                ...dropdownStyle,
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                border: '1px solid #E5E7EB',
                zIndex: 9999,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#FAFAFA',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                    Notifications
                    {unreadCount > 0 && (
                      <span style={{ marginLeft: '6px', background: '#EF4444', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '1px 6px', fontWeight: 700 }}>
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                      Mark read
                    </button>
                    <button onClick={clearNotifications} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                      Clear
                    </button>
                    <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '2px 4px' }}>
                      ×
                    </button>
                  </div>
                </div>

                {/* List */}
                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n._id} style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #F3F4F6',
                        background: n.read ? 'white' : '#EFF6FF',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? 'white' : '#EFF6FF'}
                      >
                        <div style={{ fontSize: '0.85rem', color: '#111827', lineHeight: 1.4, marginBottom: '3px' }}>
                          {n.message || n.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar — click goes to profile */}
          <button
            onClick={goToProfile}
            title={`${user?.name || 'Profile'} — Go to profile`}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              borderRadius: '50%',
              flexShrink: 0,
            }}
            aria-label="Go to profile"
          >
            {showImage ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Profile'}
                onError={() => setImgError(true)}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '0.8rem',
                border: '2px solid #E5E7EB',
              }}>
                {getInitials(user?.name)}
              </div>
            )}
            {isVerified && (
              <span style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: 14, height: 14, background: '#22C55E',
                borderRadius: '50%', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 7, height: 7 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>

          {/* Name (desktop only) */}
          <span className="user-name-desktop" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', display: 'none', whiteSpace: 'nowrap' }}>
            {user?.name}
          </span>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) { .user-name-desktop { display: block !important; } }
        @media (max-width: 768px) { .mobile-menu-btn { display: flex !important; } }
      `}</style>
    </header>
  );
}
