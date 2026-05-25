import React, { useState, useEffect, useRef } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { postsAPI, connectionsAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import ReelsViewer from '../../shared/ReelsViewer';
import { Edit3, Heart, Eye, MessageCircle, Image } from '../../shared/Icons';
import VerifiedBadge from '../../shared/VerifiedBadge';

// ─── Post type config per role ────────────────────────────────────────────────

const POST_TYPES_BY_ROLE = {
  founder: [
    { value: 'general',          label: 'General' },
    { value: 'service_needed',   label: 'Need Service' },
    { value: 'funding_needed',   label: 'Need Investment' },
  ],
  provider: [
    { value: 'general',          label: 'General' },
    { value: 'offering_service', label: 'Offer Service' },
  ],
  investor: [
    { value: 'general',          label: 'General' },
    { value: 'offering_funding', label: 'Offer Investment' },
  ],
  admin: [
    { value: 'general',          label: 'General' },
  ],
};

// Feed filter tabs per role (what the user wants to see in the feed)
const FEED_FILTERS_BY_ROLE = {
  founder: [
    { value: 'all',              label: 'All Posts' },
    { value: 'offering_service', label: 'Offer Service' },
    { value: 'offering_funding', label: 'Offer Investment' },
    { value: 'general',          label: 'General' },
    { value: 'mine',             label: 'My Posts' },
  ],
  provider: [
    { value: 'all',              label: 'All Posts' },
    { value: 'service_needed',   label: 'Need Service' },
    { value: 'general',          label: 'General' },
    { value: 'mine',             label: 'My Posts' },
  ],
  investor: [
    { value: 'all',              label: 'All Posts' },
    { value: 'funding_needed',   label: 'Need Investment' },
    { value: 'general',          label: 'General' },
    { value: 'mine',             label: 'My Posts' },
  ],
  admin: [
    { value: 'all',              label: 'All Posts' },
    { value: 'mine',             label: 'My Posts' },
  ],
};

// Badge styles for each post type
const POST_TYPE_BADGE = {
  general:          { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', text: 'General' },
  service_needed:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', text: 'Need Service' },
  funding_needed:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', text: 'Need Investment' },
  offering_service: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', text: 'Offer Service' },
  offering_funding: { bg: '#F5F3FF', color: '#7C3AED', border: '#C4B5FD', text: 'Offer Investment' },
};

const getPostTypeBadge = (postType) => {
  const s = POST_TYPE_BADGE[postType] || POST_TYPE_BADGE.general;
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      padding: '4px 10px', borderRadius: '20px',
      fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
    }}>
      {s.text}
    </span>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTimeAgo = (date) => {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

// ─── Component ────────────────────────────────────────────────────────────────

const PostsPage = () => {
  const { user } = useAuth();
  const role = user?.role || 'founder';

  const postTypes   = POST_TYPES_BY_ROLE[role]   || POST_TYPES_BY_ROLE.founder;
  const feedFilters = FEED_FILTERS_BY_ROLE[role]  || FEED_FILTERS_BY_ROLE.founder;

  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [page, setPage]             = useState(1);
  const [filter, setFilter]         = useState('all');

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [postContent, setPostContent]         = useState('');
  const [postType, setPostType]               = useState('general'); // default: general
  const [postTags, setPostTags]               = useState('');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
  const [mediaPreview, setMediaPreview]       = useState([]);
  const [uploading, setUploading]             = useState(false);

  const [stateLocks, setStateLocks] = useState({});
  const [reelsOpen, setReelsOpen]   = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);

  const observerTarget = useRef(null);
  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  useEffect(() => { loadPosts(true); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) loadMorePosts(); },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPosts = async (reset = false) => {
    if (loading && !reset) return;
    setLoading(true);
    const currentPage = reset ? 1 : page;
    try {
      const response = await postsAPI.getFeed(filter, currentPage, 20);
      const newPosts = response.posts || [];
      if (reset) { setPosts(newPosts); setPage(2); }
      else { setPosts(prev => [...prev, ...newPosts]); setPage(prev => prev + 1); }
      setHasMore(response.pagination?.hasMore || newPosts.length === 20);
      newPosts.forEach(post => {
        if (post.authorId !== user?._id) postsAPI.trackView(post._id).catch(() => {});
      });
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = () => { if (!loading && hasMore) loadPosts(false); };

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    if (selectedMediaFiles.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`); return;
    }
    const valid = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} too large (max 100MB)`); continue; }
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        toast.error(`${f.name} is not a valid image or video`); continue;
      }
      valid.push(f);
    }
    setSelectedMediaFiles(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview(prev => [...prev, { url: reader.result, type: f.type, name: f.name }]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removeMedia = (i) => {
    setSelectedMediaFiles(prev => prev.filter((_, idx) => idx !== i));
    setMediaPreview(prev => prev.filter((_, idx) => idx !== i));
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!postContent.trim() && selectedMediaFiles.length === 0) {
      toast.error('Post must have content or media'); return;
    }
    setUploading(true);
    try {
      const tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
      await postsAPI.createPost(postContent.trim(), postType, tags, selectedMediaFiles);
      toast.success('Post created!');
      setCreateModalOpen(false);
      setPostContent(''); setPostTags(''); setPostType('general');
      setSelectedMediaFiles([]); setMediaPreview([]);
      setFilter('mine'); setPage(1); setHasMore(true);
      loadPosts(true);
    } catch (err) {
      toast.error(err.message || 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (postId) => {
    if (stateLocks[postId]) return;
    setStateLocks(prev => ({ ...prev, [postId]: true }));
    setPosts(prev => prev.map(p => p._id === postId
      ? { ...p, isLikedByMe: !p.isLikedByMe, likeCount: p.isLikedByMe ? (p.likeCount || 1) - 1 : (p.likeCount || 0) + 1 }
      : p
    ));
    try {
      await postsAPI.toggleLike(postId);
    } catch {
      setPosts(prev => prev.map(p => p._id === postId
        ? { ...p, isLikedByMe: !p.isLikedByMe, likeCount: p.isLikedByMe ? (p.likeCount || 1) - 1 : (p.likeCount || 0) + 1 }
        : p
      ));
      toast.error('Failed to update like');
    } finally {
      setStateLocks(prev => { const n = { ...prev }; delete n[postId]; return n; });
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await postsAPI.deletePost(postId);
      toast.success('Post deleted');
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  const sendConnectionRequest = async (userId, postId, e) => {
    if (e) e.stopPropagation();
    if (stateLocks[userId]) return;
    setStateLocks(prev => ({ ...prev, [userId]: true }));
    try {
      const result = await connectionsAPI.sendConnectionRequest(userId);
      toast.success('Connection request sent!');
      setPosts(prev => prev.map(p =>
        p.authorId?.toString() === userId?.toString()
          ? { ...p, connectionStatus: result.status || 'pending' }
          : p
      ));
    } catch (err) {
      if (err.status === 400 && err.data?.status) {
        setPosts(prev => prev.map(p =>
          p.authorId?.toString() === userId?.toString()
            ? { ...p, connectionStatus: err.data.status }
            : p
        ));
        toast.error(err.data.message || 'Connection already exists');
      } else {
        toast.error(err.message || 'Failed to send request');
      }
    } finally {
      setStateLocks(prev => { const n = { ...prev }; delete n[userId]; return n; });
    }
  };

  const renderMediaGallery = (media, postId) => {
    if (!media || media.length === 0) return null;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: media.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {media.map((item, index) => {
          const isVideo = typeof item === 'string' ? item.includes('.mp4') || item.includes('video') : item.type === 'video';
          const url = typeof item === 'string' ? item : item.url;
          const opt = url?.includes('cloudinary') ? url.replace('/upload/', '/upload/f_auto,q_auto/') : url;
          if (isVideo) {
            return (
              <div key={index} style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000' }}
                onClick={() => {
                  const vp = posts.filter(p => p.media?.some(m => (typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video')));
                  const idx = vp.findIndex(p => p._id === postId);
                  setReelsStartIndex(idx >= 0 ? idx : 0);
                  setReelsOpen(true);
                }}>
                <video src={opt} preload="metadata" playsInline muted style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <img key={index} src={opt} alt={`Post media ${index + 1}`} loading="lazy"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block', cursor: 'pointer' }}
              onClick={() => window.open(url, '_blank')} />
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {reelsOpen && (
        <ReelsViewer posts={posts} startIndex={reelsStartIndex} onClose={() => setReelsOpen(false)}
          onToggleLike={toggleLike} onConnect={sendConnectionRequest}
          currentUserId={user?._id} stateLocks={stateLocks} />
      )}

      <PageHeader title="Community Posts" subtitle="Share updates and connect with the community" />

      {/* Top bar: Create + Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <Edit3 size={16} /> Create Post
        </button>

        {/* Feed filter tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {feedFilters.map(f => (
            <button key={f.value}
              className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f.value)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Feed */}
      {loading && posts.length === 0 ? (
        <LoadingSpinner message="Loading posts..." />
      ) : posts.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            {filter === 'mine' ? "You haven't posted anything yet." : 'No posts in this category yet.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {posts.map(post => {
            const imgSrc = post.authorImage ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`;
            const optImg = imgSrc.includes('cloudinary') ? imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/') : imgSrc;
            const isOwn = user?._id && post.authorId?.toString() === user._id?.toString();
            const status = post.connectionStatus;

            let actionButtons = null;
            if (filter === 'mine' || isOwn) {
              actionButtons = (
                <button onClick={() => deletePost(post._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '8px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              );
            } else if (!isOwn) {
              if (status === 'accepted') {
                actionButtons = (
                  <button onClick={() => { window.location.hash = `chat?userId=${post.authorId}`; }}
                    style={{ padding: '8px 16px', background: '#84CC16', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageCircle size={16} /> Chat
                  </button>
                );
              } else if (status === 'pending') {
                actionButtons = (
                  <button disabled style={{ padding: '8px 16px', background: '#e5e7eb', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500', cursor: 'not-allowed' }}>
                    Pending
                  </button>
                );
              } else {
                actionButtons = (
                  <button onClick={e => sendConnectionRequest(post.authorId, post._id, e)}
                    disabled={stateLocks[post.authorId]}
                    style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500', cursor: stateLocks[post.authorId] ? 'not-allowed' : 'pointer', opacity: stateLocks[post.authorId] ? 0.7 : 1 }}>
                    {stateLocks[post.authorId] ? 'Sending...' : 'Connect'}
                  </button>
                );
              }
            }

            return (
              <Card key={post._id} style={{ padding: '1.5rem' }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                  <img src={optImg} alt={post.authorName} loading="lazy"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`; }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{post.authorName}</span>
                      {post.isAuthorVerified && <VerifiedBadge size={14} />}
                      <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '12px' }}>
                        {post.authorRole}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{getTimeAgo(post.createdAt)}</div>
                  </div>
                  {/* Only show badge if not general */}
                  {post.postType && post.postType !== 'general' && getPostTypeBadge(post.postType)}
                </div>

                {/* Content */}
                {post.content && (
                  <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: post.media?.length > 0 ? '1rem' : '0.75rem', whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </p>
                )}

                {renderMediaGallery(post.media, post._id)}

                {/* Tags */}
                {post.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {post.tags.map((tag, idx) => (
                      <span key={idx} style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button onClick={() => toggleLike(post._id)} disabled={stateLocks[post._id]}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: stateLocks[post._id] ? 'not-allowed' : 'pointer', fontSize: '1rem', color: '#6b7280', padding: '8px', borderRadius: '8px' }}>
                    {post.isLikedByMe
                      ? <Heart size={20} fill="#EF4444" color="#EF4444" />
                      : <Heart size={20} color="#9CA3AF" />}
                    <span style={{ fontWeight: '600' }}>{post.likeCount || 0}</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      <Eye size={16} /> {post.viewCount || 0}
                    </div>
                    {actionButtons}
                  </div>
                </div>
              </Card>
            );
          })}

          <div ref={observerTarget} style={{ height: '20px' }}>
            {loading && <LoadingSpinner message="Loading more posts..." />}
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <Modal isOpen={createModalOpen} onClose={() => !uploading && setCreateModalOpen(false)} title="Create Post" maxWidth="600px">
        <form onSubmit={createPost}>
          {/* Post type selector */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Category</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {postTypes.map(pt => (
                <button key={pt.value} type="button"
                  onClick={() => setPostType(pt.value)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: postType === pt.value ? (POST_TYPE_BADGE[pt.value]?.bg || '#F0FDF4') : 'white',
                    color: postType === pt.value ? (POST_TYPE_BADGE[pt.value]?.color || '#166534') : '#6B7280',
                    border: `1.5px solid ${postType === pt.value ? (POST_TYPE_BADGE[pt.value]?.border || '#84CC16') : '#E5E7EB'}`,
                  }}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <textarea className="form-textarea" placeholder="What's on your mind?"
            value={postContent} onChange={e => setPostContent(e.target.value)}
            rows="4" style={{ marginBottom: '1rem' }} disabled={uploading} />

          {/* Media Preview */}
          {mediaPreview.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {mediaPreview.map((preview, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  {preview.type.startsWith('video') ? (
                    <video src={preview.url} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <img src={preview.url} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  )}
                  <button type="button" onClick={() => removeMedia(index)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media Upload */}
          <div style={{ marginBottom: '1rem' }}>
            <input type="file" id="post-media-input" accept="image/jpeg,image/png,image/gif,video/mp4" multiple
              style={{ display: 'none' }} onChange={handleMediaSelect}
              disabled={uploading || selectedMediaFiles.length >= MAX_FILES} />
            <button type="button" className="btn btn-secondary"
              onClick={() => document.getElementById('post-media-input').click()}
              disabled={uploading || selectedMediaFiles.length >= MAX_FILES}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Image size={16} /> Add Media ({selectedMediaFiles.length}/{MAX_FILES})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary"
              disabled={uploading || (!postContent.trim() && selectedMediaFiles.length === 0)}
              style={{ flex: 1 }}>
              {uploading ? 'Posting...' : 'Post'}
            </button>
            <button type="button" className="btn btn-secondary"
              onClick={() => setCreateModalOpen(false)} disabled={uploading} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PostsPage;
