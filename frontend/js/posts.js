// ==========================================
// INSTAGRAM-LIKE POSTS SYSTEM
// Features: Media Upload, Infinite Scroll, Fast Loading
// ==========================================

// ==========================================
// 1. SECURITY & HELPERS
// ==========================================

function escapeXSS(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getTimeAgo(date) {
    const s = Math.floor((new Date() - new Date(date)) / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
}

function getPostTypeBadge(postType) {
    const styles = {
        'service_needed': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', text: 'Needs Service' },
        'funding_needed': { bg: '#fffbeb', color: '#d97706', border: '#fde68a', text: 'Needs Investment' },
        'offering_service': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', text: 'Offering Service' },
        'offering_funding': { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', text: 'Looking to Invest' }
    };
    const s = styles[postType] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb', text: postType };
    return `<span class="post-type-badge" style="background:${s.bg}; color:${s.color}; border:1px solid ${s.border}; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:600; white-space:nowrap;">${s.text}</span>`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==========================================
// 2. MEDIA UPLOAD HANDLER
// ==========================================

let selectedMediaFiles = [];
const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function initMediaUpload() {
    const mediaInput = document.getElementById('post-media-input');
    const mediaPreview = document.getElementById('media-preview-container');
    const uploadBtn = document.getElementById('upload-media-btn');

    if (!mediaInput || !mediaPreview || !uploadBtn) return;

    uploadBtn.addEventListener('click', () => mediaInput.click());

    mediaInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        // Validate file count
        if (selectedMediaFiles.length + files.length > MAX_FILES) {
            alert(`Maximum ${MAX_FILES} files allowed per post`);
            return;
        }

        // Validate and add files
        for (const file of files) {
            // Check file size
            if (file.size > MAX_FILE_SIZE) {
                alert(`${file.name} is too large. Maximum size is 100MB`);
                continue;
            }

            // Check file type
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            
            if (!isImage && !isVideo) {
                alert(`${file.name} is not a valid image or video file`);
                continue;
            }

            selectedMediaFiles.push(file);
        }

        renderMediaPreviews();
        e.target.value = ''; // Reset input
    });
}

function renderMediaPreviews() {
    const container = document.getElementById('media-preview-container');
    if (!container) return;

    container.innerHTML = '';

    if (selectedMediaFiles.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'grid';

    selectedMediaFiles.forEach((file, index) => {
        const preview = document.createElement('div');
        preview.className = 'media-preview-item';
        
        const isVideo = file.type.startsWith('video/');
        const url = URL.createObjectURL(file);

        preview.innerHTML = `
            <div class="media-preview-content">
                ${isVideo ? 
                    `<video src="${url}" muted></video>
                     <div class="video-indicator">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                     </div>` :
                    `<img src="${url}" alt="Preview">`
                }
            </div>
            <button class="remove-media-btn" data-index="${index}" title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="media-info">
                ${isVideo ? '🎥' : '📷'} ${formatFileSize(file.size)}
            </div>
        `;

        container.appendChild(preview);
    });

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-media-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            URL.revokeObjectURL(URL.createObjectURL(selectedMediaFiles[index]));
            selectedMediaFiles.splice(index, 1);
            renderMediaPreviews();
        });
    });
}

// ==========================================
// 3. RENDER FEED WITH MEDIA (Performance Optimized)
// ==========================================

function renderMediaGallery(media) {
    if (!media || media.length === 0) return '';

    const galleryClass = media.length === 1 ? 'single' : media.length === 2 ? 'double' : 'grid';
    
    let mediaHTML = media.map((item, index) => {
        const isVideo = item.type === 'video';
        const optimizedUrl = item.url.includes('cloudinary') 
            ? item.url.replace('/upload/', '/upload/f_auto,q_auto,w_800/')
            : item.url;

        if (isVideo) {
            return `
                <div class="media-item video-item" data-index="${index}">
                    <video 
                        src="${optimizedUrl}" 
                        poster="${item.thumbnail || ''}"
                        controls
                        preload="metadata"
                        playsinline
                    ></video>
                    <div class="video-duration">${item.duration ? Math.floor(item.duration) + 's' : ''}</div>
                </div>
            `;
        } else {
            return `
                <div class="media-item image-item" data-index="${index}">
                    <img 
                        src="${optimizedUrl}" 
                        alt="Post media"
                        loading="lazy"
                        onclick="openMediaViewer(this.src, 'image')"
                    >
                </div>
            `;
        }
    }).join('');

    return `<div class="post-media-gallery ${galleryClass}">${mediaHTML}</div>`;
}

