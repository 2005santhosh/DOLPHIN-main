import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import StatCard from '../../shared/StatCard';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { providerAPI } from '../../../services/api';

const DashboardPage = () => {
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [foundersCount, setFoundersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [profileData, requestsData, foundersData] = await Promise.allSettled([
        providerAPI.getMyProfile(),
        providerAPI.getMyRequests(),
        providerAPI.getEligibleFounders(),
      ]);

      if (profileData.status === 'fulfilled') {
        setProfile(profileData.value);
        setProfileMissing(false);
      } else {
        const err = profileData.reason;
        if (err?.status === 404) {
          setProfileMissing(true);
        }
      }

      if (requestsData.status === 'fulfilled') {
        setRequests(requestsData.value);
      }

      if (foundersData.status === 'fulfilled') {
        const arr = foundersData.value;
        setFoundersCount(Array.isArray(arr) ? arr.length : 0);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const map = {
      pending:  { bg: '#FEF3C7', color: '#92400E' },
      accepted: { bg: '#D1FAE5', color: '#065F46' },
      rejected: { bg: '#FEE2E2', color: '#991B1B' },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{
        display: 'inline-block',
        padding: '3px 10px',
        background: s.bg,
        color: s.color,
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}>
        {status}
      </span>
    );
  };

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  // Computed stats
  const acceptedCount = requests.filter(r => r.status === 'accepted').length;
  const closedCount   = requests.filter(r => r.status === 'accepted' || r.status === 'rejected').length;
  const responseRate  = closedCount > 0 ? Math.round((acceptedCount / closedCount) * 100) : 0;
  const avgRating     = profile?.avgRating ? Number(profile.avgRating).toFixed(1) : '—';
  const recentActivity = [...requests]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  if (profileMissing) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          subtitle="Welcome to your provider dashboard"
        />
        <Card style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Complete Your Profile First
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            You need to set up your provider profile before you can access the dashboard features.
          </p>
          <a href="#profile" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary">Set Up Profile</button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back${profile?.name ? `, ${profile.name}` : ''}! Here's your provider overview.`}
      />

      {/* Stats Grid */}
      <div className="grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard value={acceptedCount}    label="Active Engagements" index={0} />
        <StatCard value={foundersCount}    label="Eligible Founders"  index={1} />
        <StatCard value={`${responseRate}%`} label="Response Rate"   index={2} />
        <StatCard value={avgRating}        label="Avg Rating"         index={3} />
      </div>

      {/* Quick Actions */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <a href="#founders" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%' }}>Browse Founders</button>
          </a>
          <a href="#profile" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }}>Update Profile</button>
          </a>
          <a href="#requests" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }}>View Requests</button>
          </a>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        {recentActivity.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No recent activity yet. Start by browsing eligible founders!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivity.map((req) => (
              <div
                key={req._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.875rem 1rem',
                  background: 'var(--bg-surface-2, #F9FAFB)',
                  borderRadius: 'var(--radius-md, 8px)',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {req.startupId?.name || 'Unknown Startup'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {req.initiator === 'provider' ? 'You sent a request' : 'Incoming request'} · {formatDate(req.createdAt)}
                  </p>
                </div>
                {getStatusBadge(req.status)}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
