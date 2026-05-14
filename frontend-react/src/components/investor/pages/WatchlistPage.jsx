import React, { useState, useEffect } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { investorAPI } from '../../../services/api';

const VERIFIED = ['APPROVED','STAGE_1','STAGE_2','STAGE_3','STAGE_4','STAGE_5','STAGE_6','STAGE_7'];

const Avatar = ({ src, name, size = 56 }) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=3B82F6&color=fff&size=${size * 2}`;
  const url = src ? (src.startsWith('http') ? src : `${window.location.origin}${src}`) : fb;
  return (
    <img src={url} alt={name} onError={e => { e.target.src = fb; }}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
  );
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [detail, setDetail]       = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy]           = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [wRes, rRes] = await Promise.allSettled([
      investorAPI.getWatchlist(),
      investorAPI.getMyRequests(),
    ]);
    if (wRes.status === 'fulfilled') setWatchlist(wRes.value);
    if (rRes.status === 'fulfilled') setRequests(rRes.value);
    setLoading(false);
  };

  const remove = async (startupId) => {
    if (!window.confirm('Remove from watchlist?')) return;
    const id = startupId.toString();
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await investorAPI.removeFromWatchlist(id);
      setWatchlist(prev => prev.filter(s => s._id?.toString() !== id));
      toast.success('Removed from watchlist');
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setBusy(p => ({ ...p, [id]: false }));
    }
  };

  const sendRequest = async (startupId) => {
    const id = startupId.toString();
    setBusy(p => ({ ...p, [`req_${id}`]: true }));
    try {
      await investorAPI.expressInterest(id);
      toast.success('Request sent!');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed');
    } finally {
      setBusy(p => ({ ...p, [`req_${id}`]: false }));
    }
  };

  const getReqStatus = (startupId) => {
    const req = requests.find(r => {
      const sid = r.startupId?._id?.toString() || r.startupId?.toString();
      return sid === startupId?.toString();
    });
    return req?.status || null;
  };

  if (loading) return <LoadingSpinner message="Loading watchlist…" />;

  return (
    <div>
      <PageHeader title="Watchlist" subtitle="Startups you're tracking" />

      {watchlist.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⭐</div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Your watchlist is empty</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Browse validated startups and click "Watch" to track them here.
            </p>
            <a href="#startups" style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary">Browse Startups</button>
            </a>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {watchlist.map(startup => {
            const founder = startup.founderId || {};
            const sid = startup._id?.toString();
            const reqStatus = getReqStatus(startup._id);

            return (
              <Card key={startup._id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar src={founder.profilePicture} name={founder.name} size={56} />
                    {VERIFIED.includes(founder.state) && (
                      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, background: '#2563EB', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{ width: 9, height: 9 }}><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 2px', color: 'var(--text-primary)', fontSize: '1rem' }}>{startup.name}</h3>
                    <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {startup.industry || 'N/A'} · by {founder.name || 'Unknown'}
                    </p>
                    <span style={{ padding: '3px 10px', background: '#DBEAFE', color: '#1D4ED8', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700 }}>
                      {startup.validationScore || 0}% Validated
                    </span>
                    {startup.thesis && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                        {startup.thesis.length > 160 ? `${startup.thesis.substring(0, 160)}…` : startup.thesis}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 110, alignItems: 'stretch' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setDetail(startup); setDetailOpen(true); }}>
                      View Details
                    </button>
                    {reqStatus === 'accepted' ? (
                      <button className="btn btn-secondary btn-sm" disabled style={{ background: '#D1FAE5', color: '#065F46', border: 'none' }}>✓ Connected</button>
                    ) : reqStatus === 'pending' ? (
                      <button className="btn btn-secondary btn-sm" disabled>Pending…</button>
                    ) : (
                      <button className="btn btn-primary btn-sm" disabled={busy[`req_${sid}`]} onClick={() => sendRequest(startup._id)}>
                        {busy[`req_${sid}`] ? 'Sending…' : 'Send Request'}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy[sid]}
                      onClick={() => remove(startup._id)}
                      style={{ color: 'var(--error, #EF4444)' }}
                    >
                      {busy[sid] ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={detail?.name || 'Startup Details'} maxWidth="560px">
        {detail && (() => {
          const f = detail.founderId || {};
          const sid = detail._id?.toString();
          const reqStatus = getReqStatus(detail._id);
          return (
            <div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <Avatar src={f.profilePicture} name={f.name} size={72} />
                <div>
                  <h3 style={{ margin: '0 0 4px' }}>{detail.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{detail.industry} · by {f.name}</p>
                  <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', background: '#DBEAFE', color: '#1D4ED8', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700 }}>
                    {detail.validationScore || 0}% Validated
                  </span>
                </div>
              </div>
              {detail.thesis && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--bg-hover, #F9FAFB)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Problem / Thesis</div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>{detail.thesis}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {reqStatus === 'accepted' ? (
                  <button className="btn btn-secondary" style={{ flex: 1, background: '#D1FAE5', color: '#065F46', border: 'none' }} disabled>✓ Connected</button>
                ) : reqStatus === 'pending' ? (
                  <button className="btn btn-secondary" style={{ flex: 1 }} disabled>Request Pending</button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy[`req_${sid}`]} onClick={async () => { await sendRequest(detail._id); setDetailOpen(false); }}>
                    {busy[`req_${sid}`] ? 'Sending…' : 'Send Request'}
                  </button>
                )}
                <button className="btn btn-secondary" style={{ flex: 1, color: 'var(--error, #EF4444)' }} disabled={busy[sid]} onClick={async () => { await remove(detail._id); setDetailOpen(false); }}>
                  {busy[sid] ? '…' : 'Remove from Watchlist'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
