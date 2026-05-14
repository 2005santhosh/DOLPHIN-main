import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { providerAPI } from '../../../services/api';

// ─── helpers ──────────────────────────────────────────────────────────────────

const avatarUrl = (name, pic) => {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=84CC16&color=fff&size=128`;
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

const StatusBadge = ({ status }) => {
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
      fontSize: '0.78rem',
      fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
};

// ─── component ────────────────────────────────────────────────────────────────

const RequestsPage = ({ setRequestsCount }) => {
  const [activeTab, setActiveTab]         = useState('incoming');
  const [incoming, setIncoming]           = useState([]);
  const [sent, setSent]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [processing, setProcessing]       = useState({});

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const all = await providerAPI.getMyRequests();

      const incomingList = all.filter(r => r.initiator === 'founder');
      const sentList     = all.filter(r => r.initiator === 'provider');

      setIncoming(incomingList);
      setSent(sentList);

      if (setRequestsCount) {
        setRequestsCount(incomingList.filter(r => r.status === 'pending').length);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (requestId, status) => {
    setProcessing(prev => ({ ...prev, [requestId]: true }));
    try {
      await providerAPI.updateIntroRequest(requestId, status);
      toast.success(`Request ${status}!`);
      loadRequests();
    } catch (error) {
      toast.error(error?.message || 'Failed to update request');
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (loading) return <LoadingSpinner message="Loading requests…" />;

  const pendingIncomingCount = incoming.filter(r => r.status === 'pending').length;
  const currentList = activeTab === 'incoming' ? incoming : sent;

  const tabStyle = (tab) => ({
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '-2px',
    position: 'relative',
    fontSize: '0.95rem',
  });

  return (
    <div>
      <PageHeader
        title="Connection Requests"
        subtitle="Manage your incoming and sent proposals"
      />

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color, #E5E7EB)',
      }}>
        <button style={tabStyle('incoming')} onClick={() => setActiveTab('incoming')}>
          📥 Incoming
          {pendingIncomingCount > 0 && (
            <span style={{
              position: 'absolute', top: 8, right: 4,
              background: '#EF4444', color: 'white',
              borderRadius: '9999px', padding: '1px 5px',
              fontSize: '0.65rem', fontWeight: 700, minWidth: 16, textAlign: 'center',
            }}>
              {pendingIncomingCount}
            </span>
          )}
        </button>
        <button style={tabStyle('sent')} onClick={() => setActiveTab('sent')}>
          📤 Sent
        </button>
      </div>

      {/* Stats row */}
      {activeTab === 'incoming' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total',    value: incoming.length,                                    color: '#6B7280' },
            { label: 'Pending',  value: incoming.filter(r => r.status === 'pending').length,  color: '#92400E' },
            { label: 'Accepted', value: incoming.filter(r => r.status === 'accepted').length, color: '#065F46' },
            { label: 'Rejected', value: incoming.filter(r => r.status === 'rejected').length, color: '#991B1B' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-surface, white)',
              border: '1px solid var(--border-color, #E5E7EB)',
              borderRadius: 8,
              fontSize: '0.85rem',
              color,
              fontWeight: 600,
            }}>
              {label}: {value}
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {currentList.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No {activeTab} requests yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {currentList.map((req) => {
            const isIncoming = req.initiator === 'founder';
            const person     = req.founderId;
            const startup    = req.startupId;
            const personName = person?.name || 'Unknown';
            const personPic  = person?.profilePicture;

            return (
              <Card key={req._id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <img
                    src={avatarUrl(personName, personPic)}
                    alt={personName}
                    style={{
                      width: 56, height: 56, borderRadius: '50%',
                      objectFit: 'cover', border: '2px solid var(--border-color)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {personName}
                        </h4>
                        {startup?.name && (
                          <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {startup.name}
                            {startup.industry ? ` · ${startup.industry}` : ''}
                          </p>
                        )}
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                          {formatDate(req.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    {/* Services offered */}
                    {req.servicesOffered && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <strong>Services:</strong> {req.servicesOffered}
                      </p>
                    )}

                    {/* Message */}
                    {req.message && (
                      <p style={{
                        margin: '0.6rem 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        padding: '0.65rem 0.875rem',
                        background: 'var(--bg-surface-2, #F9FAFB)',
                        borderRadius: 8,
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}>
                        "{req.message}"
                      </p>
                    )}

                    {/* Actions */}
                    {isIncoming && req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleUpdate(req._id, 'accepted')}
                          disabled={processing[req._id]}
                          style={{ flex: 1 }}
                        >
                          {processing[req._id] ? 'Processing…' : '✓ Accept'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUpdate(req._id, 'rejected')}
                          disabled={processing[req._id]}
                          style={{ flex: 1 }}
                        >
                          {processing[req._id] ? 'Processing…' : '✕ Reject'}
                        </button>
                      </div>
                    )}

                    {isIncoming && req.status === 'accepted' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => { window.location.hash = 'chat'; }}
                        >
                          💬 Chat
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
};

export default RequestsPage;
