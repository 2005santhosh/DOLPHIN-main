import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { providerAPI } from '../../../services/api';
import { INDUSTRIES } from '../../../constants/industries';
import FeaturedBadge from '../../shared/FeaturedBadge';

// ─── helpers ──────────────────────────────────────────────────────────────────

// Payment-only verified check
function isFounderPaymentVerified(founder) {
  const u = founder?.founderId || founder;
  return (
    u?.isVerified === true &&
    u?.verifiedSource === 'payment' &&
    !!u?.verifiedUntil &&
    new Date(u.verifiedUntil) > new Date()
  );
}

const avatarUrl = (name, pic) => {
  if (pic) return pic;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=84CC16&color=fff&size=128`;
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    accepted: { bg: '#D1FAE5', color: '#065F46', label: 'Connected' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
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
    }}>
      {s.label}
    </span>
  );
};

// ─── component ────────────────────────────────────────────────────────────────

const FoundersPage = () => {
  const [founders, setFounders]               = useState([]);
  const [sentRequests, setSentRequests]       = useState({}); // startupId → request
  const [loading, setLoading]                 = useState(true);
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('all');

  // Detail modal
  const [detailOpen, setDetailOpen]           = useState(false);
  const [detailFounder, setDetailFounder]     = useState(null);

  // Send-request modal
  const [requestOpen, setRequestOpen]         = useState(false);
  const [requestFounder, setRequestFounder]   = useState(null);
  const [reqMessage, setReqMessage]           = useState('');
  const [reqServices, setReqServices]         = useState('');
  const [sending, setSending]                 = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [foundersRes, requestsRes] = await Promise.allSettled([
        providerAPI.getEligibleFounders(),
        providerAPI.getMyRequests(),
      ]);

      if (foundersRes.status === 'fulfilled') {
        setFounders(foundersRes.value);
      } else {
        toast.error('Failed to load founders');
      }

      if (requestsRes.status === 'fulfilled') {
        // Build a map: startupId (string) → request
        // Include ALL requests (both sent by provider and incoming from founder)
        // so we can show "Connected" regardless of who initiated
        const map = {};
        for (const req of requestsRes.value) {
          const sid = req.startupId?._id?.toString() || req.startupId?.toString();
          if (!sid) continue;
          // Prefer accepted > pending > rejected when multiple requests exist for same startup
          const existing = map[sid];
          if (!existing) {
            map[sid] = req;
          } else {
            const priority = { accepted: 3, pending: 2, rejected: 1 };
            if ((priority[req.status] || 0) > (priority[existing.status] || 0)) {
              map[sid] = req;
            }
          }
        }
        setSentRequests(map);
      }
    } finally {
      setLoading(false);
    }
  };

  // Use the full static industry list so all options are always available
  const industries = useMemo(() => ['all', ...INDUSTRIES], []);

  // ── filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = founders;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f =>
        f.startupName?.toLowerCase().includes(q) ||
        f.founderId?.name?.toLowerCase().includes(q) ||
        f.industry?.toLowerCase().includes(q)
      );
    }
    if (selectedIndustry !== 'all') {
      list = list.filter(f => f.industry === selectedIndustry);
    }
    return list;
  }, [founders, searchQuery, selectedIndustry]);

  // ── send request ─────────────────────────────────────────────────────────────
  const openRequestModal = (founder) => {
    setRequestFounder(founder);
    setReqMessage('');
    setReqServices('');
    setRequestOpen(true);
  };

  const handleSendRequest = async () => {
    if (!reqMessage.trim() || !reqServices.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      await providerAPI.sendProviderRequest(requestFounder._id, reqMessage.trim(), reqServices.trim());
      toast.success('Request sent successfully!');
      setRequestOpen(false);
      loadAll(); // refresh to update button states
    } catch (error) {
      toast.error(error?.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  // ── action button logic ───────────────────────────────────────────────────────
  const renderActionButtons = (founder) => {
    const req = sentRequests[founder._id?.toString() || founder._id];

    if (!req) {
      return (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => openRequestModal(founder)}
        >
          Send Request
        </button>
      );
    }

    if (req.status === 'pending') {
      return (
        <button className="btn btn-secondary btn-sm" disabled>
          Pending
        </button>
      );
    }

    if (req.status === 'accepted') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <button className="btn btn-secondary btn-sm" disabled style={{ background: '#D1FAE5', color: '#065F46', border: 'none' }}>
            ✓ Connected
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const userId = founder.founderId?._id || founder.founderId;
              window.location.hash = `chat?userId=${userId}`;
            }}
          >
            Chat
          </button>
        </div>
      );
    }

    if (req.status === 'rejected') {
      return (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => openRequestModal(founder)}
        >
          Retry
        </button>
      );
    }

    return null;
  };

  if (loading) return <LoadingSpinner message="Loading founders…" />;

  return (
    <div>
      <PageHeader
        title="Eligible Founders"
        subtitle="Connect with founders who need your expertise"
      />

      {/* Filters */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by startup, founder, or industry…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: '1 1 280px' }}
          />
          <select
            className="form-select"
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            style={{ flex: '0 1 200px' }}
          >
            {industries.map(ind => (
              <option key={ind} value={ind}>
                {ind === 'all' ? 'All Industries' : ind}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Founders list */}
      {filtered.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No founders found matching your criteria.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filtered.map((founder) => {
            const founderName = founder.founderId?.name || 'Unknown Founder';
            const founderPic  = founder.founderId?.profilePicture;

            return (
              <Card key={founder._id} style={{ padding: '1.25rem' }}>
                {/* Top row: avatar + info */}
                <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <img
                    src={avatarUrl(founderName, founderPic)}
                    alt={founderName}
                    style={{
                      width: 52, height: 52,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--border-color)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700 }}>
                        {founder.startupName || 'Unnamed Startup'}
                      </h3>
                      {isFounderPaymentVerified(founder) && <FeaturedBadge />}
                    </div>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      by {founderName}
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {founder.industry && (
                        <span style={{ padding: '2px 8px', background: 'var(--primary-bg, #F0FDF4)', color: 'var(--primary, #16A34A)', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600 }}>
                          {founder.industry}
                        </span>
                      )}
                      {founder.validationScore != null && (
                        <span style={{ padding: '2px 8px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600 }}>
                          {founder.validationScore}% validated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thesis — full width, clamped */}
                {founder.thesis && (
                  <p style={{ margin: '0 0 0.875rem', fontSize: '0.82rem', color: 'var(--text-tertiary)', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {founder.thesis}
                  </p>
                )}

                {/* Actions — full width row */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 100 }}>{renderActionButtons(founder)}</div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, minWidth: 100 }}
                    onClick={() => { setDetailFounder(founder); setDetailOpen(true); }}
                  >
                    View Profile
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailFounder?.startupName || 'Startup Details'}
        maxWidth="600px"
      >
        {detailFounder && (() => {
          const fn = detailFounder.founderId?.name || 'Unknown Founder';
          const fp = detailFounder.founderId?.profilePicture;
          return (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <img
                  src={avatarUrl(fn, fp)}
                  alt={fn}
                  style={{
                    width: 100, height: 100, borderRadius: '50%',
                    objectFit: 'cover', border: '3px solid var(--border-color)',
                    marginBottom: '0.75rem',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                  <h3 style={{ margin: 0 }}>{detailFounder.startupName}</h3>
                  {isFounderPaymentVerified(detailFounder) && <FeaturedBadge />}
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Founded by {fn}
                  {detailFounder.founderId?.state ? ` · ${detailFounder.founderId.state}` : ''}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.5rem' }}>
                {detailFounder.industry && (
                  <span style={{ padding: '4px 12px', background: '#F0FDF4', color: '#16A34A', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {detailFounder.industry}
                  </span>
                )}
                {detailFounder.validationScore != null && (
                  <span style={{ padding: '4px 12px', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {detailFounder.validationScore}% validated
                  </span>
                )}
                {detailFounder.currentStage && (
                  <span style={{ padding: '4px 12px', background: '#F5F3FF', color: '#6D28D9', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {detailFounder.currentStage}
                  </span>
                )}
              </div>

              {detailFounder.thesis && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Problem / Thesis</h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                    {detailFounder.thesis}
                  </p>
                </div>
              )}

              {detailFounder.founderId?.email && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Contact</h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {detailFounder.founderId.email}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                {(() => {
                  const req = sentRequests[detailFounder._id?.toString() || detailFounder._id];
                  if (req?.status === 'accepted') {
                    const chatUserId = detailFounder.founderId?._id || detailFounder.founderId;
                    return (
                      <>
                        <button className="btn btn-secondary" style={{ flex: 1, background: '#D1FAE5', color: '#065F46', border: 'none' }} disabled>
                          ✓ Connected
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1 }}
                          onClick={() => { setDetailOpen(false); window.location.hash = `chat?userId=${chatUserId}`; }}
                        >
                          💬 Chat
                        </button>
                      </>
                    );
                  }
                  if (req?.status === 'pending') {
                    return (
                      <button className="btn btn-secondary" style={{ flex: 1 }} disabled>
                        Request Pending
                      </button>
                    );
                  }
                  return (
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setDetailOpen(false);
                        openRequestModal(detailFounder);
                      }}
                    >
                      Send Request
                    </button>
                  );
                })()}
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setDetailOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Send Request Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={requestOpen}
        onClose={() => !sending && setRequestOpen(false)}
        title={`Send Request to ${requestFounder?.startupName || ''}`}
        maxWidth="500px"
      >
        <div>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Introduce yourself and explain how you can help{' '}
            <strong>{requestFounder?.startupName}</strong>.
          </p>

          <div className="form-group">
            <label className="form-label">Services You Offer *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Full-stack Development, UI/UX Design"
              value={reqServices}
              onChange={(e) => setReqServices(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Your Message *</label>
            <textarea
              className="form-textarea"
              placeholder="Write your proposal here…"
              value={reqMessage}
              onChange={(e) => setReqMessage(e.target.value)}
              rows={5}
              disabled={sending}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSendRequest}
              disabled={sending}
              style={{ flex: 1 }}
            >
              {sending ? 'Sending…' : 'Send Request'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setRequestOpen(false)}
              disabled={sending}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FoundersPage;
