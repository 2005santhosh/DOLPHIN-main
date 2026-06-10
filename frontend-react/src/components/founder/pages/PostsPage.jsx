import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  founder:  [{ value: 'general', label: 'General' }, { value: 'service_needed', label: 'Need Service' }, { value: 'funding_needed', label: 'Need Investment' }],
  provider: [{ value: 'general', label: 'General' }, { value: 'offering_service', label: 'Offer Service' }],
  investor: [{ value: 'general', label: 'General' }, { value: 'offering_funding', label: 'Offer Investment' }],
  admin:    [{ value: 'general', label: 'General' }],
};

const FEED_FILTERS_BY_ROLE = {
  founder:  [{ value: 'all', label: 'All Posts' }, { value: 'offering_service', label: 'Offer Service' }, { value: 'offering_funding', label: 'Offer Investment' }, { value: 'general', label: 'General' }, { value: 'mine', label: 'My Posts' }],
  provider: [{ value: 'all', label: 'All Posts' }, { value: 'service_needed', label: 'Need Service' }, { value: 'general', label: 'General' }, { value: 'mine', label: 'My Posts' }],
  investor: [{ value: 'all', label: 'All Posts' }, { value: 'funding_needed', label: 'Need Investment' }, { value: 'general', label: 'General' }, { value: 'mine', label: 'My Posts' }],
  admin:    [{ value: 'all', label: 'All Posts' }, { value: 'mine', label: 'My Posts' }],
};

