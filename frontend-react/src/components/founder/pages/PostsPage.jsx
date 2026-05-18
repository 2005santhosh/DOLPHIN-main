import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '../../shared/PageHeader';
import Card from '../../shared/Card';
import Modal from '../../shared/Modal';
import LoadingSpinner from '../../shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { postsAPI, connectionsAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import ReelsViewer from '../../shared/ReelsViewer';

// Helper functions
const escapeXSS = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const getTimeAgo = (date) => {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const getPostTypeBadge = (postType) => {
  const styles = {
    service_needed: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', text: 'Needs Service' },
    funding_needed: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', text: 'Needs Investment' },
    offering_service: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', text: 'Offering Service' },
    offering_funding: { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', text: 'Looking to Invest' },
  };
  const s = styles[postType] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', text: postType };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: '600',
        whiteSpace: 'nowrap',
      }}
    >
      {s.text}
    </span>
  );
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const PostsPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('service_needed');
  const [postTags, setPostTags] = useState('');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
  const [mediaPreview, setMediaPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const observerTarget = useRef(null);
  const [stateLocks, setStateLocks] = useState({});
  const [reelsOpen, setReelsOpen] = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);

  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  useEffect(() => {
    loadPosts(true);
  }, [filter]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMorePosts();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  const loadPosts = async (reset = false) => {
    if (loading && !reset) return;

    setLoading(true);
    const currentPage = reset ? 1 : page;

    try {
      const response = await postsAPI.getFeed(filter, currentPage, 20);
      const newPosts = response.posts || [];

      if (reset) {
        setPosts(newPosts);
        setPage(2);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
        setPage((prev) => prev + 1);
      }

      setHasMore(response.pagination?.hasMore || newPosts.length === 20);

      // Track views for non-own posts
      newPosts.forEach((post) => {
        if (post.authorId !== user?._id) {
          postsAPI.trackView(post._id).catch(() => {});
        }
      });
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = () => {
    if (!loading && hasMore) {
      loadPosts(false);
    }
  };

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);

    if (selectedMediaFiles.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed per post`);
      return;
    }

    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large. Maximum size is 100MB`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast.error(`${file.name} is not a valid image or video file`);
        continue;
      }

      validFiles.push(file);
    }

    setSelectedMediaFiles((prev) => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview((prev) => [...prev, { url: reader.result, type: file.type, name: file.name, size: file.size }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = ''; // Reset input
  };

  const removeMedia = (index) => {
    setSelectedMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const createPost = async (e) => {
    e.preventDefault();

    if (!postContent.trim() && selectedMediaFiles.length === 0) {
      toast.error('Post must have content or media');
      return;
    }

    setUploading(true);

    try {
      const tags = postTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

      await postsAPI.createPost(postContent.trim(), postType, tags, selectedMediaFiles);

      toast.success('Post created successfully!');
      setCreateModalOpen(false);
      setPostContent('');
      setPostTags('');
      setPostType('service_needed');
      setSelectedMediaFiles([]);
      setMediaPreview([]);

      // Switch to "My Posts" tab and reload
      setFilter('mine');
      setPage(1);
      setHasMore(true);
      loadPosts(true);
    } catch (error) {
      toast.error(error.message || 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (postId) => {
    if (stateLocks[postId]) return;

    setStateLocks((prev) => ({ ...prev, [postId]: true }));

    // Optimistic update
    setPosts((prev) =>
      prev.map((post) => {
        if (post._id === postId) {
          const isLiked = post.isLikedByMe;
          return {
            ...post,
            isLikedByMe: !isLiked,
            likeCount: isLiked ? (post.likeCount || 1) - 1 : (post.likeCount || 0) + 1,
          };
        }
        return post;
      })
    );

    try {
      await postsAPI.toggleLike(postId);
    } catch (error) {
      // Revert on error
      setPosts((prev) =>
        prev.map((post) => {
          if (post._id === postId) {
            const isLiked = post.isLikedByMe;
            return {
              ...post,
              isLikedByMe: !isLiked,
              likeCount: isLiked ? (post.likeCount || 1) - 1 : (post.likeCount || 0) + 1,
            };
          }
          return post;
        })
      );
      toast.error('Failed to update like');
    } finally {
      setStateLocks((prev) => {
        const newLocks = { ...prev };
        delete newLocks[postId];
        return newLocks;
      });
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await postsAPI.deletePost(postId);
      toast.success('Post deleted');
      setPosts((prev) => prev.filter((post) => post._id !== postId));
    } catch (error) {
      toast.error(error.message || 'Failed to delete post');
    }
  };

  const sendConnectionRequest = async (userId, postId, e) => {
    if (e) e.stopPropagation();
    if (stateLocks[userId]) return;

    setStateLocks((prev) => ({ ...prev, [userId]: true }));

    try {
      await connectionsAPI.sendConnectionRequest(userId);
      toast.success('Connection request sent!');

      // Update connectionStatus on ALL posts by this author
      setPosts((prev) =>
        prev.map((post) => {
          if (post.authorId?.toString() === userId?.toString()) {
            return { ...post, connectionStatus: 'pending' };
          }
          return post;
        })
      );
    } catch (error) {
      toast.error(error.message || 'Failed to send request');
    } finally {
      setStateLocks((prev) => {
        const newLocks = { ...prev };
        delete newLocks[userId];
        return newLocks;
      });
    }
  };

  const renderMediaGallery = (media, postId) => {
    if (!media || media.length === 0) return null;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: media.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        {media.map((item, index) => {
          const isVideo = typeof item === 'string'
            ? item.includes('.mp4') || item.includes('video')
            : item.type === 'video';
          const url = typeof item === 'string' ? item : item.url;
          const optimizedUrl = url?.includes('cloudinary')
            ? url.replace('/upload/', '/upload/f_auto,q_auto/')
            : url;

          if (isVideo) {
            return (
              <div
                key={index}
                style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000' }}
                onClick={() => {
                  // Find this post's index among video posts at click time
                  const vp = posts.filter(p => p.media?.some(m => (typeof m === 'string' ? m.includes('.mp4') || m.includes('video') : m.type === 'video')));
                  const idx = vp.findIndex(p => p._id === postId);
                  setReelsStartIndex(idx >= 0 ? idx : 0);
                  setReelsOpen(true);
                }}
              >
                <video
                  src={optimizedUrl}
                  preload="metadata"
                  playsInline
                  muted
                  style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.25)',
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <img
              key={index}
              src={optimizedUrl}
              alt={`Post media ${index + 1}`}
              loading="lazy"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', display: 'block', cursor: 'pointer' }}
              onClick={() => window.open(url, '_blank')}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {/* Instagram Reels-style video viewer */}
      {reelsOpen && (
        <ReelsViewer
          posts={posts}
          startIndex={reelsStartIndex}
          onClose={() => setReelsOpen(false)}
          onToggleLike={toggleLike}
          onConnect={sendConnectionRequest}
          currentUserId={user?._id}
          stateLocks={stateLocks}
        />
      )}

      <PageHeader title="Community Posts" subtitle="Share updates and connect with the community" />

      {/* Create Post Button & Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
          ✏️ Create Post
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>
            All Posts
          </button>
          <button className={`btn ${filter === 'mine' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('mine')}>
            My Posts
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      {loading && posts.length === 0 ? (
        <LoadingSpinner message="Loading posts..." />
      ) : posts.length === 0 ? (
        <Card>
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            {filter === 'mine' ? "You haven't posted anything yet." : 'No posts yet. Be the first to share!'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {posts.map((post) => {
            const imgSrc =
              post.authorImage ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`;
            const optimizedImgSrc = imgSrc.includes('cloudinary') ? imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/') : imgSrc;

            let actionButtons = null;
            if (filter === 'mine') {
              actionButtons = (
                <button
                  onClick={() => deletePost(post._id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--error)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete
                </button>
              );
            } else if (user?._id && post.authorId !== user._id) {
              const status = post.connectionStatus;
              if (status === 'accepted') {
                actionButtons = (
                  <button
                    onClick={() => { window.location.hash = 'chat'; }}
                    style={{ padding: '8px 16px', background: '#84CC16', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer' }}
                  >
                    💬 Chat
                  </button>
                );
              } else if (status === 'pending') {
                actionButtons = (
                  <button
                    disabled
                    style={{
                      padding: '8px 16px',
                      background: '#e5e7eb',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      cursor: 'not-allowed',
                    }}
                  >
                    Pending
                  </button>
                );
              } else {
                actionButtons = (
                  <button
                    onClick={(e) => sendConnectionRequest(post.authorId, post._id, e)}
                    disabled={stateLocks[post.authorId]}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      cursor: stateLocks[post.authorId] ? 'not-allowed' : 'pointer',
                      opacity: stateLocks[post.authorId] ? 0.7 : 1,
                    }}
                  >
                    {stateLocks[post.authorId] ? 'Sending...' : 'Connect'}
                  </button>
                );
              }
            }

            return (
              <Card key={post._id} style={{ padding: '1.5rem' }}>
                {/* Post Header */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                  <img
                    src={optimizedImgSrc}
                    alt={post.authorName}
                    loading="lazy"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`;
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{post.authorName}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: '#f3f4f6',
                          color: '#6b7280',
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        ({post.authorRole})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{getTimeAgo(post.createdAt)}</div>
                  </div>
                  {getPostTypeBadge(post.postType)}
                </div>

                {/* Post Content */}
                {post.content && (
                  <p
                    style={{
                      color: 'var(--text-primary)',
                      lineHeight: 1.6,
                      marginBottom: post.media?.length > 0 ? '1rem' : '0.75rem',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {post.content}
                  </p>
                )}

                {/* Post Media */}
                {renderMediaGallery(post.media, post._id)}

                {/* Post Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {post.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Post Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    onClick={() => toggleLike(post._id)}
                    disabled={stateLocks[post._id]}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: stateLocks[post._id] ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      color: '#6b7280',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: '0.2s',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{post.isLikedByMe ? '❤️' : '🤍'}</span>
                    <span style={{ fontWeight: '600' }}>{post.likeCount || 0}</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      👁️ {post.viewCount || post.views || 0}
                    </div>
                    {actionButtons}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Infinite Scroll Trigger */}
          <div ref={observerTarget} style={{ height: '20px' }}>
            {loading && <LoadingSpinner message="Loading more posts..." />}
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => !uploading && setCreateModalOpen(false)}
        title="Create Post"
        maxWidth="600px"
      >
        <form onSubmit={createPost}>
          <textarea
            className="form-textarea"
            placeholder="What's on your mind?"
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            rows="4"
            style={{ marginBottom: '1rem' }}
            disabled={uploading}
          />

          {/* Media Preview */}
          {mediaPreview.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              {mediaPreview.map((preview, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  {preview.type.startsWith('video') ? (
                    <video
                      src={preview.url}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    />
                  ) : (
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Media Upload */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="file"
              id="post-media-input"
              accept="image/jpeg,image/png,image/gif,video/mp4"
              multiple
              style={{ display: 'none' }}
              onChange={handleMediaSelect}
              disabled={uploading || selectedMediaFiles.length >= MAX_FILES}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => document.getElementById('post-media-input').click()}
              disabled={uploading || selectedMediaFiles.length >= MAX_FILES}
              style={{ width: '100%' }}
            >
              📷 Add Media ({selectedMediaFiles.length}/{MAX_FILES})
            </button>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || (!postContent.trim() && selectedMediaFiles.length === 0)}
              style={{ flex: 1 }}
            >
              {uploading ? 'Posting...' : 'Post'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={uploading}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PostsPage;
