import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { investorAPI, connectionsAPI } from '../../../services/api';
import { CornerUpRight, Inbox, MessageCircle } from '../../shared/Icons';
import VerifiedBadge from '../../shared/VerifiedBadge';

function isPaidVerified(u) {
  return u?.isVerified === true && u?.verifiedSource === 'payment' && !!u?.verifiedUntil && new Date(u.verifiedUntil) > new Date();
}

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
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [connData, introRequests] = await Promise.all([
        connectionsAPI.getConnections().catch(() => ({ incoming: [], sent: [] })),
        investorAPI.getMyRequests().catch(() => []),
      ]);

      // Connection model entries
      const connIncoming = (connData.incoming || []).map(c => ({
        _id: c._id, type: 'connection', status: c.status, createdAt: c.createdAt,
        message: c.message || '', otherUser: c.otherUser || {},
      }));
      const connSent = (connData.sent || []).map(c => ({
        _id: c._id, type: 'connection', status: c.status, createdAt: c.createdAt,
        message: c.message || '', otherUser: c.otherUser || {},
      }));

      // IntroRequest model entries
      const introArr = Array.isArray(introRequests) ? introRequests : [];
      const introSent = introArr.filter(r => r.initiator === 'investor').map(r => ({
        _id: r._id, type: 'intro', status: r.status, createdAt: r.createdAt,
        message: r.message || '',
        otherUser: r.founderId || {},
        startupName: (r.startupId?.name) || '',
        startupIndustry: (r.startupId?.industry) || '',
      }));
      const introIncoming = introArr.filter(r => r.initiator === 'founder').map(r => ({
        _id: r._id, type: 'intro', status: r.status, createdAt: r.createdAt,
        message: r.message || '',
        otherUser: r.founderId || {},
        startupName: (r.startupId?.name) || '',
      }));

      const allIncoming = [...connIncoming, ...introIncoming]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const allSent = [...connSent, ...introSent]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIncoming(allIncoming);
      setSent(allSent);

      if (setRequestsCount) {
        setRequestsCount(allIncoming.filter(r => r.status === 'pending').length);
      }
    } catch (err) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const acceptConn = async (req) => {
    setBusy(p => ({ ...p, [req._id]: true }));
    try {
      await connectionsAPI.updateConnection(req._id, 'accepted');
      toast.success('Request accepted!');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  const rejectConn = async (req) => {
    if (!window.confirm('Reject this request?')) return;
    setBusy(p => ({ ...p, [req._id]: true }));
    try {
      await connectionsAPI.updateConnection(req._id, 'rejected');
      toast.success('Request rejected');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  if (loading) return <LoadingSpinner message="Loading requests…" />;

  const list = tab === 'sent' ? sent : incoming;
  const pendingIncoming = incoming.filter(r => r.status === 'pending').length;

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
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  });

  return (
    <div>
      <PageHeader title="Connection Requests" subtitle="Manage your sent and incoming requests" />

      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color, #E5E7EB)', marginBottom: '1.5rem' }}>
        <button style={tabStyle('sent')} onClick={() => setTab('sent')}>
          <CornerUpRight size={15} /> Sent ({sent.length})
        </button>
        <button style={tabStyle('incoming')} onClick={() => setTab('incoming')}>
          <Inbox size={15} /> Incoming ({incoming.length})
          {pendingIncoming > 0 && (
            <span style={{ marginLeft: 4, background: '#EF4444', color: 'white', borderRadius: 9999, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700 }}>
              {pendingIncoming}
            </span>
          )}
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
            const other = req.otherUser || {};
            const otherName = other.name || 'Unknown';

            return (
              <Card key={`${req.type}-${req._id}`} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <Avatar src={other.profilePicture} name={otherName} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {req.startupName || otherName}
                          </h4>
                          {isPaidVerified(other) && <VerifiedBadge size={14} />}
                        </div>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {req.startupName ? `Founder: ${otherName}` : (other.role || '')}
                          {req.startupIndustry ? ` · ${req.startupIndustry}` : ''}
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

                    {/* Accept/Reject for incoming connection requests */}
                    {tab === 'incoming' && req.type === 'connection' && req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => acceptConn(req)} disabled={busy[req._id]} style={{ flex: 1 }}>
                          {busy[req._id] ? 'Processing…' : '✓ Accept'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => rejectConn(req)} disabled={busy[req._id]} style={{ flex: 1 }}>
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