const POST_TYPE_BADGE = {
  general:          { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB', text: 'General' },
  service_needed:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', text: 'Need Service' },
  funding_needed:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', text: 'Need Investment' },
  offering_service: { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', text: 'Offer Service' },
  offering_funding: { bg: '#F5F3FF', color: '#7C3AED', border: '#C4B5FD', text: 'Offer Investment' },
};

const getPostTypeBadge = (postType) => {
  const s = POST_TYPE_BADGE[postType] || POST_TYPE_BADGE.general;
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{s.text}</span>;
};

const getTimeAgo = (date) => {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

// ─── Image compression (browser-side, before upload) ─────────────────────────
// Reduces image size by 5-15x before sending to Cloudinary.
// Uses canvas to re-encode at lower quality/dimensions.
async function compressImage(file) {
  // Skip if not an image or already small (< 300KB — not worth compressing)
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file;
  // Skip GIFs — canvas destroys animation
  if (file.type === 'image/gif') return file;

  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      // Cap at 1920px on longest side — enough for any social post
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      // Quality 0.82 = visually lossless, ~70% smaller than original
      canvas.toBlob(blob => {
        if (!blob || blob.size >= file.size) { resolve(file); return; } // no gain
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ─── Format helpers for speed/ETA display ────────────────────────────────────
function fmtSpeed(bps) {
  if (bps <= 0) return '—';
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}

function fmtEta(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s left`;
}

function fmtBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ─── Speed tracker (rolling 3-second window) ─────────────────────────────────
// Returns { speedBps, etaSec } given current loaded/total bytes.
function makeSpeedTracker(totalBytes) {
  // Sliding window: store [{ t, loaded }] for the last 3 seconds
  const window = [];
  const WINDOW_MS = 3000;

  return function track(loadedBytes) {
    const now = Date.now();
    window.push({ t: now, loaded: loadedBytes });

    // Prune entries older than WINDOW_MS
    while (window.length > 1 && now - window[0].t > WINDOW_MS) window.shift();

    if (window.length < 2) return { speedBps: 0, etaSec: Infinity };

    const oldest = window[0];
    const elapsed = (now - oldest.t) / 1000; // seconds
    if (elapsed <= 0) return { speedBps: 0, etaSec: Infinity };

    const bytesDelta = loadedBytes - oldest.loaded;
    const speedBps = bytesDelta / elapsed;
    const remaining = totalBytes - loadedBytes;
    const etaSec = speedBps > 0 ? remaining / speedBps : Infinity;

    return { speedBps, etaSec };
  };
}

// ─── Chunked upload to Cloudinary (large video support) ───────────────────────
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks

async function uploadToCloudinary(file, sigData, onProgress) {
  const isVideo = file.type.startsWith('video/');
  if (file.size <= CHUNK_SIZE) {
    return uploadChunkSimple(file, sigData, onProgress, isVideo);
  }
  return uploadChunked(file, sigData, onProgress, isVideo);
}

function buildFormData(file, sigData) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sigData.apiKey);
  fd.append('timestamp', String(sigData.timestamp));
  fd.append('signature', sigData.signature);
  fd.append('folder', sigData.folder);
  return fd;
}

// onProgress(loadedBytes, totalBytes) — passes raw bytes for speed calculation
function xhrUpload(url, fd, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid Cloudinary response')); }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.error?.message || `Upload failed (${xhr.status})`));
        } catch { reject(new Error(`Upload failed (${xhr.status})`)); }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(fd);
  });
}

async function uploadChunkSimple(file, sigData, onProgress, isVideo) {
  const fd = buildFormData(file, sigData);
  const url = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${isVideo ? 'video' : 'image'}/upload`;
  return xhrUpload(url, fd, {}, onProgress);
}

async function uploadChunked(file, sigData, onProgress, isVideo) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${isVideo ? 'video' : 'image'}/upload`;

  let lastResult = null;
  let uploadedBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const fd = buildFormData(chunk, sigData);
    const headers = {
      'X-Unique-Upload-Id': uploadId,
      'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
    };

    lastResult = await xhrUpload(url, fd, headers, (chunkLoaded, chunkTotal) => {
      const totalLoaded = uploadedBytes + chunkLoaded;
      if (onProgress) onProgress(totalLoaded, file.size);
    });

    uploadedBytes = end;
    if (onProgress) onProgress(uploadedBytes, file.size);
  }

  return lastResult;
}

// ─── Component ────────────────────────────────────────────────────────────────
const PostsPage = () => {
  const { user } = useAuth();
  const role = user?.role || 'founder';
  const postTypes   = POST_TYPES_BY_ROLE[role]  || POST_TYPES_BY_ROLE.founder;
  const feedFilters = FEED_FILTERS_BY_ROLE[role] || FEED_FILTERS_BY_ROLE.founder;

  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [page, setPage]         = useState(1);
  const [filter, setFilter]     = useState('all');
  const [dailyLimit, setDailyLimit] = useState({ remaining: 5, usedToday: 0, dailyLimit: 5 });

  // Create modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [postContent, setPostContent]         = useState('');
  const [postType, setPostType]               = useState('general');
  const [postTags, setPostTags]               = useState('');
  const [selectedFiles, setSelectedFiles]     = useState([]); // { file, preview, progress, done, result }
  const [uploading, setUploading]             = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const [stateLocks, setStateLocks] = useState({});
  const [reelsOpen, setReelsOpen]   = useState(false);
  const [reelsStartIndex, setReelsStartIndex] = useState(0);
  const observerTarget = useRef(null);

  const MAX_FILES = 10;

  useEffect(() => { loadPosts(true); }, [filter]); // eslint-disable-line

  // Fetch daily post limit on mount and keep it fresh
  useEffect(() => {
    const fetchLimit = () =>
      postsAPI.getDailyLimit()
        .then(data => { if (data) setDailyLimit(data); })
        .catch(() => {});
    fetchLimit();
  }, []); // eslint-disable-line

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) loadMorePosts(); },
      { threshold: 0.1, rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page]); // eslint-disable-line

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
    } catch { toast.error('Failed to load posts'); }
    finally { setLoading(false); }
  };

  const loadMorePosts = () => { if (!loading && hasMore) loadPosts(false); };

  // Accept literally any image or video format
  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    const remaining = MAX_FILES - selectedFiles.length;
    if (files.length > remaining) {
      toast.error(`Maximum ${MAX_FILES} files allowed. Adding first ${remaining}.`);
    }
    const toAdd = files.slice(0, remaining).filter(f => {
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        toast.error(`${f.name}: unsupported format — images and videos only`);
        return false;
      }
      return true;
    });

    const newEntries = toAdd.map(file => ({
      file,
      name: file.name,
      type: file.type,
      progress: 0,
      done: false,
      error: null,
      result: null,
      preview: null,
    }));

    // Generate previews
    newEntries.forEach((entry, i) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFiles(prev => prev.map((f, idx) =>
          // find the matching entry by reference (stable after slice)
          f.file === entry.file ? { ...f, preview: reader.result } : f
        ));
      };
      reader.readAsDataURL(entry.file);
    });

    setSelectedFiles(prev => [...prev, ...newEntries]);
    e.target.value = '';
  };

  const removeFile = (i) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const createPost = async (e) => {
    e.preventDefault();
    if (!postContent.trim() && selectedFiles.length === 0) {
      toast.error('Post must have content or media'); return;
    }

    const tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
    const hasMedia = selectedFiles.length > 0;

    // ── Optimistic post: show immediately in feed with local previews ──────────
    // User sees the post right away. Media is replaced with CDN URLs once uploaded.
    const tempId = `temp_${Date.now()}`;
    const optimisticPost = {
      _id: tempId,
      authorId: user?._id,
      authorName: user?.name || 'You',
      authorRole: user?.role || 'founder',
      authorImage: user?.profilePicture || '',
      content: postContent.trim(),
      postType,
      tags,
      media: selectedFiles.map(f => ({ url: f.preview, type: f.type.startsWith('video/') ? 'video' : 'image', _isLocal: true })),
      mediaCount: selectedFiles.length,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      isLikedByMe: false,
      viewCount: 0,
      connectionStatus: 'own',
      isAuthorVerified: !!(user?.isVerified),
      _isOptimistic: true, // flag so we can replace it
    };

    // Close modal and show post immediately
    setCreateModalOpen(false);
    setPosts(prev => [optimisticPost, ...prev]);

    // Reset form state
    const capturedFiles = [...selectedFiles];
    setPostContent(''); setPostTags(''); setPostType('general');
    setSelectedFiles([]); setOverallProgress(0);

    if (!hasMedia) {
      // Text-only post: just create it, no upload needed
      try {
        const newPost = await postsAPI.createPost(postContent.trim(), postType, tags, []);
        setPosts(prev => [{ ...newPost, connectionStatus: 'own', isAuthorVerified: optimisticPost.isAuthorVerified }, ...prev.filter(p => p._id !== tempId)]);
        postsAPI.getDailyLimit().then(data => { if (data) setDailyLimit(data); }).catch(() => {});
      } catch (err) {
        setPosts(prev => prev.filter(p => p._id !== tempId));
        toast.error(err.message || 'Failed to create post');
      }
      return;
    }

    // ── Background upload: happens after modal closes ─────────────────────────
    // Show a persistent toast so user knows upload is in progress
    const uploadToastId = toast.loading(`Uploading ${capturedFiles.length} file${capturedFiles.length > 1 ? 's' : ''}…`, { duration: Infinity });
    setUploading(true);

    try {
      // 1. Compress images in parallel (videos skip compression)
      const compressToastShown = capturedFiles.some(f => f.file.type.startsWith('image/') && f.file.size > 300 * 1024);
      if (compressToastShown) {
        toast.loading('Compressing images…', { id: uploadToastId, duration: Infinity });
      }

      const filesToUpload = await Promise.all(
        capturedFiles.map(async (entry) => {
          if (entry.file.type.startsWith('image/')) {
            const compressed = await compressImage(entry.file);
            return { ...entry, file: compressed };
          }
          return entry;
        })
      );

      // 2. Get upload signature
      const sigData = await postsAPI.getUploadSignature();
      if (!sigData?.cloudName || !sigData?.signature) {
        throw new Error('Could not get upload credentials');
      }

      // 3. Upload all files to Cloudinary — images in parallel, videos sequential
      const total = filesToUpload.length;
      const totalBytes = filesToUpload.reduce((s, e) => s + e.file.size, 0);
      const perFileLoaded = new Array(total).fill(0);

      // One shared speed tracker across all files
      const tracker = makeSpeedTracker(totalBytes);

      // Throttle toast updates to max once per 300ms to avoid UI spam
      let lastToastUpdate = 0;
      const updateToast = (forceMsg) => {
        const now = Date.now();
        if (!forceMsg && now - lastToastUpdate < 300) return;
        lastToastUpdate = now;

        const totalLoaded = perFileLoaded.reduce((a, b) => a + b, 0);
        const pct = Math.round((totalLoaded / totalBytes) * 100);
        const { speedBps, etaSec } = tracker(totalLoaded);

        const speed = fmtSpeed(speedBps);
        const eta   = fmtEta(etaSec);
        const done  = fmtBytes(totalLoaded);
        const tot   = fmtBytes(totalBytes);

        const line1 = `Uploading ${total} file${total > 1 ? 's' : ''}… ${pct}%`;
        const line2 = [speed !== '—' ? `🚀 ${speed}` : null, eta].filter(Boolean).join('  •  ');
        const line3 = `${done} / ${tot}`;

        toast.loading(
          <div style={{ lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{line1}</div>
            <div style={{ width: '100%', height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 9999, marginBottom: 3 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#84CC16,#16A34A)', borderRadius: 9999, transition: 'width 0.3s' }} />
            </div>
            {line2 ? <div style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 600 }}>{line2}</div> : null}
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{line3}</div>
          </div>,
          { id: uploadToastId, duration: Infinity }
        );
      };

      updateToast(true); // show immediately at 0%

      const uploadFile = async (entry, idx) => {
        const result = await uploadToCloudinary(entry.file, sigData, (loaded, _total) => {
          perFileLoaded[idx] = loaded;
          updateToast(false);
        });
        perFileLoaded[idx] = entry.file.size; // mark 100% for this file
        updateToast(false);
        return result;
      };

      let results;
      const imageEntries = filesToUpload.filter(f => !f.file.type.startsWith('video/'));
      const videoEntries = filesToUpload.filter(f => f.file.type.startsWith('video/'));
      const imageIndices = filesToUpload.map((f, i) => f.file.type.startsWith('image/') ? i : -1).filter(i => i >= 0);
      const videoIndices = filesToUpload.map((f, i) => f.file.type.startsWith('video/') ? i : -1).filter(i => i >= 0);

      // Images upload in parallel — they're small after compression
      const imageResults = await Promise.all(imageEntries.map((entry, i) => uploadFile(entry, imageIndices[i])));

      // Videos upload sequentially to avoid bandwidth saturation
      const videoResults = [];
      for (let i = 0; i < videoEntries.length; i++) {
        const r = await uploadFile(videoEntries[i], videoIndices[i]);
        videoResults.push(r);
      }

      // Reconstruct in original order
      results = new Array(total);
      imageIndices.forEach((origIdx, i) => { results[origIdx] = imageResults[i]; });
      videoIndices.forEach((origIdx, i) => { results[origIdx] = videoResults[i]; });

      const uploadedMedia = results.map((r, idx) => ({
        url:       r.secure_url,
        publicId:  r.public_id,
        type:      filesToUpload[idx].file.type.startsWith('video/') ? 'video' : 'image',
        width:     r.width  || null,
        height:    r.height || null,
        thumbnail: r.eager?.[0]?.secure_url || null,
      }));

      // 4. Save post to DB with CDN URLs
      toast.loading('Saving post…', { id: uploadToastId, duration: Infinity });
      const newPost = await postsAPI.createPost(postContent.trim() || optimisticPost.content, postType, tags, uploadedMedia);

      // 5. Replace optimistic post with real one
      setPosts(prev => prev.map(p =>
        p._id === tempId
          ? { ...newPost, connectionStatus: 'own', isAuthorVerified: optimisticPost.isAuthorVerified }
          : p
      ));

      toast.success('Post published!', { id: uploadToastId, duration: 3000 });
      // Refresh daily limit counter
      postsAPI.getDailyLimit().then(data => { if (data) setDailyLimit(data); }).catch(() => {});
    } catch (err) {
      // Remove optimistic post on failure
      setPosts(prev => prev.filter(p => p._id !== tempId));
      toast.error(err.message || 'Failed to upload media. Please try again.', { id: uploadToastId, duration: 5000 });
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
    try { await postsAPI.toggleLike(postId); }
    catch {
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
    try { await postsAPI.deletePost(postId); toast.success('Post deleted'); setPosts(prev => prev.filter(p => p._id !== postId)); }
    catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  const sendConnectionRequest = async (userId, postId, e) => {
    if (e) e.stopPropagation();
    if (stateLocks[userId]) return;
    setStateLocks(prev => ({ ...prev, [userId]: true }));
    try {
      const result = await connectionsAPI.sendConnectionRequest(userId);
      toast.success('Connection request sent!');
      setPosts(prev => prev.map(p =>
        p.authorId?.toString() === userId?.toString() ? { ...p, connectionStatus: result.status || 'pending' } : p
      ));
    } catch (err) {
      if (err.status === 400 && err.data?.status) {
        setPosts(prev => prev.map(p =>
          p.authorId?.toString() === userId?.toString() ? { ...p, connectionStatus: err.data.status } : p
        ));
      }
      toast.error(err.message || 'Failed to send request');
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

  const closeModal = () => {
    setCreateModalOpen(false);
    setPostContent(''); setPostTags(''); setPostType('general');
    setSelectedFiles([]); setOverallProgress(0);
  };

  return (
    <div>
      {reelsOpen && (
        <ReelsViewer posts={posts} startIndex={reelsStartIndex} onClose={() => setReelsOpen(false)}
          onToggleLike={toggleLike} onConnect={sendConnectionRequest}
          currentUserId={user?._id} stateLocks={stateLocks} />
      )}

      <PageHeader title="Community Posts" subtitle="Share updates and connect with the community" />

      {/* Top bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <button
            className="btn btn-primary"
            onClick={() => dailyLimit.remaining > 0 && setCreateModalOpen(true)}
            disabled={dailyLimit.remaining === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              opacity: dailyLimit.remaining === 0 ? 0.6 : 1,
              cursor: dailyLimit.remaining === 0 ? 'not-allowed' : 'pointer',
            }}
            title={dailyLimit.remaining === 0 ? 'Daily limit reached. Resets at midnight.' : 'Create a new post'}
          >
            <Edit3 size={16} />
            {dailyLimit.remaining === 0 ? 'Limit Reached' : 'Create Post'}
          </button>

          {/* Daily limit pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px',
            borderRadius: 9999,
            background: dailyLimit.remaining === 0 ? '#FEE2E2' : dailyLimit.remaining <= 1 ? '#FEF3C7' : '#F0FDF4',
            border: `1px solid ${dailyLimit.remaining === 0 ? '#FECACA' : dailyLimit.remaining <= 1 ? '#FDE68A' : '#BBF7D0'}`,
            fontSize: '0.78rem',
            fontWeight: 700,
            color: dailyLimit.remaining === 0 ? '#DC2626' : dailyLimit.remaining <= 1 ? '#D97706' : '#16A34A',
            whiteSpace: 'nowrap',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {dailyLimit.remaining}/{dailyLimit.dailyLimit} posts today
          </div>
        </div>
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

      {/* Feed */}
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
            const imgSrc = post.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`;
            const optImg = imgSrc.includes('cloudinary') ? imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/') : imgSrc;
            const isOwn = user?._id && post.authorId?.toString() === user._id?.toString();
            const status = post.connectionStatus;

            let actionButtons = null;
            if (filter === 'mine' || isOwn) {
              actionButtons = (
                <button onClick={() => deletePost(post._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '8px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
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
                  <button disabled style={{ padding: '8px 16px', background: '#e5e7eb', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '500', cursor: 'not-allowed' }}>Pending</button>
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
              <Card key={post._id} style={{ padding: '1.5rem', opacity: post._isOptimistic ? 0.85 : 1, transition: 'opacity 0.3s' }}>
                {/* Optimistic upload indicator */}
                {post._isOptimistic && post.media?.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Uploading media in background…
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                  <img src={optImg} alt={post.authorName} loading="lazy"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || 'User')}&background=e2e8f0&color=64748b&size=100`; }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{post.authorName}</span>
                      {post.isAuthorVerified && <VerifiedBadge size={14} />}
                      <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '12px' }}>{post.authorRole}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{getTimeAgo(post.createdAt)}</div>
                  </div>
                  {post.postType && post.postType !== 'general' && getPostTypeBadge(post.postType)}
                </div>
                {post.content && <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: post.media?.length > 0 ? '1rem' : '0.75rem', whiteSpace: 'pre-wrap' }}>{post.content}</p>}
                {renderMediaGallery(post.media, post._id)}
                {post.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {post.tags.map((tag, idx) => <span key={idx} style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>#{tag}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <button onClick={() => toggleLike(post._id)} disabled={stateLocks[post._id]}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: stateLocks[post._id] ? 'not-allowed' : 'pointer', fontSize: '1rem', color: '#6b7280', padding: '8px', borderRadius: '8px' }}>
                    {post.isLikedByMe ? <Heart size={20} fill="#EF4444" color="#EF4444" /> : <Heart size={20} color="#9CA3AF" />}
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
      <Modal isOpen={createModalOpen} onClose={closeModal} title="Create Post" maxWidth="600px">
        <form onSubmit={createPost}>
          {/* Post type */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Category</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {postTypes.map(pt => (
                <button key={pt.value} type="button" onClick={() => setPostType(pt.value)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
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

          {/* File previews — shown before submitting */}
          {selectedFiles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {selectedFiles.map((entry, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  {entry.type.startsWith('video') ? (
                    <video src={entry.preview || ''} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: '#111' }} />
                  ) : entry.preview ? (
                    <img src={entry.preview} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100px', background: '#f3f4f6', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#6b7280', padding: '0.25rem', textAlign: 'center', overflow: 'hidden' }}>
                      {entry.name}
                    </div>
                  )}
                  <button type="button" onClick={() => removeFile(index)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add media button — accepts any image or video */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="file"
              id="post-media-input"
              accept="image/*,video/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleMediaSelect}
              disabled={uploading || selectedFiles.length >= MAX_FILES}
            />
            <button type="button" className="btn btn-secondary"
              onClick={() => document.getElementById('post-media-input').click()}
              disabled={uploading || selectedFiles.length >= MAX_FILES}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Image size={16} />
              {selectedFiles.length === 0 ? 'Add Photos / Videos' : `Add More (${selectedFiles.length}/${MAX_FILES})`}
            </button>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.375rem' }}>
              Any image or video format • No size limit
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary"
              disabled={!postContent.trim() && selectedFiles.length === 0}
              style={{ flex: 1 }}>
              {selectedFiles.length > 0 ? '🚀 Post (uploads in background)' : 'Post'}
            </button>
            <button type="button" className="btn btn-secondary"
              onClick={closeModal} disabled={uploading} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PostsPage;
