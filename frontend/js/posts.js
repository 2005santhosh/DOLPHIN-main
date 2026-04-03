// ==========================================
// 1. SECURITY & HELPERS
// ==========================================

// Security: Escapes HTML to prevent XSS (Though we use textContent below for extra safety)
function escapeXSS(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Relative Time Formatter
function getTimeAgo(date) {
    const s = Math.floor((new Date() - new Date(date)) / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
}

// Badge colors based on post type
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


// ==========================================
// 2. RENDER FEED (Performance Optimized)
// ==========================================

function renderFeed(posts) {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;
    feed.innerHTML = ''; // Clear safely

    if (!posts || posts.length === 0) {
        feed.innerHTML = '<div style="text-align: center; padding: 3rem; color: #6b7280;">No posts yet. Be the first to post!</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.dataset.postId = post._id;

        // 1. Profile Image Logic (Cloudinary optimization + Fallback)
        let imgSrc = post.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=e2e8f0&color=64748b&size=100`;
        if (imgSrc.includes('cloudinary')) {
            imgSrc = imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/');
        }

        // 2. Connect Button Logic (Hidden if it's your own post)
        let connectHtml = '';
        if (currentUser._id && post.authorId !== currentUser._id) {
            connectHtml = `<button class="btn-connect" data-user-id="${post.authorId}">Connect</button>`;
        }

        // 3. Build Card HTML Structure
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
            
            <div class="post-content" style="margin: 1rem 0; line-height: 1.6; color: #1f2937; white-space: pre-wrap;"></div>
            <div class="post-tags" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
            
            <div class="post-actions" style="display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
                <button class="like-btn ${post.isLikedByMe ? 'liked' : ''}" data-liked="${!!post.isLikedByMe}" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; font-size:1rem; color:#6b7280; padding:8px; border-radius:8px; transition: 0.2s;">
                    <span class="heart-icon">${post.isLikedByMe ? '❤️' : '🤍'}</span> 
                    <span class="like-count" style="font-weight:600;">${post.likeCount || 0}</span>
                </button>
                <div class="connect-container">${connectHtml}</div>
            </div>
        `;

        // 4. INJECT TEXT SECURELY (100% XSS Proof using textContent)
        card.querySelector('.post-author-name').textContent = post.authorName;
        card.querySelector('.post-role-badge').textContent = `(${post.authorRole})`;
        card.querySelector('.post-time').textContent = getTimeAgo(post.createdAt);
        card.querySelector('.post-content').textContent = post.content;

        // Inject Tags securely
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
}


// ==========================================
// 3. STATE LOCKS & INTERACTIVITY
// ==========================================

// State locks to prevent spam-clicking like/connect buttons
const stateLocks = {};

function initPostsSystem() {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    // 1. Initial Load
    window.api.getFeed().then(renderFeed).catch(() => {
        feed.innerHTML = '<div style="color:red;text-align:center;padding:2rem;">Failed to load feed.</div>';
    });

    // 2. Create Post Logic
    const submitBtn = document.getElementById('submit-post-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const contentEl = document.getElementById('post-content');
            const content = contentEl.value.trim();
            if (!content) return alert('Post cannot be empty.');

            submitBtn.disabled = true; 
            submitBtn.textContent = 'Posting...';
            
            try {
                const postType = document.getElementById('post-type').value;
                const tagsInput = document.getElementById('post-tags').value;
                const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
                
                await window.api.createPost(content, postType, tags);
                
                // Clear form and reload feed
                contentEl.value = ''; 
                if(document.getElementById('post-tags')) document.getElementById('post-tags').value = '';
                const freshPosts = await window.api.getFeed();
                renderFeed(freshPosts);
            } catch (err) { 
                alert(err.message); 
            } finally { 
                submitBtn.disabled = false; 
                submitBtn.textContent = 'Post'; 
            }
        });
    }

    // 3. Event Delegation (1 listener for the ENTIRE feed)
    feed.addEventListener('click', async (e) => {
        
        // --- LIKE BUTTON LOGIC ---
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const id = likeBtn.closest('.post-card').dataset.postId;
            if (stateLocks[id]) return; // Prevent spam
            stateLocks[id] = true;
            
            const isLiked = likeBtn.dataset.liked === 'true';
            
            // Optimistic UI Update (Instant feedback)
            likeBtn.dataset.liked = String(!isLiked);
            likeBtn.classList.toggle('liked');
            likeBtn.querySelector('.heart-icon').textContent = isLiked ? '🤍' : '❤️';
            
            const countEl = likeBtn.querySelector('.like-count');
            let currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

            try {
                // Send to backend (DB handles duplicates via addToSet)
                await window.api.toggleLike(id);
            } catch (error) {
                // Revert UI if API fails
                likeBtn.dataset.liked = String(isLiked);
                likeBtn.classList.toggle('liked');
                likeBtn.querySelector('.heart-icon').textContent = isLiked ? '❤️' : '🤍';
                countEl.textContent = currentCount;
                alert("Failed to like post.");
            } finally {
                delete stateLocks[id]; // Unlock
            }
            return;
        }

        // --- CONNECT BUTTON LOGIC ---
        const connectBtn = e.target.closest('.btn-connect');
        if (connectBtn && !connectBtn.disabled) {
            const uid = connectBtn.dataset.userId;
            if (stateLocks[uid]) return; // Prevent spam
            stateLocks[uid] = true;
            
            connectBtn.textContent = 'Sending...'; 
            connectBtn.disabled = true;
            connectBtn.style.opacity = '0.7';

            try {
                // Calls the global API endpoint
                await window.api.sendConnectionRequest(uid);
                
                // Success State
                connectBtn.textContent = 'Pending'; 
                connectBtn.classList.add('pending');
                connectBtn.style.background = '#e5e7eb';
                connectBtn.style.color = '#6b7280';
                connectBtn.style.border = '1px solid #d1d5db';
            } catch (err) {
                // Revert UI if API fails (e.g., "Already exists")
                connectBtn.textContent = 'Connect'; 
                connectBtn.disabled = false;
                connectBtn.style.opacity = '1';
                alert(err.message || "Failed to send request.");
            } finally {
                delete stateLocks[uid]; // Unlock
            }
        }
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initPostsSystem);