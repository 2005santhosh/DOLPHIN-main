import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card, { CardHeader, CardTitle } from '../../shared/Card';
import StatCard from '../../shared/StatCard';
import LoadingSpinner from '../../shared/LoadingSpinner';
import { investorAPI } from '../../../services/api';

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: '#FEF3C7', color: '#92400E' },
    accepted: { bg: '#D1FAE5', color: '#065F46' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ padding: '3px 10px', background: s.bg, color: s.color, borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
};

export default function DashboardPage() {
  const [startups, setStartups] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [sRes, wRes, rRes] = await Promise.allSettled([
      investorAPI.getValidatedStartups(),
      investorAPI.getWatchlist(),
      investorAPI.getMyRequests(),
    ]);
    if (sRes.status === 'fulfilled') setStartups(sRes.value);
    if (wRes.status === 'fulfilled') setWatchlist(wRes.value);
    if (rRes.status === 'fulfilled') setRequests(rRes.value);
    setLoading(false);
  };

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  const highestScore = startups.reduce((max, s) => Math.max(max, s.validationScore || 0), 0);
  const recentRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your investment overview" />

      {/* Stats */}
      <div className="grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard value={startups.length}   label="Validated Startups" index={0} />
        <StatCard value={`${highestScore}%`} label="Highest Score"     index={1} />
        <StatCard value={watchlist.length}  label="Watchlist"          index={2} />
      </div>

      {/* Quick Actions */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <a href="#startups" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%' }}>Browse Startups</button>
          </a>
          <a href="#watchlist" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }}>View Watchlist</button>
          </a>
          <a href="#requests" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }}>View Requests</button>
          </a>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        {recentRequests.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No recent activity. Start by browsing validated startups!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentRequests.map(req => (
              <div key={req._id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.875rem 1rem', background: 'var(--bg-hover, #F9FAFB)',
                borderRadius: 8, gap: '1rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.startupId?.name || 'Unknown Startup'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {req.initiator === 'investor' ? 'You sent a request' : 'Incoming request'} · {timeAgo(req.createdAt)}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
