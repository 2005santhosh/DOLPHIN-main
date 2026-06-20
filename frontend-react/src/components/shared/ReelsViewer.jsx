import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, MessageCircle } from './Icons';
import VerifiedBadge from './VerifiedBadge';
import toast from 'react-hot-toast';
import { postsAPI } from '../../services/api';

function getVideoUrl(post) {
  const vid = post.media?.find(m =>
    typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video'
  );
  const url = typeof vid === 'string' ? vid : vid?.url;
  if (!url) return null;
  return url;
}

// Get a thumbnail/poster image for a video — used to prevent black screen
// while the video is loading. Uses Cloudinary's auto-generated thumbnail.
function getVideoPoster(post) {
  const vid = post.media?.find(m =>
    typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video'
  );
  // Check if there's an explicit thumbnail stored
  const thumbnail = typeof vid === 'object' ? vid?.thumbnail : null;
  if (thumbnail) return thumbnail;

  const url = typeof vid === 'string' ? vid : vid?.url;
  if (!url) return null;

  // Generate Cloudinary thumbnail: swap resource type video→image, replace extension
  if (url.includes('cloudinary') && url.includes('/video/upload/')) {
    return url
      .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto:low/')
      .replace(/\.(mp4|mov|avi|mkv|webm)(\?.*)?$/, '.jpg');
  }
  return null;
}

