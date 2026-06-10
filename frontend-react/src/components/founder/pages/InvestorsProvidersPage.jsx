import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { founderAPI, connectionsAPI } from '../../../services/api';
import { Lock, TrendingUp, Puzzle, Star } from '../../shared/Icons';
import VerifiedBadge from '../../shared/VerifiedBadge';
import FeaturedBadge from '../../shared/FeaturedBadge';

// Payment-only verified check for profile cards
function isProfilePaymentVerified(profile) {
  return profile?.isVerified === true && profile?.verifiedSource === 'payment' && profile?.verifiedUntil && new Date(profile.verifiedUntil) > new Date();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = 72 }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=84CC16&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <img
      src={url} alt={name}
      onError={e => { e.target.src = fb; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }}
    />
  );
};

const ApprovedBadge = () => null; // Removed — only payment-verified users show badge

const InfoRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function InvestorsProvidersPage({ startup }) {
  const [tab, setTab] = useState('investors');
  const [investors, setInvestors] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // Detail modal
  const [detailProfile, setDetailProfile] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('investors'); // track which tab detail was opened from

  // Request modal
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const validationScore = startup?.validationScore || 0;
  const isLocked = validationScore < 70;

  const loadData = useCallback(async () => {
    if (isLocked) { setLoading(false); return; }
    setLoading(true);
    try {
      let profiles = [];
      if (tab === 'investors') {
        const data = await founderAPI.getInvestors(search);
        profiles = Array.isArray(data) ? data : [];
      } else {
        const data = await founderAPI.getProviders(search, category !== 'all' ? category : '');
        profiles = Array.isArray(data) ? data : [];
      }

      // Merge Connection model status (direct connect) with IntroRequest status
      // so profiles show "Connected/Pending" regardless of which flow was used
      if (profiles.length > 0) {
        const userIds = profiles.map(p => (p.userId || p._id)?.toString()).filter(Boolean);
        try {
          const connStatusMap = await connectionsAPI.statusBulk(userIds);
          profiles = profiles.map(p => {
            const uid = (p.userId || p._id)?.toString();
            const connStatus = connStatusMap[uid];
            const introStatus = p.requestStatus;
            // Prefer 'accepted' > 'pending' > introRequest status
            const priority = { accepted: 3, pending: 2 };
            let finalStatus = introStatus;
            if (connStatus && (!finalStatus || (priority[connStatus] || 0) > (priority[finalStatus] || 0))) {
              finalStatus = connStatus;
            }
            return { ...p, requestStatus: finalStatus };
          });
        } catch { /* ignore — fall back to IntroRequest status only */ }
      }

      if (tab === 'investors') setInvestors(profiles);
      else setProviders(profiles);
    } catch (err) {
      console.error('Load error:', err);
      toast.error(`Failed to load ${tab}`);
    } finally {
      setLoading(false);
    }
  }, [tab, isLocked, search, category]);

  useEffect(() => { loadData(); }, [tab, isLocked]);

  // ── Open detail modal ────────────────────────────────────────────────────────
  const openDetail = async (profile, currentTab) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailProfile(null);
    setDetailTab(currentTab);
    try {
      const data = currentTab === 'investors'
        ? await founderAPI.getInvestorDetail(profile._id)
        : await founderAPI.getProviderDetail(profile._id);
      setDetailProfile(data);
    } catch (err) {
      toast.error('Failed to load profile details');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Open request modal ───────────────────────────────────────────────────────
  const openRequest = (profile) => {
    setRequestTarget(profile);
    setRequestMsg('');
    setRequestOpen(true);
  };

  const sendRequest = async () => {
    if (!requestMsg.trim()) { toast.error('Please enter a message'); return; }
    setSending(true);
    try {
      const targetId = requestTarget.userId || requestTarget._id;
      await founderAPI.sendRequest(targetId, requestMsg);
      toast.success('Request sent successfully!');
      setRequestOpen(false);
      setRequestMsg('');
      loadData(); // refresh to update requestStatus
    } catch (err) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleSearch = (e) => { e.preventDefault(); loadData(); };

  const list = tab === 'investors' ? investors : providers;
  const providerCategories = ['all', 'Legal', 'Tech', 'Design', 'Marketing', 'Finance', 'HR', 'Operations', 'General'];

  // ── Locked state ─────────────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div>
        <PageHeader title="Investors & Providers" subtitle="Connect with investors and service providers" />
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <Lock size={48} color="#9CA3AF" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Content Locked</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Complete validation stages to reach 70% validation score to unlock access to investors and providers.
            </p>
            <div style={{ display: 'inline-block', padding: '0.75rem 1.5rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
              Current Score: {validationScore}% / 70%
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Investors & Providers" subtitle="Connect with investors and service providers" />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        {[
          { key: 'investors', label: 'Investors', icon: <TrendingUp size={16} /> },
          { key: 'providers', label: 'Service Providers', icon: <Puzzle size={16} /> },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.75rem 1.5rem', background: 'transparent', border: 'none',
            borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === key ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: tab === key ? 600 : 400, cursor: 'pointer', fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <Card style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder={`Search ${tab}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', marginBottom: 0 }}
          />
          {tab === 'providers' && (
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ flex: '0 1 160px' }}>
              {providerCategories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>Search</button>
        </form>
      </Card>

      {/* Profile Grid */}
      {loading ? (
        <LoadingSpinner message={`Loading ${tab}…`} />
      ) : list.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No {tab} found. {search && 'Try a different search term.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {list.map((profile) => {
            const status = profile.requestStatus;

            // Connect button state
            let connectBtn;
            if (status === 'accepted') {
              // Connected — show chat button
              const chatUserId = profile.userId || profile._id;
              connectBtn = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                  <button className="btn btn-secondary btn-sm" disabled style={{ width: '100%', background: '#D1FAE5', color: '#065F46', border: 'none' }}>
                    ✓ Connected
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%' }}
                    onClick={(e) => { e.stopPropagation(); window.location.hash = `chat?userId=${chatUserId}`; }}
                  >
                    💬 Chat
                  </button>
                </div>
              );
            } else if (status === 'pending') {
              connectBtn = (
                <button className="btn btn-secondary btn-sm" disabled style={{ width: '100%' }}>
                  Pending…
                </button>
              );
            } else {
              connectBtn = (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  onClick={(e) => { e.stopPropagation(); openRequest(profile); }}
                >
                  Connect
                </button>
              );
            }

            return (
              <Card key={profile._id} style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                  {/* Avatar */}
                  <Avatar src={profile.profilePicture} name={profile.name} size={72} />

                  {/* Name & subtitle */}
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {profile.name}
                      {isProfilePaymentVerified(profile) && <VerifiedBadge size={13} />}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {tab === 'investors'
                        ? (profile.interestAreas?.slice(0, 2).join(', ') || 'Investor')
                        : (profile.category || 'Service Provider')}
                    </div>
                    {isProfilePaymentVerified(profile) && (
                      <div style={{ marginBottom: 4 }}><FeaturedBadge /></div>
                    )}
                    <ApprovedBadge state={profile.state} />
                    {profile.rating && parseFloat(profile.rating) > 0 && (
                      <div style={{ fontSize: '0.82rem', color: '#F59E0B', marginTop: 4, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Star size={13} fill="#F59E0B" color="#F59E0B" /> {parseFloat(profile.rating).toFixed(1)}
                      </div>
                    )}
                  </div>

                  {/* Action buttons — View + Connect */}
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={(e) => { e.stopPropagation(); openDetail(profile, tab); }}
                    >
                      View
                    </button>
                    <div style={{ flex: 1 }}>{connectBtn}</div>
                  </div>
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
        title={detailProfile?.name || 'Profile Details'}
        maxWidth="560px"
      >
        {detailLoading ? (
          <LoadingSpinner message="Loading profile…" />
        ) : detailProfile ? (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <Avatar src={detailProfile.profilePicture} name={detailProfile.name} size={80} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 4 }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem' }}>
                    {detailProfile.name}
                  </h3>
                  {isProfilePaymentVerified(detailProfile) && <FeaturedBadge />}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <ApprovedBadge state={detailProfile.state} />
                  {detailProfile.rating && parseFloat(detailProfile.rating) > 0 && (
                    <span style={{ fontSize: '0.85rem', color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Star size={14} fill="#F59E0B" color="#F59E0B" /> {parseFloat(detailProfile.rating).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {detailTab === 'investors' ? (
                <>
                  {detailProfile.interestAreas?.length > 0 && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <InfoRow label="Interest Areas" value={detailProfile.interestAreas.join(', ')} />
                    </div>
                  )}
                  {detailProfile.stagePreference?.length > 0 && (
                    <InfoRow label="Stage Preference" value={detailProfile.stagePreference.join(', ')} />
                  )}
                  {detailProfile.joinedAt && (
                    <InfoRow label="Joined" value={new Date(detailProfile.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })} />
                  )}
                </>
              ) : (
                <>
                  <InfoRow label="Category" value={detailProfile.category} />
                  <InfoRow label="Experience" value={detailProfile.experienceLevel} />
                  {detailProfile.specialties?.length > 0 && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <InfoRow label="Specialties" value={detailProfile.specialties.join(', ')} />
                    </div>
                  )}
                  <InfoRow label="Availability" value={detailProfile.availability} />
                  <InfoRow label="Contact Method" value={detailProfile.contactMethod} />
                </>
              )}
            </div>

            {/* Description / bio */}
            {(detailProfile.description || detailProfile.bio) && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>About</div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontSize: '0.9rem' }}>
                  {detailProfile.description || detailProfile.bio}
                </p>
              </div>
            )}

            {/* Connect button */}
            {detailProfile.requestStatus === 'accepted' ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1, background: '#D1FAE5', color: '#065F46', border: 'none' }} disabled>
                  ✓ Connected
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => { setDetailOpen(false); window.location.hash = `chat?userId=${detailProfile.userId || detailProfile._id}`; }}
                >
                  💬 Chat
                </button>
              </div>
            ) : detailProfile.requestStatus === 'pending' ? (
              <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                Request Pending
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setDetailOpen(false); openRequest(detailProfile); }}
              >
                Connect with {detailProfile.name}
              </button>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ── Request Modal ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={requestOpen}
        onClose={() => !sending && setRequestOpen(false)}
        title={`Connect with ${requestTarget?.name || ''}`}
        maxWidth="480px"
      >
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Introduce yourself and explain why you'd like to connect with <strong>{requestTarget?.name}</strong>.
        </p>
        <textarea
          className="form-textarea"
          placeholder="Write your message here…"
          value={requestMsg}
          onChange={e => setRequestMsg(e.target.value)}
          rows={5}
          style={{ marginBottom: '1rem' }}
          disabled={sending}
        />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={sendRequest} disabled={sending} style={{ flex: 1 }}>
            {sending ? 'Sending…' : 'Send Request'}
          </button>
          <button className="btn btn-secondary" onClick={() => setRequestOpen(false)} disabled={sending} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
