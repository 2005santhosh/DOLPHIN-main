import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchAllOpportunities, clearOpportunitiesCache } from '../../../services/opportunities/opportunitiesService';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import LoadingSpinner from '../../shared/LoadingSpinner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isVerifiedUser(user) {
  return user?.isVerified === true || user?.verificationStatus === 'verified';
}

/** Strip HTML tags at render time — safety net for any cached raw HTML */
function cleanText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function Pill({ text, bg = '#F3F4F6', color = '#374151', style = {} }) {
  return (
    <span style={{ padding: '2px 8px', background: bg, color, borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', ...style }}>
      {text}
    </span>
  );
}

function AvatarFallback({ name, size = 40 }) {
  const letter = (name || 'C')[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: 'linear-gradient(135deg,#84CC16,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: size * 0.4, flexShrink: 0 }}>
      {letter}
    </div>
  );
}

const TYPE_COLORS = {
  Freelance:   { bg: '#EEF2FF', color: '#4338CA' },
  Internship:  { bg: '#FEF3C7', color: '#92400E' },
  Contract:    { bg: '#F0FDF4', color: '#166534' },
  'Part-time': { bg: '#FDF4FF', color: '#7E22CE' },
  'Full-time': { bg: '#EFF6FF', color: '#1D4ED8' },
};
const MODE_COLORS = {
  Remote:  { bg: '#ECFDF5', color: '#065F46' },
  Hybrid:  { bg: '#FFF7ED', color: '#9A3412' },
  'On-site': { bg: '#F9FAFB', color: '#374151' },
};

const CATEGORIES = ['All', 'Web Development', 'Mobile Development', 'UI/UX', 'Graphic Design', 'Marketing', 'Content Writing', 'AI', 'Data', 'Healthcare', 'Agriculture', 'Engineering', 'Education', 'Finance', 'Government', 'Other'];
const TYPES      = ['Freelance', 'Internship', 'Contract', 'Part-time', 'Full-time'];
const MODES      = ['Remote', 'Hybrid', 'On-site'];
const LEVELS     = ['Beginner', 'Intermediate', 'Expert'];
const DATE_OPTIONS = ['Any time', 'Today', 'Last 3 days', 'Last 7 days', 'Last 30 days'];

// ── OpportunityCard ────────────────────────────────────────────────────────────

function OpportunityCard({ opp, onView, onSave, onApply, verified }) {
  const [imgErr, setImgErr] = useState(false);
  const tc = TYPE_COLORS[opp.opportunityType] || TYPE_COLORS.Contract;
  const mc = MODE_COLORS[opp.workMode] || MODE_COLORS['On-site'];

  const budget = opp.stipend
    ? `₹${opp.stipend.toLocaleString()}/mo`
    : opp.budgetMin && opp.budgetMax
      ? `${opp.currency === 'USD' ? '$' : opp.currency === 'INR' ? '₹' : '€'}${opp.budgetMin}–${opp.budgetMax}`
      : opp.budgetMin
        ? `${opp.currency === 'USD' ? '$' : '₹'}${opp.budgetMin}+`
        : 'Negotiable';

  return (
    <div style={{
      background: 'white', borderRadius: 14, border: '1px solid #E5E7EB',
      padding: '1.1rem 1.25rem', transition: 'box-shadow 0.15s, border-color 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          {opp.companyLogo && !imgErr ? (
            <img src={opp.companyLogo} alt={opp.companyName} onError={() => setImgErr(true)}
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid #F3F4F6' }} />
          ) : (
            <AvatarFallback name={opp.companyName} size={40} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem', lineHeight: 1.3, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {opp.title}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
            {opp.companyName}
            {opp.location && opp.location !== 'Remote' && ` · ${opp.location}`}
          </div>
        </div>
        {/* Save + urgent */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
          {opp.isUrgent && (
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#EF4444', background: '#FEE2E2', padding: '2px 6px', borderRadius: 9999 }}>URGENT</span>
          )}
          <button
            onClick={() => onSave(opp)}
            aria-label={opp.isSaved ? 'Unsave' : 'Save'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: opp.isSaved ? '#84CC16' : '#9CA3AF', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#84CC16'; }}
            onMouseLeave={e => { e.currentTarget.style.color = opp.isSaved ? '#84CC16' : '#9CA3AF'; }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={opp.isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Description */}
      <p style={{ margin: '0.6rem 0 0.75rem', fontSize: '0.82rem', color: '#6B7280', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {cleanText(opp.shortDescription || opp.description || '')}
      </p>

      {/* Tags row */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <Pill text={opp.opportunityType} bg={tc.bg} color={tc.color} />
        <Pill text={opp.workMode} bg={mc.bg} color={mc.color} />
        {opp.skills.slice(0, 3).map(s => <Pill key={s} text={s} />)}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>{budget}</span>
          {opp.duration && <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{opp.duration}</span>}
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{relativeTime(opp.postedAt)}</span>
          <span style={{ fontSize: '0.72rem', color: '#9CA3AF', background: '#F9FAFB', padding: '1px 6px', borderRadius: 6, border: '1px solid #E5E7EB' }}>
            via {opp.sourceName}
          </span>
          {opp.isVerified && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '1px 6px', borderRadius: 6 }}>✓ Verified</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onView(opp)}>
            Details
          </button>
          {opp.isApplied ? (
            <button className="btn btn-secondary btn-sm" disabled style={{ background: '#D1FAE5', color: '#065F46', border: 'none' }}>
              ✓ Applied
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => onApply(opp)}>
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function OpportunitySkeleton() {
  const sh = (w, h = 14, r = 6) => (
    <div style={{ width: w, height: h, background: '#F3F4F6', borderRadius: r, animation: 'opp-pulse 1.5s ease-in-out infinite' }} />
  );
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E5E7EB', padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {sh(40, 40, 8)} <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>{sh('70%')}{sh('40%', 12)}</div>
      </div>
      {sh('100%', 12)} {sh('85%', 12, 6)} <div style={{ marginTop: 8 }} />
      <div style={{ display: 'flex', gap: 6 }}>{sh(70)}{sh(60)}{sh(80)}</div>
      <style>{`@keyframes opp-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
    </div>
  );
}

// ── Verification Required Modal ───────────────────────────────────────────────

function VerificationRequiredModal({ onClose, onVerify }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', zIndex: 9991, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px,calc(100vw - 32px))', background: 'white', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#84CC16,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h3 style={{ color: 'white', margin: '0 0 0.4rem', fontWeight: 800, fontSize: '1.15rem' }}>Verify your profile to apply</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
            Complete verification to unlock direct applications, boost trust, and access premium opportunities.
          </p>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.625rem' }} onClick={onVerify}>
            Verify now →
          </button>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </>
  );
}

// ── Easy Apply Modal ──────────────────────────────────────────────────────────

function ApplyModal({ opp, user, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name:  user?.name || '', email: user?.email || '',
    phone: '', portfolio: '', rate: '', availability: '', cover: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800)); // mock submit delay
    setSuccess(true);
    setTimeout(() => { onSubmit(opp); onClose(); }, 1500);
    setSubmitting(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', zIndex: 9991, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px,calc(100vw - 24px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: 'white', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Apply — {opp.title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>{opp.companyName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
        </div>
        {success ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#111827' }}>Application Submitted!</h3>
            <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>We'll notify you of any updates.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
            {[
              { key: 'name',  label: 'Full Name *', type: 'text',  placeholder: 'Your name', required: true },
              { key: 'email', label: 'Email *', type: 'email', placeholder: 'you@email.com', required: true },
              { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 9876543210' },
              { key: 'portfolio', label: 'Portfolio / GitHub URL', type: 'url', placeholder: 'https://yourportfolio.com' },
              { key: 'rate',  label: 'Expected Rate / Salary', type: 'text', placeholder: 'e.g. ₹50,000/mo or $40/hr' },
              { key: 'availability', label: 'Availability', type: 'text', placeholder: 'e.g. Immediate, 2 weeks notice' },
            ].map(({ key, label, type, placeholder, required }) => (
              <div key={key} style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{label}</label>
                <input
                  type={type} placeholder={placeholder} required={required}
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = '#84CC16'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Cover Note</label>
              <textarea
                placeholder="Why are you a great fit for this opportunity?"
                value={form.cover}
                onChange={e => setForm(p => ({ ...p, cover: e.target.value }))}
                rows={4}
                style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.9rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={e => { e.target.style.borderColor = '#84CC16'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

// ── Detail Drawer / Modal ─────────────────────────────────────────────────────

function DetailDrawer({ opp, onClose, onApply, onSave, verified }) {
  if (!opp) return null;
  const tc = TYPE_COLORS[opp.opportunityType] || TYPE_COLORS.Contract;
  const mc = MODE_COLORS[opp.workMode] || MODE_COLORS['On-site'];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9950, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', zIndex: 9951, top: 0, right: 0, bottom: 0,
        width: 'min(520px,100vw)', background: 'white',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'drawer-in 0.25s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>{opp.title}</h2>
            <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>{opp.companyName} · {opp.location}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1.5rem', lineHeight: 1, flexShrink: 0, marginLeft: '0.75rem' }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Pill text={opp.opportunityType} bg={tc.bg} color={tc.color} />
            <Pill text={opp.workMode} bg={mc.bg} color={mc.color} />
            {opp.isVerified && <Pill text="✓ Verified" bg="#F0FDF4" color="#16A34A" />}
            {opp.isUrgent && <Pill text="🔴 Urgent" bg="#FEE2E2" color="#DC2626" />}
          </div>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            {[
              { label: 'Budget', value: opp.stipend ? `₹${opp.stipend.toLocaleString()}/mo` : opp.budgetMin ? `$${opp.budgetMin}–${opp.budgetMax || '?'}` : 'Negotiable' },
              { label: 'Duration', value: opp.duration || 'Not specified' },
              { label: 'Experience', value: opp.experienceLevel },
              { label: 'Posted', value: relativeTime(opp.postedAt) },
              { label: 'Source', value: opp.sourceName },
              { label: 'Apply type', value: opp.applyType === 'external' ? 'External link' : 'Easy Apply' },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '0.6rem 0.75rem', border: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: '0.68rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Skills */}
          {opp.skills.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Skills</div>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {opp.skills.map(s => <Pill key={s} text={s} />)}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Description</div>
            <p style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
              {cleanText(opp.description || opp.shortDescription || 'No description available.')}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flexShrink: 0 }}
            onClick={() => onSave(opp)}
          >
            {opp.isSaved ? '★ Saved' : '☆ Save'}
          </button>
          {opp.applyType === 'external' ? (
            <a
              href={opp.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
            >
              Apply on {opp.sourceName} ↗
            </a>
          ) : opp.isApplied ? (
            <button className="btn btn-secondary" style={{ flex: 1, background: '#D1FAE5', color: '#065F46', border: 'none' }} disabled>✓ Applied</button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onApply(opp)}>
              Easy Apply
            </button>
          )}
        </div>

        <style>{`
          @keyframes drawer-in {
            from { transform: translateX(40px); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}

// ── Filters Panel ─────────────────────────────────────────────────────────────

function FiltersPanel({ filters, onChange, onClear, isMobile, onClose }) {
  const F = ({ label, options, field, multi = true }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = multi ? filters[field]?.includes(opt) : filters[field] === opt;
          return (
            <button key={opt} onClick={() => {
              if (multi) {
                const cur = filters[field] || [];
                onChange(field, active ? cur.filter(v => v !== opt) : [...cur, opt]);
              } else {
                onChange(field, active ? '' : opt);
              }
            }} style={{
              padding: '4px 12px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? '#84CC16' : '#E5E7EB'}`, background: active ? '#F0FDF4' : 'white', color: active ? '#166534' : '#6B7280', transition: 'all 0.12s',
            }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const content = (
    <div style={{ padding: isMobile ? '1rem 1.25rem' : '1rem' }}>
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Filters</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6B7280', lineHeight: 1 }}>×</button>
        </div>
      )}
      <F label="Opportunity Type" options={TYPES} field="types" />
      <F label="Work Mode" options={MODES} field="modes" />
      <F label="Experience Level" options={LEVELS} field="levels" />
      <F label="Category" options={CATEGORIES.slice(1)} field="categories" />
      <F label="Posted" options={DATE_OPTIONS.slice(1)} field="dateRange" multi={false} />
      {/* Clear */}
      <button onClick={onClear} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
        Clear all filters
      </button>
      {isMobile && (
        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
          Apply filters
        </button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9960, background: 'rgba(0,0,0,0.45)' }} />
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9961,
          background: 'white', borderRadius: '20px 20px 0 0',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          paddingBottom: 'env(safe-area-inset-bottom,0)',
          animation: 'filter-sheet-in 0.22s ease',
        }}>
          <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 9999, margin: '0.75rem auto 0' }} />
          {content}
        </div>
        <style>{`@keyframes filter-sheet-in{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      </>
    );
  }

  return (
    <div style={{ width: 220, flexShrink: 0, background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', alignSelf: 'flex-start', position: 'sticky', top: '1rem' }}>
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Filters</span>
        <button onClick={onClear} style={{ fontSize: '0.75rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
      </div>
      {content}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = ['All', 'Recommended', 'Saved', 'Applied', 'Verified Only'];
const SORT_OPTIONS = ['Most Relevant', 'Newest first', 'Oldest first', 'Highest budget', 'Lowest budget'];

const DEFAULT_FILTERS = { types: [], modes: [], levels: [], categories: [], dateRange: '' };

function matchesDateRange(postedAt, range) {
  if (!range || range === 'Any time') return true;
  if (!postedAt) return false;
  const diff = Date.now() - new Date(postedAt);
  const d = diff / 86400000;
  if (range === 'Today') return d < 1;
  if (range === 'Last 3 days') return d <= 3;
  if (range === 'Last 7 days') return d <= 7;
  if (range === 'Last 30 days') return d <= 30;
  return true;
}

export default function OpportunitiesPage({ user }) {
  const [opportunities, setOpportunities] = useState([]);
  const [saved, setSaved]         = useState(new Set());
  const [applied, setApplied]     = useState(new Set());
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [sort, setSort]           = useState('Most Relevant');
  const [filters, setFilters]     = useState(DEFAULT_FILTERS);
  // India-first defaults
  const [showGlobal, setShowGlobal]   = useState(false);
  const [englishOnly, setEnglishOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile]   = useState(window.innerWidth < 768);
  const [viewOpp, setViewOpp]     = useState(null);
  const [applyOpp, setApplyOpp]   = useState(null);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [pendingApply, setPendingApply]     = useState(null);

  const searchTimer = useRef(null);
  const verified = isVerifiedUser(user);

  // Resize
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Fetch — re-runs when showGlobal or englishOnly changes.
  // clearOpportunitiesCache() is called first to ensure we never show
  // stale cached data that might still contain raw HTML from a previous session.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    clearOpportunitiesCache();
    fetchAllOpportunities({ showGlobal, englishOnly })
      .then(data => { if (!cancelled) { setOpportunities(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load opportunities. Showing demo data.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [showGlobal, englishOnly]);

  const filterChange = useCallback((field, val) => {
    setFilters(f => ({ ...f, [field]: val }));
  }, []);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    return filters.types.length + filters.modes.length + filters.levels.length + filters.categories.length + (filters.dateRange ? 1 : 0);
  }, [filters]);

  // Computed list
  const displayed = useMemo(() => {
    let list = opportunities.map(o => ({
      ...o,
      isSaved:   saved.has(o.id),
      isApplied: applied.has(o.id),
    }));

    // Tab
    if (activeTab === 'Saved')        list = list.filter(o => saved.has(o.id));
    if (activeTab === 'Applied')      list = list.filter(o => applied.has(o.id));
    if (activeTab === 'Verified Only') list = list.filter(o => o.isVerified);
    if (activeTab === 'Recommended')  list = list.filter(o => o.isVerified || o.isUrgent);

    // Filters
    if (filters.types.length)      list = list.filter(o => filters.types.includes(o.opportunityType));
    if (filters.modes.length)      list = list.filter(o => filters.modes.includes(o.workMode));
    if (filters.levels.length)     list = list.filter(o => filters.levels.includes(o.experienceLevel));
    if (filters.categories.length) list = list.filter(o => filters.categories.includes(o.category));
    if (filters.dateRange)         list = list.filter(o => matchesDateRange(o.postedAt, filters.dateRange));

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(o =>
        o.title?.toLowerCase().includes(q) ||
        o.companyName?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.location?.toLowerCase().includes(q) ||
        o.skills?.some(s => s.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === 'Newest first')    list = [...list].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    if (sort === 'Oldest first')    list = [...list].sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
    if (sort === 'Highest budget')  list = [...list].sort((a, b) => (b.budgetMax || b.budgetMin || 0) - (a.budgetMax || a.budgetMin || 0));
    if (sort === 'Lowest budget')   list = [...list].sort((a, b) => (a.budgetMin || 0) - (b.budgetMin || 0));
    // 'Most Relevant' keeps the order from the service (relevanceScore DESC already applied)

    return list;
  }, [opportunities, saved, applied, activeTab, filters, debouncedSearch, sort]);

  const handleSave = useCallback((opp) => {
    setSaved(s => { const n = new Set(s); n.has(opp.id) ? n.delete(opp.id) : n.add(opp.id); return n; });
  }, []);

  const handleApplyClick = useCallback((opp) => {
    if (opp.applyType === 'external') {
      window.open(opp.applyUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!verified) {
      setPendingApply(opp);
      setShowVerifModal(true);
      return;
    }
    setApplyOpp(opp);
  }, [verified]);

  const handleApplySubmit = useCallback((opp) => {
    setApplied(s => { const n = new Set(s); n.add(opp.id); return n; });
  }, []);

  return (
    <div style={{ padding: '0 0 2rem' }}>
      <PageHeader title="Opportunities" subtitle="Discover gigs, internships, and verified work opportunities" />

      {/* Search bar */}
      <div style={{ padding: '0 1.25rem 1rem', position: 'sticky', top: isMobile ? 60 : 64, zIndex: 100, background: 'var(--bg, #F9FAFB)', paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="form-input"
              placeholder="Search by role, skill, company, location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', marginBottom: 0, fontSize: '0.9rem' }}
            />
          </div>
          <button
            className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowFilters(true)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <select
            className="form-select btn-sm"
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{ flexShrink: 0, fontSize: '0.82rem', padding: '0.4rem 0.75rem', minWidth: 140 }}
          >
            {SORT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: '0.75rem', overflowX: 'auto', borderBottom: '1px solid #E5E7EB', paddingBottom: 0, scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === t ? '2px solid #84CC16' : '2px solid transparent',
              color: activeTab === t ? '#166534' : '#6B7280', fontWeight: activeTab === t ? 700 : 500, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0, marginBottom: '-1px', transition: 'all 0.15s',
            }}>
              {t}
              {t === 'Saved' && saved.size > 0 && ` (${saved.size})`}
              {t === 'Applied' && applied.size > 0 && ` (${applied.size})`}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', paddingTop: '0.625rem' }}>
            {[...filters.types, ...filters.modes, ...filters.levels, ...filters.categories, ...(filters.dateRange ? [filters.dateRange] : [])].map(chip => (
              <span key={chip} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600 }}>
                {chip}
                <button onClick={() => {
                  if (filters.types.includes(chip)) filterChange('types', filters.types.filter(v => v !== chip));
                  else if (filters.modes.includes(chip)) filterChange('modes', filters.modes.filter(v => v !== chip));
                  else if (filters.levels.includes(chip)) filterChange('levels', filters.levels.filter(v => v !== chip));
                  else if (filters.categories.includes(chip)) filterChange('categories', filters.categories.filter(v => v !== chip));
                  else filterChange('dateRange', '');
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', lineHeight: 1, fontSize: '0.9rem', padding: 0 }}>×</button>
              </span>
            ))}
            <button onClick={clearFilters} style={{ fontSize: '0.75rem', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ padding: '0 1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
        {/* Desktop sidebar filters */}
        {!isMobile && (
          <FiltersPanel filters={filters} onChange={filterChange} onClear={clearFilters} isMobile={false} />
        )}

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* India-first banner + global toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '0.5rem',
            background: showGlobal ? '#F9FAFB' : '#F0FDF4',
            border: `1px solid ${showGlobal ? '#E5E7EB' : '#BBF7D0'}`,
            borderRadius: 10, padding: '0.5rem 0.875rem', marginBottom: '0.875rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem' }}>🇮🇳</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: showGlobal ? '#6B7280' : '#166534' }}>
                {showGlobal ? 'Showing all global opportunities' : 'Showing India-first opportunities'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* English only toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem', color: '#6B7280' }}>
                <input
                  type="checkbox" checked={englishOnly}
                  onChange={e => setEnglishOnly(e.target.checked)}
                  style={{ accentColor: '#84CC16', width: 14, height: 14, cursor: 'pointer' }}
                />
                English only
              </label>
              {/* Show global toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.78rem', color: '#6B7280' }}>
                <input
                  type="checkbox" checked={showGlobal}
                  onChange={e => setShowGlobal(e.target.checked)}
                  style={{ accentColor: '#84CC16', width: 14, height: 14, cursor: 'pointer' }}
                />
                Show global
              </label>
            </div>
          </div>

          {/* Count */}
          {!loading && (
            <div style={{ fontSize: '0.82rem', color: '#9CA3AF', marginBottom: '0.875rem' }}>
              {displayed.length} opportunit{displayed.length === 1 ? 'y' : 'ies'} found
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#92400E' }}>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[...Array(5)].map((_, i) => <OpportunitySkeleton key={i} />)}
            </div>
          ) : displayed.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#111827' }}>
                  {activeTab === 'Saved' ? 'No saved opportunities' : 'No opportunities found'}
                </h3>
                <p style={{ color: '#9CA3AF', margin: 0, fontSize: '0.875rem' }}>
                  {activeTab === 'Saved' ? 'Save opportunities by clicking the bookmark icon.' : 'Try adjusting your search or filters.'}
                </p>
                {activeFilterCount > 0 && (
                  <button className="btn btn-secondary" onClick={clearFilters} style={{ marginTop: '1rem' }}>Clear filters</button>
                )}
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {displayed.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opp={opp}
                  onView={setViewOpp}
                  onSave={handleSave}
                  onApply={handleApplyClick}
                  verified={verified}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filters bottom sheet */}
      {isMobile && showFilters && (
        <FiltersPanel filters={filters} onChange={filterChange} onClear={clearFilters} isMobile onClose={() => setShowFilters(false)} />
      )}

      {/* Detail drawer */}
      {viewOpp && (
        <DetailDrawer
          opp={{ ...viewOpp, isSaved: saved.has(viewOpp.id), isApplied: applied.has(viewOpp.id) }}
          onClose={() => setViewOpp(null)}
          onApply={opp => { setViewOpp(null); handleApplyClick(opp); }}
          onSave={handleSave}
          verified={verified}
        />
      )}

      {/* Apply modal */}
      {applyOpp && (
        <ApplyModal
          opp={applyOpp}
          user={user}
          onClose={() => setApplyOpp(null)}
          onSubmit={handleApplySubmit}
        />
      )}

      {/* Verification required modal */}
      {showVerifModal && (
        <VerificationRequiredModal
          onClose={() => { setShowVerifModal(false); setPendingApply(null); }}
          onVerify={() => { setShowVerifModal(false); window.location.hash = 'settings'; }}
        />
      )}
    </div>
  );
}
