import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle } from './Icons';
import VerifiedBadge from './VerifiedBadge';

function getVideoUrl(post) {
  const vid = post.media?.find(m =>
    typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video'
  );
  const url = typeof vid === 'string' ? vid : vid?.url;
  if (!url) return null;
  // Apply Cloudinary optimisation but preserve the URL structure
  if (url.includes('cloudinary') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return url;
}

export default function ReelsViewer({
  posts,
  startIndex,
  onClose,
  onToggleLike,
  onConnect,
  currentUserId,
  stateLocks,
}) {
  // Collect only video posts
  const videoPosts = posts.filter(p =>
    p.media?.some(m => typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video')
  );
  const total = videoPosts.length;

  const [currentIdx, setCurrentIdx] = useState(startIndex < total ? startIndex : 0);
  const [muted, setMuted] = useState(false);
  const [videoErrors, setVideoErrors] = useState({});
  const containerRef = useRef(null);
  // videoRefs[listIdx] = <video element>
  const videoRefs = useRef({});
  const jumping = useRef(false);
  const lastPlayedIdx = useRef(-1);

  // Lock body scroll + Escape key
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Scroll to correct position on mount (instant, no animation)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || total === 0) return;
    const vh = el.clientHeight || window.innerHeight;
    el.style.scrollSnapType = 'none';
    el.scrollTop = (startIndex < total ? startIndex : 0) * vh;
    requestAnimationFrame(() => {
      if (el) el.style.scrollSnapType = 'y mandatory';
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Play current video, pause ALL others (including both copies)
  useEffect(() => {
    if (total === 0) return;
    const realCurrent = currentIdx % total;

    Object.entries(videoRefs.current).forEach(([key, vid]) => {
      if (!vid) return;
      const k = Number(key);
      const realKey = k % total;

      if (realKey === realCurrent) {
        // Only play the copy that matches the current scroll position
        // If currentIdx < total → play copy 0 (listIdx 0..total-1)
        // If currentIdx >= total → play copy 1 (listIdx total..2*total-1)
        const isCorrectCopy = (currentIdx < total) ? (k < total) : (k >= total);
        if (isCorrectCopy) {
          vid.muted = muted;
          if (vid.paused) {
            vid.play().catch(() => {});
          }
        } else {
          // Wrong copy — pause it
          if (!vid.paused) {
            vid.pause();
            vid.currentTime = 0;
          }
        }
      } else {
        // Different video — always pause
        if (!vid.paused) {
          vid.pause();
          vid.currentTime = 0;
        }
      }
    });
  }, [currentIdx, muted, total]);

  // Scroll handler: detect current index, handle infinite loop
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || jumping.current || total === 0) return;
    const vh = el.clientHeight || window.innerHeight;
    if (vh === 0) return;
    const idx = Math.round(el.scrollTop / vh);

    if (idx >= total) {
      // User scrolled into the second copy — pause ALL second-copy videos first, then jump
      jumping.current = true;
      const newIdx = idx - total;

      // Pause every video in the second copy before jumping
      for (let i = total; i < total * 2; i++) {
        const vid = videoRefs.current[i];
        if (vid && !vid.paused) {
          vid.pause();
          vid.currentTime = 0;
        }
      }

      el.style.scrollSnapType = 'none';
      el.scrollTop = newIdx * vh;
      setCurrentIdx(newIdx);

      requestAnimationFrame(() => {
        if (el) el.style.scrollSnapType = 'y mandatory';
        jumping.current = false;
      });
    } else {
      setCurrentIdx(idx);
    }
  }, [total]);

  if (total === 0) return null;

  // Render TWO copies for seamless infinite loop
  const renderList = [...videoPosts, ...videoPosts];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#000' }}>
      {/* Back button */}
      <button
        onClick={onClose}
        aria-label="Back"
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 100001,
          background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted(v => !v)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100001,
          background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          height: '100vh',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {renderList.map((post, listIdx) => {
          const videoUrl = getVideoUrl(post);
          const isOwn = post.authorId?.toString() === currentUserId?.toString();
          const connStatus = post.connectionStatus;
          const avatarSrc = post.authorImage ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'U')}&background=84CC16&color=fff&size=80`;
          const hasError = videoErrors[listIdx];

          return (
            <div
              key={`${post._id}-${listIdx}`}
              style={{
                height: '100vh', width: '100%',
                scrollSnapAlign: 'start',
                position: 'relative',
                background: '#000',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {/* Video */}
              {videoUrl && !hasError ? (
                <video
                  ref={el => { videoRefs.current[listIdx] = el; }}
                  src={videoUrl}
                  playsInline
                  loop
                  muted={muted}
                  preload="auto"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onClick={() => {
                    const vid = videoRefs.current[listIdx];
                    if (vid) { vid.paused ? vid.play().catch(() => {}) : vid.pause(); }
                  }}
                  onError={() => {
                    setVideoErrors(prev => ({ ...prev, [listIdx]: true }));
                  }}
                />
              ) : (
                // Fallback for broken/missing video
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: '#111',
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '0.75rem' }}>Video unavailable</p>
                </div>
              )}

              {/* Bottom gradient */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 45%)', pointerEvents: 'none' }} />
              {/* Top gradient */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)', pointerEvents: 'none' }} />

              {/* Bottom-left: author + caption */}
              <div style={{ position: 'absolute', bottom: 80, left: 16, right: 80, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                  <img
                    src={avatarSrc}
                    alt={post.authorName}
                    style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid white', flexShrink: 0 }}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'U')}&background=84CC16&color=fff&size=80`; }}
                  />
                  <div>
                    <p style={{ margin: 0, color: 'white', fontWeight: 700, fontSize: '0.9rem', textShadow: '0 1px 4px rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {post.authorName}
                      {post.isAuthorVerified && <VerifiedBadge size={13} />}
                    </p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>
                      {post.authorRole}
                    </p>
                  </div>
                </div>
                {post.content && (
                  <p style={{
                    margin: 0, color: 'white', fontSize: '0.85rem', lineHeight: 1.45,
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {post.content}
                  </p>
                )}
              </div>

              {/* Right side: like + views + connect/chat */}
              <div style={{
                position: 'absolute', bottom: 80, right: 12, zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
              }}>
                {/* Like */}
                <button
                  onClick={() => onToggleLike(post._id)}
                  disabled={stateLocks[post._id]}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: 0 }}
                >
                  {post.isLikedByMe
                    ? <Heart size={28} fill="#EF4444" color="#EF4444" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }} />
                    : <Heart size={28} color="white" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }} />}
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {post.likeCount || 0}
                  </span>
                </button>

                {/* Views */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {post.viewCount || 0}
                  </span>
                </div>

                {/* Connect / Chat */}
                {!isOwn && (
                  connStatus === 'accepted' ? (
                    <button
                      onClick={() => { onClose(); window.location.hash = `chat?userId=${post.authorId}`; }}
                      style={{ background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.8)', borderRadius: 10, padding: '7px 12px', color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(6px)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageCircle size={14} /> Chat
                    </button>
                  ) : connStatus === 'pending' ? (
                    <button disabled style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 700, cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
                      Pending
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onConnect(post.authorId, post._id, e); }}
                      disabled={stateLocks[post.authorId]}
                      style={{ background: '#84CC16', border: 'none', borderRadius: 10, padding: '7px 12px', color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: stateLocks[post.authorId] ? 'not-allowed' : 'pointer', opacity: stateLocks[post.authorId] ? 0.7 : 1, whiteSpace: 'nowrap' }}
                    >
                      {stateLocks[post.authorId] ? '…' : '+ Connect'}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        div[style*="overflow-y: scroll"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