function renderFeed(posts, activeTab = 'all', append = false) {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    if (!append) {
        feed.innerHTML = '';
    }

    if (!posts || posts.length === 0) {
        if (!append) {
            const msg = activeTab === 'mine' ? "You haven't posted anything yet." : "No posts yet. Be the first to post!";
            feed.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6b7280;">${msg}</div>`;
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.dataset.postId = post._id;

        // Optimized avatar image
        let imgSrc = post.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=e2e8f0&color=64748b&size=100`;
        if (imgSrc.includes('cloudinary')) imgSrc = imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/');

        // Action buttons logic
        let actionsHtml = '';
        if (activeTab === 'mine') {
            actionsHtml = `<button class="btn-delete-post" data-post-id="${post._id}" title="Delete Post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete
            </button>`;
        } else {
            if (currentUser._id && post.authorId !== currentUser._id) {
                actionsHtml = `<button class="btn-connect" data-user-id="${post.authorId}">Connect</button>`;
            }
        }

        card.innerHTML = `
            <div class="post-header">
                <img src="${imgSrc}" loading="lazy" class="post-avatar" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=e2e8f0&color=64748b&size=100';">
                <div class="post-author-info">
                    <div>
                        <span class="post-author-name"></span>
                        <span class="post-role-badge" style="margin-left:8px; font-size:0.7rem; background:#f3f4f6; color:#6b7280; padding:2px 8px; border-radius:12px;"></span>
                    </div>
                    <span class="post-time"></span>
                </div>
                ${getPostTypeBadge(post.postType)}
            </div>
            
            ${post.content ? `<div class="post-content" style="margin: 1rem 0; line-height: 1.6; color: #1f2937; white-space: pre-wrap;"></div>` : ''}
            
            ${renderMediaGallery(post.media)}
            
            <div class="post-tags" style="margin: 1rem 0 0.5rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
            
            <div class="post-actions" style="display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
                <button class="like-btn ${post.isLikedByMe ? 'liked' : ''}" data-liked="${!!post.isLikedByMe}" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; font-size:1rem; color:#6b7280; padding:8px; border-radius:8px; transition: 0.2s;">
                    <span class="heart-icon">${post.isLikedByMe ? '❤️' : '🤍'}</span> 
                    <span class="like-count" style="font-weight:600;">${post.likeCount || 0}</span>
                </button>
                <div class="post-actions-buttons">${actionsHtml}</div>
            </div>
        `;

        // Inject text securely
        card.querySelector('.post-author-name').textContent = post.authorName;
        card.querySelector('.post-role-badge').textContent = `(${post.authorRole})`;
        card.querySelector('.post-time').textContent = getTimeAgo(post.createdAt);
        
        if (post.content) {
            card.querySelector('.post-content').textContent = post.content;
        }

        const tagsEl = card.querySelector('.post-tags');
        if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach(t => {
                if (!t.trim()) return;
                const span = document.createElement('span');
                span.className = 'post-tag';
                span.style.cssText = "background:#eff6ff; color:#2563eb; padding:4px 10px; border-radius:12px; font-size:0.8rem;";
                span.textContent = `#${t.trim()}`;
                tagsEl.appendChild(span);
            });
        }

        fragment.appendChild(card);
    });
    
    feed.appendChild(fragment);

    // Track views for Instagram algorithm
    posts.forEach(post => {
        if (post.authorId !== currentUser._id) {
            window.api.trackView(post._id).catch(() => {});
        }
    });
}

// ==========================================
// 4. INFINITE SCROLL
// ==========================================

let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentPostTab = 'all';

function initInfiniteScroll() {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && hasMore && !isLoading) {
                loadMorePosts();
            }
        });
    }, {
        rootMargin: '200px' // Start loading before reaching bottom
    });

    // Create and observe sentinel element
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.style.height = '1px';
    feed.parentElement.appendChild(sentinel);
    observer.observe(sentinel);
}

