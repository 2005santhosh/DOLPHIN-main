import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI, connectionsAPI } from '../../../services/api';
import { Inbox, CornerUpRight, MessageCircle } from '../../shared/Icons';

const timeAgo = (dateStr) => {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: '#FEF3C7', color: '#D97706' },
    accepted: { bg: '#D1FAE5', color: '#059669' },
    rejected: { bg: '#FEE2E2', color: '#DC2626' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const Avatar = ({ src, name, size = 52 }) => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fallback;
  return (
    <img
      src={url} alt={name}
      onError={(e) => { e.target.src = fallback; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }}
    />
  );
};

export default function RequestsPage({ setRequestsCount }) {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Load both Connection model requests AND IntroRequest model requests in parallel
      const [connData, introIncoming, introSent] = await Promise.all([
        connectionsAPI.getConnections().catch(() => ({ incoming: [], sent: [] })),
        founderAPI.getIncomingRequests().catch(() => []),
        founderAPI.getSentRequests().catch(() => []),
      ]);

      // Normalise Connection model entries
      const connIncoming = (connData.incoming || []).map(c => ({
        _id: c._id,
        type: 'connection',
        status: c.status,
        createdAt: c.createdAt,
        message: c.message || '',
        otherUser: c.otherUser || {},
      }));

      const connSent = (connData.sent || []).map(c => ({
        _id: c._id,
        type: 'connection',
        status: c.status,
        createdAt: c.createdAt,
        message: c.message || '',
        otherUser: c.otherUser || {},
      }));

      // Normalise IntroRequest model entries
      const introIncomingNorm = (Array.isArray(introIncoming) ? introIncoming : []).map(r => ({
        _id: r._id,
        type: 'intro',
        status: r.status,
        createdAt: r.createdAt,
        message: r.message || '',
        otherUser: r.providerId || {},
        startupName: r.startupId?.name || '',
      }));

      const introSentNorm = (Array.isArray(introSent) ? introSent : []).map(r => ({
        _id: r._id,
        type: 'intro',
        status: r.status,
        createdAt: r.createdAt,
        message: r.message || '',
        otherUser: r.providerId || {},
        startupName: r.startupId?.name || '',
      }));

      // Merge and sort by date (newest first)
      const allIncoming = [...connIncoming, ...introIncomingNorm]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const allSent = [...connSent, ...introSentNorm]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIncoming(allIncoming);
      setSent(allSent);

      const pendingCount = allIncoming.filter(r => r.status === 'pending').length;
      if (setRequestsCount) setRequestsCount(pendingCount);
    } catch (err) {
      console.error('Requests load error:', err);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const acceptConnection = async (req) => {
    setBusy(p => ({ ...p, [req._id]: true }));
    try {
      if (req.type === 'connection') {
        await connectionsAPI.updateConnection(req._id, 'accepted');
      } else {
        await founderAPI.acceptRequest(req._id);
      }
      toast.success('Request accepted!');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  const rejectConnection = async (req) => {
    if (!window.confirm('Reject this request?')) return;
    setBusy(p => ({ ...p, [req._id]: true }));
    try {
      if (req.type === 'connection') {
        await connectionsAPI.updateConnection(req._id, 'rejected');
      } else {
        await founderAPI.rejectRequest(req._id);
      }
      toast.success('Request rejected');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  if (loading) return <LoadingSpinner message="Loading requests..." />;

  const list = tab === 'incoming' ? incoming : sent;
  const pendingCount = incoming.filter(r => r.status === 'pending').length;

  const tabStyle = (t) => ({
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: tab === t ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    position: 'relative',
  });

  return (
    <div>
      <PageHeader title="Connection Requests" subtitle="Manage your incoming and sent connection requests" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button style={tabStyle('incoming')} onClick={() => setTab('incoming')}>
          <Inbox size={16} /> Incoming
          {pendingCount > 0 && (
            <span style={{ marginLeft: '6px', background: 'var(--error)', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button style={tabStyle('sent')} onClick={() => setTab('sent')}>
          <CornerUpRight size={16} /> Sent
        </button>
      </div>

      {list.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
            No {tab} requests yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {list.map((req) => {
            const other = req.otherUser || {};
            const otherName = other.name || 'Unknown';
            const otherPic = other.profilePicture || '';
            const otherRole = other.role || '';

            return (
              <Card key={`${req.type}-${req._id}`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <Avatar src={otherPic} name={otherName} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{otherName}</h4>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                          {otherRole && <span style={{ textTransform: 'capitalize' }}>{otherRole}</span>}
                          {otherRole && req.startupName && ' · '}
                          {req.startupName}
                          {' · '}
                          {timeAgo(req.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    {req.message && (
                      <p style={{
                        fontSize: '0.9rem', color: 'var(--text-secondary)',
                        padding: '0.75rem', background: 'var(--bg-hover)',
                        borderRadius: 'var(--radius-md)', margin: '0.75rem 0',
                        lineHeight: 1.5, borderLeft: '3px solid var(--border-color)',
                      }}>
                        "{req.message}"
                      </p>
                    )}

                    {tab === 'incoming' && req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => acceptConnection(req)}
                          disabled={busy[req._id]}
                          style={{ flex: 1 }}
                        >
                          {busy[req._id] ? 'Processing…' : '✓ Accept'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => rejectConnection(req)}
                          disabled={busy[req._id]}
                          style={{ flex: 1 }}
                        >
                          {busy[req._id] ? 'Processing…' : '✕ Reject'}
                        </button>
                      </div>
                    )}

                    {req.status === 'accepted' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => { window.location.hash = `chat?userId=${req.otherUser?._id || req.otherUser}`; }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <MessageCircle size={14} /> Chat
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
