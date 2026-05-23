import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI, providerAPI, gamificationAPI } from '../../services/api';
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

/** Flame icon — colour shifts with streak length */
function StreakBadge({ streak }) {
  if (streak === undefined || streak === null) return null;
  const color =
    streak >= 30 ? '#F59E0B' :
    streak >= 7  ? '#EF4444' :
    streak > 0   ? '#FB923C' :
                   '#9CA3AF';

  return (
    <button
      onClick={() => { window.location.hash = 'gamification'; }}
      title={`${streak}-day streak — click to view`}
      style={{
        display: 'flex', alignItems: 'center', gap: '3px',
        background: streak > 0 ? `${color}18` : '#F3F4F6',
        border: `1.5px solid ${streak > 0 ? `${color}55` : '#E5E7EB'}`,
        borderRadius: 9999,
        padding: '3px 9px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
      aria-label={`${streak}-day streak`}
    >
      {/* Flame SVG */}
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill={color}
        style={{ filter: streak > 0 ? `drop-shadow(0 0 4px ${color}99)` : 'none', flexShrink: 0 }}
      >
        <path d="M12 2C12 2 8 7 8 11C8 13.2 9.8 15 12 15C14.2 15 16 13.2 16 11C16 7 12 2 12 2Z"/>
        <path d="M12 15C9.8 15 8 16.8 8 19C8 21.2 9.8 23 12 23C14.2 23 16 21.2 16 19C16 16.8 14.2 15 12 15Z" opacity="0.65"/>
      </svg>
      <span style={{ fontWeight: 700, fontSize: '0.78rem', color, lineHeight: 1 }}>
        {streak}
      </span>
    </button>
  );
}

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const [notifications, setNotifications]   = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [imgError, setImgError]             = useState(false);
  const [providerRating, setProviderRating] = useState(null);
  const [streak, setStreak]                 = useState(null);
  const notifRef    = useRef(null);
  const bellRef     = useRef(null);
  const [dropdownStyle, setDropdownStyle]   = useState({});

  useEffect(() => { setImgError(false); }, [user?.profilePicture]);

  // Provider rating
  useEffect(() => {
    if (user?.role === 'provider') {
      providerAPI.getMyProfile()
        .then(p => { if (p?.avgRating != null) setProviderRating(Number(p.avgRating).toFixed(1)); })
        .catch(() => {});
    }
  }, [user?.role]);

  // Notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Streak — listen for streak-updated events from AuthContext (fires on mount + every 2min)
  // Also do one direct fetch as a fallback in case the event fires before this effect runs
  useEffect(() => {
    let mounted = true;

    // Fallback fetch — only if streak is still null after 2 seconds
    // (means the streak-updated event was missed)
    const fallbackTimer = setTimeout(() => {
      if (mounted && streak === null) {
        gamificationAPI.getMyStats()
          .then(data => { if (mounted) setStreak(data?.currentStreak ?? 0); })
          .catch(() => { if (mounted) setStreak(0); });
      }
    }, 2000);

    const onStreakUpdated = (e) => {
      if (!mounted) return;
      if (e.detail?.currentStreak !== undefined) {
        setStreak(e.detail.currentStreak);
      }
    };
    window.addEventListener('streak-updated', onStreakUpdated);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      window.removeEventListener('streak-updated', onStreakUpdated);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close notifications on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNotifications = () => {
    if (!bellRef.current) { setShowNotifications(v => !v); return; }
    const rect = bellRef.current.getBoundingClientRect();
    const dropW = Math.min(340, window.innerWidth - 16);
    let left = rect.right - dropW;
    if (left < 8) left = 8;
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
    setDropdownStyle({ position: 'fixed', top: rect.bottom + 8, left, width: dropW });
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

  const goToProfile = () => { window.location.hash = 'profile'; };

  // Derived
  const isVerified = VERIFIED_STATES.includes(user?.state);
  const avatarUrl  = buildImageUrl(user?.profilePicture);
  const showImage  = !!avatarUrl && !imgError;
  const isProvider = user?.role === 'provider';
  const statValue  = isProvider ? (providerRating ?? '—') : (user?.rewardPoints ?? 0);
  const statTitle  = isProvider ? 'Avg Rating' : 'Reward Points';

  return (
    <header className="app-header">
      <div className="app-header__inner">

        {/* ── Left: hamburger + logo ── */}
        <div className="app-header__left">
          <button
            onClick={onMenuToggle}
            className="app-header__hamburger"
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <a href="#dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <DolphinLogo size={30} textColor="#111827" />
          </a>
        </div>

        {/* ── Right: streak + points + bell + avatar + name ── */}
        <div className="app-header__right">

          {/* Streak badge — always visible */}
          {streak !== null && <StreakBadge streak={streak} />}

          {/* Points / Rating — hidden on very small screens */}
          <div
            title={statTitle}
            className="app-header__stat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isProvider ? '#F59E0B' : '#9CA3AF'} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span style={{ fontWeight: 700, color: '#374151', fontSize: '0.82rem' }}>{statValue}</span>
          </div>

          {/* Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              ref={bellRef}
              onClick={openNotifications}
              className="app-header__icon-btn"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="app-header__badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
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
                {/* Dropdown header */}
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

                {/* Notification list */}
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
                      <div
                        key={n._id}
                        style={{
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

          {/* Avatar */}
          <button
            onClick={goToProfile}
            title={`${user?.name || 'Profile'} — Go to profile`}
            className="app-header__avatar-btn"
            aria-label="Go to profile"
          >
            {showImage ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Profile'}
                onError={() => setImgError(true)}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '0.78rem',
                border: '2px solid #E5E7EB',
              }}>
                {getInitials(user?.name)}
              </div>
            )}
            {isVerified && (
              <span style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: 13, height: 13, background: '#22C55E',
                borderRadius: '50%', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 6, height: 6 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>

          {/* Name — desktop only */}
          <span className="app-header__name">
            {user?.name}
          </span>
        </div>
      </div>

      <style>{`
        /* ── Header base ── */
        .app-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: white;
          border-bottom: 1px solid #E5E7EB;
          padding: 0 1rem;
          height: 60px;
        }
        .app-header__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          gap: 0.5rem;
          max-width: 100%;
        }

        /* ── Left ── */
        .app-header__left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-shrink: 0;
        }
        .app-header__hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.375rem;
          color: #6B7280;
          flex-shrink: 0;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .app-header__hamburger:hover { background: #F3F4F6; }

        /* ── Right ── */
        .app-header__right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        /* Points/rating pill */
        .app-header__stat {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #6B7280;
          font-size: 0.82rem;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 9999px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          flex-shrink: 0;
        }

        /* Icon buttons (bell) */
        .app-header__icon-btn {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.375rem;
          color: #6B7280;
          display: flex;
          align-items: center;
          border-radius: 8px;
          transition: background 0.15s;
        }
        .app-header__icon-btn:hover { background: #F3F4F6; }

        /* Notification badge */
        .app-header__badge {
          position: absolute;
          top: 1px;
          right: 1px;
          background: #EF4444;
          color: white;
          border-radius: 9999px;
          font-size: 0.55rem;
          font-weight: 700;
          padding: 1px 4px;
          min-width: 14px;
          text-align: center;
          line-height: 1.4;
        }

        /* Avatar button */
        .app-header__avatar-btn {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          border-radius: 50%;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .app-header__avatar-btn:hover { opacity: 0.85; }

        /* Name — desktop only */
        .app-header__name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          display: none;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Desktop (≥ 768px) ── */
        @media (min-width: 768px) {
          .app-header { padding: 0 1.5rem; height: 64px; }
          .app-header__name { display: block; }
          .app-header__right { gap: 0.75rem; }
        }

        /* ── Mobile (< 768px) ── */
        @media (max-width: 767px) {
          .app-header__hamburger { display: flex !important; }
          /* Hide points pill on very small screens to save space */
          .app-header__stat { display: none; }
          .app-header__right { gap: 0.375rem; }
        }

        /* ── Extra small (< 380px) ── */
        @media (max-width: 379px) {
          .app-header { padding: 0 0.625rem; }
        }
      `}</style>
    </header>
  );
}