export default function ReelsViewer({
  posts,
  startIndex,
  onClose,
  onToggleLike,
  onConnect,
  currentUserId,
  stateLocks,
  // Live post state ref — allows like/connect to update without re-mounting
  livePostsRef,
}) {
  // Filter to video-only posts
  const videoPosts = posts.filter(p =>
    p.media?.some(m => typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video')
  );
  const total = videoPosts.length;

  const [currentIdx, setCurrentIdx] = useState(startIndex < total ? startIndex : 0);
  const [muted, setMuted] = useState(false);
  const [videoErrors, setVideoErrors] = useState({});
  // Comments overlay state
  const [commentPostId, setCommentPostId] = useState(null);
  const [comments, setComments]           = useState([]);
  const [commentText, setCommentText]     = useState('');
  const [commentLoading, setCL]           = useState(false);
  const [commentSending, setCS]           = useState(false);
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
      const dist = Math.abs(realKey - realCurrent);

      // Lazy-load src: assign from data-src when within 3 positions
      if (dist <= 3 && !vid.src && vid.dataset.src) {
        vid.src = vid.dataset.src;
      }

      if (realKey === realCurrent) {
        const isCorrectCopy = (currentIdx < total) ? (k < total) : (k >= total);
        if (isCorrectCopy) {
          // Ensure src is set before playing
          if (!vid.src && vid.dataset.src) vid.src = vid.dataset.src;
          vid.muted = muted;
          if (vid.paused) vid.play().catch(() => {});
        } else {
          if (!vid.paused) { vid.pause(); vid.currentTime = 0; }
        }
      } else {
        if (!vid.paused) { vid.pause(); vid.currentTime = 0; }
        // Unload src for far-away videos to free memory
        if (dist > 5 && vid.src && vid.dataset.src) {
          vid.pause();
          vid.removeAttribute('src');
          vid.load(); // reset the media element
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
          const videoPoster = getVideoPoster(post);
          const isOwn = post.authorId?.toString() === currentUserId?.toString();
          // Use live post state if available (so like/connect updates reflect immediately)
          const livePost = livePostsRef?.current?.find(p => p._id?.toString() === post._id?.toString()) || post;
          // connectionStatus: prefer live feed state (has up-to-date status after connect actions)
          // fall back to what came with the post itself (now enriched by /videos endpoint)
          const connStatus = livePost.connectionStatus !== undefined ? livePost.connectionStatus : post.connectionStatus;
          const isLikedByMe = livePost.isLikedByMe;
          const likeCount   = livePost.likeCount || 0;
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
                  src={Math.abs((listIdx % total) - (currentIdx % total)) <= 3 ? videoUrl : undefined}
                  data-src={videoUrl}
                  poster={videoPoster || undefined}
                  playsInline
                  loop
                  muted={muted}
                  preload={
                    (listIdx % total) === (currentIdx % total)
                      ? 'auto'
                      : Math.abs((listIdx % total) - (currentIdx % total)) === 1
                        ? 'metadata'
                        : 'none'
                  }
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
                  onClick={() => {
                    const vid = videoRefs.current[listIdx];
                    if (vid) { vid.paused ? vid.play().catch(() => {}) : vid.pause(); }
                  }}
                  onError={(e) => {
                    // Only mark as error if it's a real network/decode error, not an abort
                    const mediaError = e.target.error;
                    if (mediaError && mediaError.code !== MediaError.MEDIA_ERR_ABORTED) {
                      setVideoErrors(prev => ({ ...prev, [listIdx]: true }));
                    }
                  }}
                  onCanPlay={(e) => {
                    const realCurrent = currentIdx % total;
                    const realKey = listIdx % total;
                    const isCorrectCopy = (currentIdx < total) ? (listIdx < total) : (listIdx >= total);
                    if (realKey === realCurrent && isCorrectCopy) {
                      e.target.muted = muted;
                      e.target.play().catch(() => {});
                    }
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

              {/* Right side: like + views + comment + share + connect/chat */}
              <div style={{
                position: 'absolute', bottom: 80, right: 12, zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
              }}>
                {/* Like */}
                <button onClick={() => onToggleLike(post._id)} disabled={stateLocks[post._id]}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: 0 }}>
                  {isLikedByMe
                    ? <Heart size={28} fill="#EF4444" color="#EF4444" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }} />
                    : <Heart size={28} color="white" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }} />}
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{likeCount}</span>
                </button>

                {/* Comment */}
                <button
                  onClick={async () => {
                    setCommentPostId(post._id);
                    setCL(true);
                    try { const d = await postsAPI.getComments(post._id); setComments(d); } catch {}
                    finally { setCL(false); }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: 0 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>Comment</span>
                </button>

                {/* Share */}
                <button
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) navigator.share({ title: `${post.authorName}'s video on Dolphin`, url }).catch(() => {});
                    else navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => {});
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: 0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}>
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>Share</span>
                </button>

                {/* Views */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.9))' }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{post.viewCount || 0}</span>
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

      {/* Comments overlay — slides up from bottom */}
      {commentPostId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100002, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setCommentPostId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #F3F4F6' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Comments</h3>
              <button onClick={() => setCommentPostId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {commentLoading ? <p style={{ color: '#9CA3AF', textAlign: 'center' }}>Loading…</p>
                : comments.length === 0 ? <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '1rem' }}>No comments yet.</p>
                : comments.map(c => (
                  <div key={c._id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <img src={c.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.authorName || 'U')}&background=84CC16&color=fff&size=64`} alt=""
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, aspectRatio: '1/1' }} />
                    <div>
                      <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '7px 12px', display: 'inline-block' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#111827', marginRight: 6 }}>{c.authorName}</span>
                        <span style={{ fontSize: '0.875rem', color: '#374151' }}>{c.content}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!commentText.trim() || commentSending) return;
              setCS(true);
              try {
                const c = await postsAPI.addComment(commentPostId, commentText.trim());
                setComments(prev => [...prev, c]);
                setCommentText('');
              } catch { toast.error('Failed'); }
              finally { setCS(false); }
            }} style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', borderTop: '1px solid #F3F4F6', alignItems: 'center', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment…" maxLength={500}
                style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 20, padding: '8px 14px', fontSize: '0.9rem', outline: 'none', background: '#F9FAFB' }} />
              <button type="submit" disabled={!commentText.trim() || commentSending}
                style={{ background: 'none', border: 'none', cursor: commentText.trim() ? 'pointer' : 'not-allowed', padding: 0, opacity: commentText.trim() ? 1 : 0.4 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84CC16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
