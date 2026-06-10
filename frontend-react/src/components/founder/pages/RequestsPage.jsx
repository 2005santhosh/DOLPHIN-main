import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI, connectionsAPI } from '../../../services/api';
import { Inbox, CornerUpRight, MessageCircle } from '../../shared/Icons';
import VerifiedBadge from '../../shared/VerifiedBadge';

function isPaidVerified(u) {
  return u?.isVerified === true && u?.verifiedSource === 'payment' && !!u?.verifiedUntil && new Date(u.verifiedUntil) > new Date();
}

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
    <img src={url} alt={name} onError={(e) => { e.target.src = fallback; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
  );
};

export default function RequestsPage({ setRequestsCount }) {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [connections, setConnections] = useState([]); // accepted connections
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [connData, introIncoming, introSent] = await Promise.all([
        connectionsAPI.getConnections().catch(() => ({ incoming: [], sent: [] })),
        founderAPI.getIncomingRequests().catch(() => []),
        founderAPI.getSentRequests().catch(() => []),
      ]);

      const connIncoming = (connData.incoming || []).map(c => ({
        _id: c._id, type: 'connection', status: c.status, createdAt: c.createdAt,
        message: c.message || '', otherUser: c.otherUser || {},
      }));
      const connSent = (connData.sent || []).map(c => ({
        _id: c._id, type: 'connection', status: c.status, createdAt: c.createdAt,
        message: c.message || '', otherUser: c.otherUser || {},
      }));

      const introIncomingNorm = (Array.isArray(introIncoming) ? introIncoming : []).map(r => ({
        _id: r._id, type: 'intro', status: r.status, createdAt: r.createdAt,
        message: r.message || '',
        // providerId can be a populated object or a raw ObjectId
        otherUser: (r.providerId && typeof r.providerId === 'object' && r.providerId._id)
          ? r.providerId
          : { _id: r.providerId, name: 'Provider', role: 'provider' },
        startupName: r.startupId?.name || '',
      }));
      const introSentNorm = (Array.isArray(introSent) ? introSent : []).map(r => ({
        _id: r._id, type: 'intro', status: r.status, createdAt: r.createdAt,
        message: r.message || '',
        otherUser: (r.providerId && typeof r.providerId === 'object' && r.providerId._id)
          ? r.providerId
          : { _id: r.providerId, name: 'Provider', role: 'provider' },
        startupName: r.startupId?.name || '',
      }));

      const allIncoming = [...connIncoming, ...introIncomingNorm]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const allSent = [...connSent, ...introSentNorm]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Collect all accepted connections for the Connections tab
      const acceptedFromIncoming = connIncoming.filter(r => r.status === 'accepted');
      const acceptedFromSent = connSent.filter(r => r.status === 'accepted');
      const acceptedIntroIncoming = introIncomingNorm.filter(r => r.status === 'accepted');
      const acceptedIntroSent = introSentNorm.filter(r => r.status === 'accepted');

      // Deduplicate by user ID — handle both populated objects and raw ObjectIds
      const seen = new Set();
      const allAccepted = [
        ...acceptedFromIncoming, ...acceptedFromSent,
        ...acceptedIntroIncoming, ...acceptedIntroSent,
      ].filter(r => {
        const uid = (r.otherUser?._id || r.otherUser)?.toString();
        if (!uid || uid === 'undefined' || uid === '[object Object]' || seen.has(uid)) return false;
        seen.add(uid);
        return true;
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIncoming(allIncoming);
      setSent(allSent);
      setConnections(allAccepted);

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
      if (req.type === 'connection') await connectionsAPI.updateConnection(req._id, 'accepted');
      else await founderAPI.acceptRequest(req._id);
      toast.success('Request accepted!');
      window.dispatchEvent(new CustomEvent('connection-accepted'));
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  const rejectConnection = async (req) => {
    if (!window.confirm('Reject this request?')) return;
    setBusy(p => ({ ...p, [req._id]: true }));
    try {
      if (req.type === 'connection') await connectionsAPI.updateConnection(req._id, 'rejected');
      else await founderAPI.rejectRequest(req._id);
      toast.success('Request rejected');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [req._id]: false })); }
  };

  if (loading) return <LoadingSpinner message="Loading requests..." />;

  const list = tab === 'incoming' ? incoming : tab === 'sent' ? sent : connections;
  const pendingCount = incoming.filter(r => r.status === 'pending').length;

  const tabStyle = (t) => ({
    padding: '0.75rem 1.25rem',
    background: 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    color: tab === t ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: tab === t ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    position: 'relative',
    whiteSpace: 'nowrap',
  });

  return (
    <div>
      <PageHeader title="Requests & Connections" subtitle="Manage your requests and view all your connections" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <button style={tabStyle('incoming')} onClick={() => setTab('incoming')}>
          <Inbox size={15} /> Incoming
          {pendingCount > 0 && (
            <span style={{ background: '#EF4444', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button style={tabStyle('sent')} onClick={() => setTab('sent')}>
          <CornerUpRight size={15} /> Sent
        </button>
        <button style={tabStyle('connections')} onClick={() => setTab('connections')}>
          {/* People icon */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          My Connections
          {connections.length > 0 && (
            <span style={{ background: '#84CC16', color: 'white', borderRadius: '9999px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
              {connections.length}
            </span>
          )}
        </button>
      </div>

      {/* Connections tab — grid of connected people */}
      {tab === 'connections' && (
        connections.length === 0 ? (
          <Card>
            <p style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              No connections yet. Accept requests to build your network!
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {connections.map((conn) => {
              const person = conn.otherUser || {};
              const name = person.name || 'User';
              return (
                <Card key={conn._id} style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Avatar src={person.profilePicture} name={name} size={64} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{name}</span>
                        {isPaidVerified(person) && <VerifiedBadge size={14} />}
                      </div>
                      {person.role && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'capitalize', background: 'var(--bg-hover)', padding: '2px 10px', borderRadius: 9999 }}>
                          {person.role}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      onClick={() => { window.location.hash = `chat?userId=${person._id}`; }}
                    >
                      <MessageCircle size={14} /> Chat
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Incoming / Sent tabs */}
      {tab !== 'connections' && (
        list.length === 0 ? (
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
              return (
                <Card key={`${req.type}-${req._id}`} style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <Avatar src={other.profilePicture} name={otherName} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{otherName}</h4>
                            {isPaidVerified(other) && <VerifiedBadge size={14} />}
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            {other.role && <span style={{ textTransform: 'capitalize' }}>{other.role}</span>}
                            {other.role && req.startupName && ' · '}
                            {req.startupName}
                            {' · '}
                            {timeAgo(req.createdAt)}
                          </p>
                        </div>
                        <StatusBadge status={req.status} />
                      </div>

                      {req.message && (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', margin: '0.75rem 0', lineHeight: 1.5, borderLeft: '3px solid var(--border-color)' }}>
                          "{req.message}"
                        </p>
                      )}

                      {tab === 'incoming' && req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => acceptConnection(req)} disabled={busy[req._id]} style={{ flex: 1 }}>
                            {busy[req._id] ? 'Processing…' : '✓ Accept'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => rejectConnection(req)} disabled={busy[req._id]} style={{ flex: 1 }}>
                            {busy[req._id] ? 'Processing…' : '✕ Reject'}
                          </button>
                        </div>
                      )}

                      {req.status === 'accepted' && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <button className="btn btn-primary btn-sm"
                            onClick={() => { window.location.hash = `chat?userId=${req.otherUser?._id || req.otherUser}`; }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
        )
      )}
    </div>
  );
}
