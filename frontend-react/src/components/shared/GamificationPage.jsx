import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { gamificationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import PageHeader from './PageHeader';
import Card, { CardHeader, CardTitle } from './Card';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIZE_EVENT_END   = new Date('2026-06-30T23:59:59+05:30'); // June 30 2026 IST
const BADGE_DEADLINE    = new Date('2026-06-10T23:59:59+05:30'); // 20 days before June 30

function isPaidVerified(u) {
  return u?.isVerified === true && u?.verifiedSource === 'payment' && !!u?.verifiedUntil && new Date(u.verifiedUntil) > new Date();
}

// ─── Leaderboard Prize Announcement ──────────────────────────────────────────

function LeaderboardAnnouncement({ user }) {
  const now        = new Date();
  const eventOver  = now > PRIZE_EVENT_END;
  const pastDeadline = now > BADGE_DEADLINE;
  const isVerified = isPaidVerified(user);

  // Don't show after event ends
  if (eventOver) return null;

  const daysLeft = Math.ceil((PRIZE_EVENT_END - now) / 86400000);
  const deadlineDaysLeft = Math.max(0, Math.ceil((BADGE_DEADLINE - now) / 86400000));

  const scrollItems = [
    '🏆  Leaderboard Cash Prizes — Final scores counted on June 30, 2026',
    '🥇  1st Place  ·  ₹3,000 cash prize',
    '🥈  2nd Place  ·  ₹2,000 cash prize',
    '🥉  3rd Place  ·  ₹1,000 cash prize',
    '✅  Eligibility: Verified badge required (payment-verified only)',
    `⏰  Badge deadline: June 10, 2026  —  ${pastDeadline ? 'Deadline passed' : `${deadlineDaysLeft} day${deadlineDaysLeft !== 1 ? 's' : ''} left to get verified`}`,
    `📅  ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining until scores are finalised`,
    '🚫  High scores without a verified badge will NOT be considered',
  ];

  // duplicate for seamless loop
  const track = [...scrollItems, ...scrollItems];

  return (
    <div style={{ marginBottom: '1.25rem', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #FCD34D', boxShadow: '0 2px 8px rgba(245,158,11,0.15)' }}>
      {/* Header bar */}
      <div style={{
        background: 'linear-gradient(90deg, #1C1917 0%, #292524 100%)',
        padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1rem' }}>🏆</span>
        <span style={{ color: '#FCD34D', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Leaderboard Prize Announcement
        </span>
        <span style={{
          marginLeft: 'auto',
          background: '#EF4444',
          color: 'white',
          borderRadius: 9999,
          padding: '1px 8px',
          fontSize: '0.65rem',
          fontWeight: 800,
          letterSpacing: '0.04em',
          animation: 'lb-blink 1.4s ease-in-out infinite',
        }}>LIVE</span>
      </div>

      {/* Scrolling ticker */}
      <div style={{
        background: '#1C1917',
        overflow: 'hidden',
        position: 'relative',
        height: 38,
        display: 'flex',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          gap: '3rem',
          whiteSpace: 'nowrap',
          animation: 'lb-scroll 40s linear infinite',
          willChange: 'transform',
        }}>
          {track.map((item, i) => (
            <span key={i} style={{ color: '#FEF3C7', fontSize: '0.82rem', fontWeight: 500, flexShrink: 0 }}>
              {item}
            </span>
          ))}
        </div>
        {/* left + right fade masks */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(90deg, #1C1917, transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, background: 'linear-gradient(270deg, #1C1917, transparent)', pointerEvents: 'none' }} />
      </div>

      {/* User status bar */}
      <div style={{
        background: isVerified ? '#052e16' : (pastDeadline ? '#3B0764' : '#431407'),
        padding: '0.5rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      }}>
        {isVerified ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#22C55E"><circle cx="12" cy="12" r="12"/><polyline points="7 12 10.5 15.5 17 9" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ color: '#4ADE80', fontSize: '0.8rem', fontWeight: 700 }}>
              You are verified and eligible for the prize — keep your score high!
            </span>
          </>
        ) : pastDeadline ? (
          <>
            <span style={{ fontSize: '0.9rem' }}>❌</span>
            <span style={{ color: '#E9D5FF', fontSize: '0.8rem', fontWeight: 600 }}>
              Badge deadline has passed — you are no longer eligible for this prize round.
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.9rem' }}>⚠️</span>
            <span style={{ color: '#FED7AA', fontSize: '0.8rem', fontWeight: 600 }}>
              You are not yet verified. Get verified before June 10, 2026 to be eligible.
            </span>
            <button
              onClick={() => { window.location.hash = 'settings'; }}
              style={{
                marginLeft: 'auto',
                background: 'linear-gradient(135deg, #84CC16, #16A34A)',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '3px 12px', fontSize: '0.75rem', fontWeight: 700,
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              Get Verified →
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes lb-scroll {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        @keyframes lb-blink {
          0%, 100% { opacity: 1 }
          50%       { opacity: 0.45 }
        }
      `}</style>
    </div>
  );
}

const STREAK_REWARDS = [
  {
    milestone: 30,
    name: 'Dolphin Cap',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    color: '#3B82F6', bg: '#DBEAFE', desc: 'Exclusive Dolphin branded cap',
  },
  {
    milestone: 60,
    name: 'Dolphin Bottle',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2h8l1 4H7L8 2z"/>
        <rect x="6" y="6" width="12" height="15" rx="2"/>
        <path d="M10 11h4M10 15h4"/>
      </svg>
    ),
    color: '#10B981', bg: '#D1FAE5', desc: 'Premium Dolphin water bottle',
  },
  {
    milestone: 90,
    name: 'Dolphin Bag',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
    color: '#8B5CF6', bg: '#EDE9FE', desc: 'Stylish Dolphin backpack',
  },
];

const ROLE_LABELS = { founder: 'Founder', investor: 'Investor', provider: 'Provider' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StreakFlame({ streak }) {
  const size = Math.min(48 + streak * 0.5, 80);
  const color = streak >= 30 ? '#F59E0B' : streak >= 7 ? '#EF4444' : '#6B7280';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ filter: streak > 0 ? `drop-shadow(0 0 8px ${color}88)` : 'none', transition: 'all 0.3s' }}>
        <path d="M12 2C12 2 8 7 8 11C8 13.2 9.8 15 12 15C14.2 15 16 13.2 16 11C16 7 12 2 12 2Z"/>
        <path d="M12 15C9.8 15 8 16.8 8 19C8 21.2 9.8 23 12 23C14.2 23 16 21.2 16 19C16 16.8 14.2 15 12 15Z" opacity="0.7"/>
        <path d="M10 11C10 11 9 13 10 14.5C10.5 15.2 11.2 15.5 12 15.5" opacity="0.5"/>
      </svg>
      <span style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{streak}</span>
      <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500 }}>day streak</span>
    </div>
  );
}

function ProgressBar({ current, target, color = '#84CC16' }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <div style={{ height: 8, background: '#E5E7EB', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.6s ease' }} />
    </div>
  );
}

function RewardCard({ reward, userReward, onClaim }) {
  const unlocked = !!userReward;
  const claimed  = userReward?.claimed;

  return (
    <div style={{
      border: `2px solid ${unlocked ? reward.color : '#E5E7EB'}`,
      borderRadius: 16,
      padding: '1.5rem',
      background: unlocked ? reward.bg : '#F9FAFB',
      opacity: unlocked ? 1 : 0.65,
      transition: 'all 0.3s',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {unlocked && !claimed && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: '#EF4444', color: 'white',
          borderRadius: 9999, fontSize: '0.65rem', fontWeight: 700,
          padding: '2px 8px',
        }}>NEW</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>{reward.icon}</div>
      <h3 style={{ margin: '0 0 4px', color: unlocked ? reward.color : '#9CA3AF', fontWeight: 700, textAlign: 'center', fontSize: '1rem' }}>
        {reward.name}
      </h3>
      <p style={{ margin: '0 0 0.75rem', color: '#6B7280', fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.4 }}>
        {reward.desc}
      </p>
      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: reward.color, background: reward.bg, padding: '3px 10px', borderRadius: 9999 }}>
          {reward.milestone}-day streak
        </span>
      </div>
      {unlocked && !claimed && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', background: reward.color, border: 'none', fontWeight: 700 }}
          onClick={() => onClaim(reward)}
        >
          Claim Reward
        </button>
      )}
      {claimed && (
        <div style={{ textAlign: 'center', color: '#059669', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Claimed
        </div>
      )}
      {!unlocked && (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Locked
        </div>
      )}
    </div>
  );
}

function LeaderboardTable({ data, currentUserId, loading }) {
  if (loading) return <LoadingSpinner message="Loading leaderboard…" />;
  if (!data || data.length === 0) {
    return <p style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>No data yet. Be the first!</p>;
  }

  const medalColors = ['#F59E0B', '#9CA3AF', '#CD7C2F'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {data.map((entry, i) => {
        const isMe = entry._id?.toString() === currentUserId?.toString();
        const avatarSrc = entry.profilePicture
          ? (entry.profilePicture.startsWith('http') ? entry.profilePicture : `${window.location.origin}${entry.profilePicture}`)
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name || 'U')}&background=84CC16&color=fff&size=80`;

        return (
          <div key={entry._id} style={{
            display: 'flex', alignItems: 'center', gap: '0.875rem',
            padding: '0.75rem 1rem',
            background: isMe ? '#F0FDF4' : i % 2 === 0 ? '#FAFAFA' : 'white',
            borderRadius: 10,
            border: isMe ? '2px solid #84CC16' : '1px solid #F3F4F6',
            transition: 'all 0.15s',
          }}>
            {/* Rank */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: i < 3 ? medalColors[i] : '#E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.85rem',
              color: i < 3 ? 'white' : '#6B7280',
            }}>
              {i < 3 ? ['🥇','🥈','🥉'][i] : entry.rank}
            </div>

            {/* Avatar */}
            <img src={avatarSrc} alt={entry.name}
              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB', flexShrink: 0 }}
              onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name || 'U')}&background=84CC16&color=fff&size=80`; }}
            />

            {/* Name + streak */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.name} {isMe && <span style={{ fontSize: '0.7rem', color: '#84CC16', fontWeight: 700 }}>(You)</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', display: 'flex', gap: '0.75rem', marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#EF4444"><path d="M12 2C12 2 8 7 8 11C8 13.2 9.8 15 12 15C14.2 15 16 13.2 16 11C16 7 12 2 12 2Z"/><path d="M12 15C9.8 15 8 16.8 8 19C8 21.2 9.8 23 12 23C14.2 23 16 21.2 16 19C16 16.8 14.2 15 12 15Z" opacity="0.65"/></svg>
                  {entry.currentStreak}d
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {entry.totalPosts}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {entry.totalConnections}
                </span>
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: '#111827', fontSize: '1rem' }}>{entry.leaderboardScore}</div>
              <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>score</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GamificationPage() {
  const { user } = useAuth();
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [lbRole, setLbRole]         = useState(user?.role || 'founder');
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading]   = useState(false);
  const [myRank, setMyRank]         = useState(null);
  const [myEntry, setMyEntry]       = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeTab, setActiveTab]   = useState('streak');

  // Claim modal
  const [claimModal, setClaimModal] = useState(false);
  const [claimReward, setClaimReward] = useState(null);
  const [claimForm, setClaimForm]   = useState({ fullName: user?.name || '', phone: '', address: '' });
  const [claiming, setClaiming]     = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await gamificationAPI.getMyStats();
      setStats(data);
      // Notify the Header to update the streak badge immediately
      window.dispatchEvent(new CustomEvent('streak-updated', {
        detail: { currentStreak: data?.currentStreak ?? 0 }
      }));
    } catch (e) {
      console.error('Gamification stats error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async (role) => {
    setLbLoading(true);
    try {
      const data = await gamificationAPI.getLeaderboard(role);
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
      setMyEntry(data.myEntry || null);
      setTotalUsers(data.totalUsers || 0);
    } catch (e) {
      console.error('Leaderboard error:', e);
    } finally {
      setLbLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    // recordLogin is now called by each dashboard on mount — no need to call it here again
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      loadLeaderboard(lbRole);
    }
  }, [activeTab, lbRole, loadLeaderboard]);

  const openClaim = (reward) => {
    setClaimReward(reward);
    setClaimForm({ fullName: user?.name || '', phone: '', address: '' });
    setClaimModal(true);
  };

  const submitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.fullName.trim() || !claimForm.phone.trim() || !claimForm.address.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setClaiming(true);
    try {
      await gamificationAPI.claimReward(
        claimReward.milestone,
        claimForm.fullName,
        claimForm.phone,
        claimForm.address,
      );
      toast.success('Reward claimed! We will ship it to you soon.');
      setClaimModal(false);
      loadStats();
    } catch (err) {
      toast.error(err.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading gamification…" />;

  const currentStreak = stats?.currentStreak || 0;
  const longestStreak = stats?.longestStreak || 0;
  const nextMilestone = stats?.nextMilestone;
  const daysToNext    = nextMilestone ? nextMilestone.milestone - currentStreak : null;

  const tabStyle = (t) => ({
    padding: '0.625rem 1.25rem',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === t ? '2px solid var(--primary, #84CC16)' : '2px solid transparent',
    color: activeTab === t ? 'var(--primary, #84CC16)' : '#6B7280',
    fontWeight: activeTab === t ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.15s',
  });

  return (
    <div>
      <PageHeader title="Gamification" subtitle="Streaks, rewards, and leaderboard" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '1.5rem' }}>
        <button style={tabStyle('streak')}      onClick={() => setActiveTab('streak')}>Streak & Rewards</button>
        <button style={tabStyle('leaderboard')} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
      </div>

      {/* ── STREAK TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'streak' && (
        <div>
          {/* Streak Hero */}
          <Card style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              {/* Flame + streak */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <StreakFlame streak={currentStreak} />
                <div>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>
                    {currentStreak > 0 ? `${currentStreak}-Day Streak!` : 'Start Your Streak'}
                  </h2>
                  <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                    Best: {longestStreak} days &nbsp;·&nbsp; {stats?.totalDaysActive || 0} total active days
                  </p>
                  {nextMilestone && daysToNext > 0 && (
                    <p style={{ margin: '8px 0 0', color: '#84CC16', fontSize: '0.85rem', fontWeight: 600 }}>
                      {daysToNext} more day{daysToNext !== 1 ? 's' : ''} to unlock {nextMilestone.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats pills */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Posts',       value: stats?.totalPosts || 0,       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                  { label: 'Connections', value: stats?.totalConnections || 0, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { label: 'Points',      value: stats?.rewardPoints || 0,     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.625rem 0.875rem', textAlign: 'center', minWidth: 72 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>{icon}</div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{value}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress to next milestone */}
            {nextMilestone && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                    Progress to {nextMilestone.name} ({nextMilestone.milestone} days)
                  </span>
                  <span style={{ color: '#84CC16', fontSize: '0.8rem', fontWeight: 600 }}>
                    {currentStreak}/{nextMilestone.milestone}
                  </span>
                </div>
                <ProgressBar current={currentStreak} target={nextMilestone.milestone} color="#84CC16" />
              </div>
            )}
          </Card>

          {/* How to earn streak */}
          <Card style={{ marginBottom: '1.5rem' }}>
            <CardHeader><CardTitle>How to Maintain Your Streak</CardTitle></CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              {[
                {
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                  title: 'Post Content',
                  desc: 'Share updates, insights, or opportunities',
                  points: '+10 pts',
                },
                {
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                  title: 'Make Connections',
                  desc: 'Accept or send connection requests',
                  points: '+15 pts',
                },
                {
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                  title: 'Daily Login',
                  desc: 'Simply log in and engage with the platform',
                  points: '+5 pts',
                },
              ].map(({ icon, title, desc, points }) => (
                <div key={title} style={{ padding: '1rem', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <div style={{ marginBottom: '0.5rem' }}>{icon}</div>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{title}</div>
                  <div style={{ color: '#6B7280', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '0.5rem' }}>{desc}</div>
                  <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{points}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Rewards */}
          <Card>
            <CardHeader><CardTitle>Streak Rewards</CardTitle></CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {STREAK_REWARDS.map(reward => {
                const userReward = (stats?.rewards || []).find(r => r.milestone === reward.milestone);
                return (
                  <RewardCard
                    key={reward.milestone}
                    reward={reward}
                    userReward={userReward}
                    onClaim={openClaim}
                  />
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── LEADERBOARD TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div>
          {/* Prize announcement scroll */}
          <LeaderboardAnnouncement user={user} />

          {/* Role selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {['founder', 'investor', 'provider'].map(role => (
              <button
                key={role}
                onClick={() => setLbRole(role)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 9999,
                  border: `2px solid ${lbRole === role ? '#84CC16' : '#E5E7EB'}`,
                  background: lbRole === role ? '#F0FDF4' : 'white',
                  color: lbRole === role ? '#166534' : '#6B7280',
                  fontWeight: lbRole === role ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          {/* My rank banner */}
          {myRank && (
            <div style={{
              background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
              border: '2px solid #84CC16',
              borderRadius: 12,
              padding: '0.875rem 1.25rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#84CC16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span style={{ fontWeight: 700, color: '#166534' }}>
                Your rank: #{myRank} out of {totalUsers} {ROLE_LABELS[lbRole]}s
              </span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{ROLE_LABELS[lbRole]} Leaderboard</CardTitle>
            </CardHeader>
            <LeaderboardTable data={leaderboard} currentUserId={user?._id} loading={lbLoading} />

            {/* Show current user's entry if they're outside the top list */}
            {myEntry && myRank && !leaderboard.some(e => e._id?.toString() === user?._id?.toString()) && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '2px dashed #E5E7EB' }}>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '0.5rem', textAlign: 'center' }}>
                  Your position
                </p>
                <LeaderboardTable data={[myEntry]} currentUserId={user?._id} loading={false} />
              </div>
            )}
          </Card>

          {/* Scoring explanation */}
          <Card style={{ marginTop: '1rem' }}>
            <CardHeader><CardTitle>How Scores Are Calculated</CardTitle></CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Connection',   pts: '×15', color: '#3B82F6' },
                { label: 'Post',         pts: '×10', color: '#10B981' },
                { label: 'Active Day',   pts: '×5',  color: '#F59E0B' },
                { label: 'Streak Day',   pts: '×3',  color: '#EF4444' },
              ].map(({ label, pts, color }) => (
                <div key={label} style={{ padding: '0.75rem', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color }}>{pts}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Claim Reward Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={claimModal}
        onClose={() => !claiming && setClaimModal(false)}
        title={`Claim: ${claimReward?.name || 'Reward'}`}
        maxWidth="480px"
      >
        <div style={{ marginBottom: '1rem', padding: '1rem', background: claimReward?.bg || '#F9FAFB', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{claimReward?.icon}</div>
          <p style={{ margin: 0, color: claimReward?.color || '#111827', fontWeight: 600 }}>{claimReward?.desc}</p>
        </div>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Please provide your delivery details. We'll ship your reward within 7–10 business days.
        </p>
        <form onSubmit={submitClaim}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Your full name"
              value={claimForm.fullName}
              onChange={e => setClaimForm(p => ({ ...p, fullName: e.target.value }))}
              required
              disabled={claiming}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Phone Number *</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+91 98765 43210"
              value={claimForm.phone}
              onChange={e => setClaimForm(p => ({ ...p, phone: e.target.value }))}
              required
              disabled={claiming}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Delivery Address *</label>
            <textarea
              className="form-textarea"
              placeholder="Full delivery address including city, state, and PIN code"
              value={claimForm.address}
              onChange={e => setClaimForm(p => ({ ...p, address: e.target.value }))}
              rows={3}
              required
              disabled={claiming}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={claiming}>
              {claiming ? 'Submitting…' : 'Submit Claim'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setClaimModal(false)} disabled={claiming}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
