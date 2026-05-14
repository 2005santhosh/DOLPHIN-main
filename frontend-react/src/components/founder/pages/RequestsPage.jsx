import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI } from '../../../services/api';

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

const Avatar = ({ src, name, size = 56 }) => {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fallback;
  return (
    <img
      src={url}
      alt={name}
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
      const [inc, snt] = await Promise.all([
        founderAPI.getIncomingRequests(),
        founderAPI.getSentRequests(),
      ]);
      // Both return plain arrays now
      const incArr = Array.isArray(inc) ? inc : [];
      const sntArr = Array.isArray(snt) ? snt : [];
      setIncoming(incArr);
      setSent(sntArr);
      const pending = incArr.filter(r => r.status === 'pending').length;
      if (setRequestsCount) setRequestsCount(pending);
    } catch (err) {
      console.error('Requests load error:', err);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const accept = async (id) => {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await founderAPI.acceptRequest(id);
      toast.success('Request accepted!');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  const reject = async (id) => {
    if (!window.confirm('Reject this request?')) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await founderAPI.rejectRequest(id);
      toast.success('Request rejected');
      load();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  if (loading) return <LoadingSpinner message="Loading requests..." />;

  const list = tab === 'incoming' ? incoming : sent;
  const pendingCount = incoming.filter(r => r.status === 'pending').length;

  return (
    <div>
      <PageHeader title="Connection Requests" subtitle="Manage your incoming and sent connection requests" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {[
          { key: 'incoming', label: '📥 Incoming', badge: pendingCount },
          { key: 'sent', label: '📤 Sent' },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer',
              position: 'relative',
              fontSize: '0.95rem',
            }}
          >
            {label}
            {badge > 0 && (
              <span style={{
                marginLeft: '6px', background: 'var(--error)', color: 'white',
                borderRadius: '9999px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700,
              }}>
                {badge}
              </span>
            )}
          </button>
        ))}
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
            // Backend: incoming → providerId is the sender; sent → providerId is the recipient
            const other = req.providerId || {};
            const otherName = other.name || 'Unknown';
            const otherPic = other.profilePicture || '';

            return (
              <Card key={req._id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <Avatar src={otherPic} name={otherName} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{otherName}</h4>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                          {timeAgo(req.createdAt)}
                          {req.startupId?.name && ` · ${req.startupId.name}`}
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
                          onClick={() => accept(req._id)}
                          disabled={busy[req._id]}
                          style={{ flex: 1 }}
                        >
                          {busy[req._id] ? 'Processing…' : '✓ Accept'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => reject(req._id)}
                          disabled={busy[req._id]}
                          style={{ flex: 1 }}
                        >
                          {busy[req._id] ? 'Processing…' : '✕ Reject'}
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
