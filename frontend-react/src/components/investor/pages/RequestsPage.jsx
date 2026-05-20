import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { investorAPI } from '../../../services/api';
import { CornerUpRight, Inbox, MessageCircle } from '../../shared/Icons';

const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: '#FEF3C7', color: '#92400E' },
    accepted: { bg: '#D1FAE5', color: '#065F46' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ padding: '3px 10px', background: s.bg, color: s.color, borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
};

const Avatar = ({ src, name, size = 52 }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=3B82F6&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <img src={url} alt={name} onError={e => { e.target.src = fb; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
  );
};

export default function RequestsPage({ setRequestsCount }) {
  const [tab, setTab]       = useState('sent');
  const [all, setAll]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await investorAPI.getMyRequests();
      setAll(data);
      // Investors don't receive incoming requests in the same way — they send them
      // But update badge for any pending sent requests
      if (setRequestsCount) {
        setRequestsCount(data.filter(r => r.initiator === 'investor' && r.status === 'pending').length);
      }
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading requests…" />;

  // Investors send requests as 'investor' initiator; incoming = 'founder' initiator
  const sent     = all.filter(r => r.initiator === 'investor');
  const incoming = all.filter(r => r.initiator === 'founder');
  const list     = tab === 'sent' ? sent : incoming;

  const tabStyle = (t) => ({
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: tab === t ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.95rem',
    marginBottom: '-2px',
  });

  return (
    <div>
      <PageHeader title="Connection Requests" subtitle="Manage your sent and incoming requests" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color, #E5E7EB)', marginBottom: '1.5rem' }}>
        <button style={tabStyle('sent')} onClick={() => setTab('sent')}>
          <CornerUpRight size={15} style={{ marginRight: 4 }} /> Sent ({sent.length})
        </button>
        <button style={tabStyle('incoming')} onClick={() => setTab('incoming')}>
          <Inbox size={15} style={{ marginRight: 4 }} /> Incoming ({incoming.length})
        </button>
      </div>

      {list.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No {tab} requests yet.
            {tab === 'sent' && (
              <span> Browse <a href="#startups" style={{ color: 'var(--primary)' }}>validated startups</a> to send requests.</span>
            )}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {list.map(req => {
            const founder = req.founderId || {};
            const startup = req.startupId || {};

            return (
              <Card key={req._id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <Avatar src={founder.profilePicture} name={founder.name} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {startup.name || 'Unknown Startup'}
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {tab === 'sent' ? `Founder: ${founder.name || 'Unknown'}` : `From: ${founder.name || 'Unknown'}`}
                          {startup.industry ? ` · ${startup.industry}` : ''}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          {timeAgo(req.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    {req.message && (
                      <p style={{
                        margin: '0.6rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)',
                        padding: '0.65rem 0.875rem', background: 'var(--bg-hover, #F9FAFB)',
                        borderRadius: 8, lineHeight: 1.5, fontStyle: 'italic',
                      }}>
                        "{req.message}"
                      </p>
                    )}

                    {req.status === 'accepted' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => { window.location.hash = 'chat'; }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <MessageCircle size={14} /> Chat with Founder
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
