import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { investorAPI } from '../../../services/api';
import { Star, StarOff } from '../../shared/Icons';
import { INDUSTRIES } from '../../../constants/industries';

const VERIFIED = ['APPROVED','STAGE_1','STAGE_2','STAGE_3','STAGE_4','STAGE_5','STAGE_6','STAGE_7'];

const Avatar = ({ src, name, size = 56 }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=3B82F6&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <img src={url} alt={name} onError={e => { e.target.src = fb; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
  );
};

const ScoreBadge = ({ score }) => {
  const color = score >= 90 ? '#059669' : score >= 70 ? '#2563EB' : '#D97706';
  const bg    = score >= 90 ? '#D1FAE5' : score >= 70 ? '#DBEAFE' : '#FEF3C7';
  return (
    <span style={{ padding: '4px 12px', background: bg, color, borderRadius: 9999, fontSize: '0.8rem', fontWeight: 700 }}>
      {score}% Validated
    </span>
  );
};

export default function StartupsPage() {
  const [startups, setStartups]     = useState([]);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [requests, setRequests]     = useState([]); // to know which startups already have requests
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [industry, setIndustry]     = useState('all');
  const [detail, setDetail]         = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy]             = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [sRes, wRes, rRes] = await Promise.allSettled([
      investorAPI.getValidatedStartups(),
      investorAPI.getWatchlist(),
      investorAPI.getMyRequests(),
    ]);
    if (sRes.status === 'fulfilled') setStartups(sRes.value);
    if (wRes.status === 'fulfilled') setWatchlistIds(new Set(wRes.value.map(s => s._id?.toString())));
    if (rRes.status === 'fulfilled') setRequests(rRes.value);
    setLoading(false);
  };

  // Use the full static industry list so all options are always available
  const industries = ['all', ...INDUSTRIES];

  const filtered = useMemo(() => {
    let list = startups;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.thesis?.toLowerCase().includes(q) || s.founderId?.name?.toLowerCase().includes(q));
    }
    if (industry !== 'all') list = list.filter(s => s.industry === industry);
    return list;
  }, [startups, search, industry]);

  const getRequestStatus = (startupId) => {
    const req = requests.find(r => {
      const sid = r.startupId?._id?.toString() || r.startupId?.toString();
      return sid === startupId?.toString();
    });
    return req?.status || null;
  };

  const toggleWatchlist = async (startupId, e) => {
    e.stopPropagation();
    const id = startupId.toString();
    const isWatched = watchlistIds.has(id);
    setBusy(p => ({ ...p, [id]: true }));
    try {
      if (isWatched) {
        await investorAPI.removeFromWatchlist(id);
        setWatchlistIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        toast.success('Removed from watchlist');
      } else {
        await investorAPI.addToWatchlist(id);
        setWatchlistIds(prev => new Set([...prev, id]));
        toast.success('Added to watchlist');
      }
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setBusy(p => ({ ...p, [id]: false }));
    }
  };

  const sendRequest = async (startupId, e) => {
    e.stopPropagation();
    const id = startupId.toString();
    setBusy(p => ({ ...p, [`req_${id}`]: true }));
    try {
      await investorAPI.expressInterest(id);
      toast.success('Request sent!');
      load(); // refresh to update button state
    } catch (err) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setBusy(p => ({ ...p, [`req_${id}`]: false }));
    }
  };

  if (loading) return <LoadingSpinner message="Loading startups…" />;

  return (
    <div>
      <PageHeader title="Validated Startups" subtitle="Startups with 70%+ validation score" />

      {/* Filters */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search by name, thesis, or founder…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 260px' }}
          />
          <select className="form-select" value={industry} onChange={e => setIndustry(e.target.value)} style={{ flex: '0 1 180px' }}>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind === 'all' ? 'All Industries' : ind}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No startups found. {search && 'Try a different search term.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filtered.map(startup => {
            const founder = startup.founderId || {};
            const sid = startup._id?.toString();
            const isWatched = watchlistIds.has(sid);
            const reqStatus = getRequestStatus(startup._id);

            let actionBtn;
            if (reqStatus === 'accepted') {
              actionBtn = (
                <button className="btn btn-secondary btn-sm" disabled style={{ background: '#D1FAE5', color: '#065F46', border: 'none' }}>
                  ✓ Connected
                </button>
              );
            } else if (reqStatus === 'pending') {
              actionBtn = <button className="btn btn-secondary btn-sm" disabled>Pending…</button>;
            } else {
              actionBtn = (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy[`req_${sid}`]}
                  onClick={e => sendRequest(startup._id, e)}
                >
                  {busy[`req_${sid}`] ? 'Sending…' : 'Send Request'}
                </button>
              );
            }

            return (
              <Card key={startup._id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={founder.profilePicture} name={founder.name} size={56} />
                    {VERIFIED.includes(founder.state) && (
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 18, height: 18, background: '#2563EB',
                        borderRadius: '50%', border: '2px solid white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 9, height: 9 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                      <div>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{startup.name}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {startup.industry || 'N/A'} · by {founder.name || 'Unknown'}
                        </p>
                      </div>
                      <ScoreBadge score={startup.validationScore || 0} />
                    </div>
                    {startup.thesis && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                        {startup.thesis.length > 180 ? `${startup.thesis.substring(0, 180)}…` : startup.thesis}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 110, alignItems: 'stretch' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setDetail(startup); setDetailOpen(true); }}
                    >
                      View Details
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy[sid]}
                      onClick={e => toggleWatchlist(startup._id, e)}
                      style={isWatched ? { background: '#FEF3C7', color: '#92400E', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' } : { display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {busy[sid] ? '…' : isWatched
                        ? <><Star size={14} fill="#92400E" color="#92400E" /> Watching</>
                        : <><StarOff size={14} /> Watch</>}
                    </button>
                    {actionBtn}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={detail?.name || 'Startup Details'} maxWidth="580px">
        {detail && (() => {
          const f = detail.founderId || {};
          const sid = detail._id?.toString();
          const reqStatus = getRequestStatus(detail._id);
          const isWatched = watchlistIds.has(sid);

          return (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={f.profilePicture} name={f.name} size={72} />
                  {VERIFIED.includes(f.state) && (
                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, background: '#2563EB', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 10, height: 10 }}><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)' }}>{detail.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {detail.industry || 'N/A'} · Founded by {f.name || 'Unknown'}
                  </p>
                  <div style={{ marginTop: 6 }}><ScoreBadge score={detail.validationScore || 0} /></div>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Industry',         value: detail.industry },
                  { label: 'Validation Score', value: `${detail.validationScore || 0}%` },
                  { label: 'Current Stage',    value: detail.currentStage },
                  { label: 'Stages Completed', value: detail.completedStages != null ? `${detail.completedStages}/5` : null },
                ].filter(r => r.value).map(({ label, value }) => (
                  <div key={label} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-hover, #F9FAFB)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {detail.thesis && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-hover, #F9FAFB)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Problem / Thesis</div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>{detail.thesis}</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {reqStatus === 'accepted' ? (
                  <button className="btn btn-secondary" style={{ flex: 1, background: '#D1FAE5', color: '#065F46', border: 'none' }} disabled>✓ Connected</button>
                ) : reqStatus === 'pending' ? (
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled>Request Pending</button>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={busy[`req_${sid}`]}
                    onClick={async e => { await sendRequest(detail._id, e); setDetailOpen(false); }}
                  >
                    {busy[`req_${sid}`] ? 'Sending…' : 'Send Request'}
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, ...(isWatched ? { background: '#FEF3C7', color: '#92400E', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' } : { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }) }}
                  disabled={busy[sid]}
                  onClick={e => toggleWatchlist(detail._id, e)}
                >
                  {busy[sid] ? '…' : isWatched
                    ? <><Star size={14} fill="#92400E" color="#92400E" /> Watching</>
                    : <><StarOff size={14} /> Watch</>}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
