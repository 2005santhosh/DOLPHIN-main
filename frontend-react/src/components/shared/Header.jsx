import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI, providerAPI } from '../../services/api';
import toast from 'react-hot-toast';

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
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [providerRating, setProviderRating] = useState(null);
  const notifRef = useRef(null);

  // Reset imgError when profilePicture changes
  useEffect(() => {
    setImgError(false);
  }, [user?.profilePicture]);

  // For providers: fetch avg rating from profile
  useEffect(() => {
    if (user?.role === 'provider') {
      providerAPI.getMyProfile()
        .then(profile => {
          const rating = profile?.avgRating;
          if (rating !== undefined && rating !== null) {
            setProviderRating(Number(rating).toFixed(1));
          }
        })
        .catch(() => {}); // silent — don't break header on error
    }
  }, [user?.role]);

  // Load notifications on mount and every 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationsAPI.getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (err) {
      // silent — don't spam errors for notifications
    }
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

  // Derived values
  const rewardPoints = user?.rewardPoints ?? 0;
  const isVerified = VERIFIED_STATES.includes(user?.state);
  const avatarUrl = buildImageUrl(user?.profilePicture);
  const showImage = !!avatarUrl && !imgError;

  // For providers: show avg rating (★ 4.5); for others: show reward points (⭐ 150)
  const isProvider = user?.role === 'provider';
  const statIcon  = isProvider ? '★' : '⭐';
  const statValue = isProvider
    ? (providerRating !== null ? providerRating : '—')
    : rewardPoints;
  const statTitle = isProvider ? 'Avg Rating' : 'Reward Points';

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'white', borderBottom: '1px solid #E5E7EB',
      padding: '0.75rem 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>

        {/* Left: hamburger + logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onMenuToggle}
            className="mobile-menu-btn"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#6B7280' }}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3B82F6', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🐬 <span>Dolphin</span></span>
        </div>

        {/* Right: points + notifications + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* Reward Points / Rating */}
          <div
            title={statTitle}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6B7280', fontSize: '0.9rem', fontWeight: 500 }}
          >
            <span style={{ fontSize: '1rem', color: isProvider ? '#F59E0B' : undefined }}>{statIcon}</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{statValue}</span>
          </div>

          {/* Notifications bell */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', color: '#6B7280', display: 'flex', alignItems: 'center' }}
              aria-label="Notifications"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: '#EF4444', color: 'white', borderRadius: '9999px',
                  fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', minWidth: '16px', textAlign: 'center',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '340px', maxWidth: '92vw',
                background: 'white', borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', zIndex: 2000,
              }}>
                <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>Mark all read</button>
                    <button onClick={clearNotifications} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}>Clear</button>
                    <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                </div>
                <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.9rem' }}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n._id} style={{
                        padding: '0.875rem 1rem', borderBottom: '1px solid #F3F4F6',
                        background: n.read ? 'white' : '#EFF6FF', cursor: 'pointer',
                      }}>
                        <div style={{ fontSize: '0.875rem', color: '#111827', marginBottom: '3px' }}>{n.message || n.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User avatar */}
          <div style={{ position: 'relative', cursor: 'pointer' }} title={user?.name || 'Profile'}>
            {showImage ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Profile'}
                onError={() => setImgError(true)}
                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '0.85rem',
                border: '2px solid #E5E7EB',
              }}>
                {getInitials(user?.name)}
              </div>
            )}

            {/* Verified badge */}
            {isVerified && (
              <span style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: 16, height: 16, background: '#22C55E',
                borderRadius: '50%', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 8, height: 8 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>

          {/* Name (desktop only) */}
          <span className="user-name-desktop" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', display: 'none' }}>
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