async function loadMorePosts() {
    if (isLoading || !hasMore) return;

    isLoading = true;
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        currentPage++;
        const response = await window.api.getFeed(currentPostTab, currentPage, 20);
        
        if (response.posts && response.posts.length > 0) {
            renderFeed(response.posts, currentPostTab, true);
        }

        hasMore = response.pagination.hasMore;
    } catch (error) {
        console.error('Load more error:', error);
        currentPage--; // Revert page increment
    } finally {
        isLoading = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// ==========================================
// 5. MEDIA VIEWER (Lightbox)
// ==========================================

function openMediaViewer(src, type) {
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer';
    viewer.innerHTML = `
        <div class="media-viewer-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="media-viewer-content">
            <button class="media-viewer-close" onclick="this.closest('.media-viewer').remove()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            ${type === 'video' 
                ? `<video src="${src}" controls autoplay></video>`
                : `<img src="${src}" alt="Full size">`
            }
        </div>
    `;
    document.body.appendChild(viewer);
}

window.openMediaViewer = openMediaViewer;

// ==========================================
// 6. INIT & EVENT LISTENERS
// ==========================================

const stateLocks = {};

function initPostsSystem() {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    // Initialize media upload
    initMediaUpload();

    // Initialize infinite scroll
    initInfiniteScroll();

    // Initial Load
    feed.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading posts...</div>';
    window.api.getFeed('all', 1, 20).then(response => {
        hasMore = response.pagination.hasMore;
        renderFeed(response.posts, 'all');
    }).catch(() => {
        feed.innerHTML = '<div style="color:red;text-align:center;padding:2rem;">Failed to load feed.</div>';
    });

    // Tab Switching
    const tabs = document.querySelectorAll('.feed-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentPostTab = tab.dataset.filter;
            currentPage = 1;
            hasMore = true;
            
            feed.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading...</div>';
            window.api.getFeed(currentPostTab, 1, 20).then(response => {
                hasMore = response.pagination.hasMore;
                renderFeed(response.posts, currentPostTab);
            });
        });
    });

    // Create Post
    const submitBtn = document.getElementById('submit-post-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const contentEl = document.getElementById('post-content');
            const content = contentEl.value.trim();
            
            // Validate: Either content or media required
            if (!content && selectedMediaFiles.length === 0) {
                alert('Post must have content or media');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Uploading...';
            
            try {
                const postType = document.getElementById('post-type').value;
                const tagsInput = document.getElementById('post-tags');
                const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t) : [];
                
                await window.api.createPost(content, postType, tags, selectedMediaFiles);
                
                // Reset form
                contentEl.value = '';
                if (tagsInput) tagsInput.value = '';
                selectedMediaFiles = [];
                renderMediaPreviews();
                
                // Switch to "My Posts" tab
                currentPostTab = 'mine';
                currentPage = 1;
                hasMore = true;
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelector('[data-filter="mine"]').classList.add('active');
                
                const response = await window.api.getFeed('mine', 1, 20);
                hasMore = response.pagination.hasMore;
                renderFeed(response.posts, 'mine');
                
                alert('Post created successfully!');
            } catch (err) {
                alert(err.message || 'Failed to create post');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Post';
            }
        });
    }

    // Event Delegation for Post Actions
    feed.addEventListener('click', async (e) => {
        // Delete
        const deleteBtn = e.target.closest('.btn-delete-post');
        if (deleteBtn) {
            const id = deleteBtn.dataset.postId;
            const cardElement = deleteBtn.closest('.post-card');
            
            if (confirm('Are you sure you want to delete this post?')) {
                deleteBtn.innerHTML = 'Deleting...';
                deleteBtn.disabled = true;
                try {
                    await window.api.deletePost(id);
                    cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
                    cardElement.style.opacity = '0';
                    cardElement.style.transform = 'scale(0.95)';
                    setTimeout(() => cardElement.remove(), 300);
                } catch (error) {
                    alert(error.message || "Failed to delete.");
                    deleteBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete`;
                    deleteBtn.disabled = false;
                }
            }
            return;
        }

        // Like
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const id = likeBtn.closest('.post-card').dataset.postId;
            if (stateLocks[id]) return;
            stateLocks[id] = true;
            
            const isLiked = likeBtn.dataset.liked === 'true';
            likeBtn.dataset.liked = String(!isLiked);
            likeBtn.classList.toggle('liked');
            likeBtn.querySelector('.heart-icon').textContent = isLiked ? '🤍' : '❤️';
            const countEl = likeBtn.querySelector('.like-count');
            let currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

            try { 
                await window.api.toggleLike(id); 
            } catch { 
                location.reload(); 
            } finally { 
                delete stateLocks[id]; 
            }
            return;
        }

        // Connect
        const connectBtn = e.target.closest('.btn-connect');
        if (connectBtn && !connectBtn.disabled) {
            const uid = connectBtn.dataset.userId;
            if (stateLocks[uid]) return;
            stateLocks[uid] = true;
            
            connectBtn.textContent = 'Sending...';
            connectBtn.disabled = true;
            connectBtn.style.opacity = '0.7';
            
            try {
                await window.api.sendConnectionRequest(uid);
                connectBtn.textContent = 'Pending';
                connectBtn.classList.add('pending');
                connectBtn.style.background = '#e5e7eb';
                connectBtn.style.color = '#6b7280';
                connectBtn.style.border = '1px solid #d1d5db';
            } catch (err) {
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
                connectBtn.style.opacity = '1';
                alert(err.message || "Failed to send request.");
            } finally {
                delete stateLocks[uid];
            }
        }
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initPostsSystem);
