// Track which tab is active globally
let currentPostTab = 'all';

function renderFeed(posts, activeTab = 'all') {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;
    feed.innerHTML = ''; 

    if (!posts || posts.length === 0) {
        const msg = activeTab === 'mine' ? "You haven't posted anything yet." : "No posts yet. Be the first to post!";
        feed.innerHTML = `<div style="text-align: center; padding: 3rem; color: #6b7280;">${msg}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.dataset.postId = post._id;

        // Image Logic
        let imgSrc = post.authorImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=e2e8f0&color=64748b&size=100`;
        if (imgSrc.includes('cloudinary')) imgSrc = imgSrc.replace('/upload/', '/upload/f_auto,q_auto,w_100/');

        // --- SMART ACTION BUTTON LOGIC ---
        let actionsHtml = '';
        
        if (activeTab === 'mine') {
            // MY POSTS TAB: ONLY show delete button
            actionsHtml = `<button class="btn-delete-post" data-post-id="${post._id}" title="Delete Post">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Delete
            </button>`;
        } else {
            // ALL POSTS TAB: Show Connect button for others, nothing for self
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
            
            <div class="post-content" style="margin: 1rem 0; line-height: 1.6; color: #1f2937; white-space: pre-wrap;"></div>
            <div class="post-tags" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;"></div>
            
            <div class="post-actions" style="display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid #f3f4f6;">
                <button class="like-btn ${post.isLikedByMe ? 'liked' : ''}" data-liked="${!!post.isLikedByMe}" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; font-size:1rem; color:#6b7280; padding:8px; border-radius:8px; transition: 0.2s;">
                    <span class="heart-icon">${post.isLikedByMe ? '❤️' : '🤍'}</span> 
                    <span class="like-count" style="font-weight:600;">${post.likeCount || 0}</span>
                </button>
                <div class="post-actions-buttons">${actionsHtml}</div>
            </div>
        `;

        // Inject Text Securely
        card.querySelector('.post-author-name').textContent = post.authorName;
        card.querySelector('.post-role-badge').textContent = `(${post.authorRole})`;
        card.querySelector('.post-time').textContent = getTimeAgo(post.createdAt);
        card.querySelector('.post-content').textContent = post.content;

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
// INIT & EVENT LISTENERS
// ==========================================

const stateLocks = {};

function initPostsSystem() {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    // Initial Load
    window.api.getFeed('all').then(posts => renderFeed(posts, 'all')).catch(() => {
        feed.innerHTML = '<div style="color:red;text-align:center;padding:2rem;">Failed to load feed.</div>';
    });

    // --- TAB SWITCHING LOGIC ---
    const tabs = document.querySelectorAll('.feed-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentPostTab = tab.dataset.filter; // 'all' or 'mine'
            
            // Re-fetch with new filter
            feed.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Loading...</div>';
            window.api.getFeed(currentPostTab).then(posts => renderFeed(posts, currentPostTab));
        });
    });

    // --- CREATE POST LOGIC ---
    const submitBtn = document.getElementById('submit-post-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const contentEl = document.getElementById('post-content');
            const content = contentEl.value.trim();
            if (!content) return alert('Post cannot be empty.');

            submitBtn.disabled = true; submitBtn.textContent = 'Posting...';
            try {
                const postType = document.getElementById('post-type').value;
                const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t);
                await window.api.createPost(content, postType, tags);
                contentEl.value = ''; 
                if(document.getElementById('post-tags')) document.getElementById('post-tags').value = '';
                
                // Auto-switch to "My Posts" after creating so they see it
                currentPostTab = 'mine';
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelector('[data-filter="mine"]').classList.add('active');
                
                const freshPosts = await window.api.getFeed('mine');
                renderFeed(freshPosts, 'mine');
            } catch (err) { alert(err.message); }
            finally { submitBtn.disabled = false; submitBtn.textContent = 'Post'; }
        });
    }

    // --- EVENT DELEGATION FOR BUTTONS ---
    feed.addEventListener('click', async (e) => {
        
        // DELETE LOGIC
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

        // LIKE LOGIC
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const id = likeBtn.closest('.post-card').dataset.postId;
            if (stateLocks[id]) return; stateLocks[id] = true;
            
            const isLiked = likeBtn.dataset.liked === 'true';
            likeBtn.dataset.liked = String(!isLiked);
            likeBtn.classList.toggle('liked');
            likeBtn.querySelector('.heart-icon').textContent = isLiked ? '🤍' : '❤️';
            const countEl = likeBtn.querySelector('.like-count');
            let currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

            try { await window.api.toggleLike(id); } 
            catch { location.reload(); }
            finally { delete stateLocks[id]; }
            return;
        }

        // CONNECT LOGIC
        const connectBtn = e.target.closest('.btn-connect');
        if (connectBtn && !connectBtn.disabled) {
            const uid = connectBtn.dataset.userId;
            if (stateLocks[uid]) return; stateLocks[uid] = true;
            
            connectBtn.textContent = 'Sending...'; connectBtn.disabled = true; connectBtn.style.opacity = '0.7';
            try {
                await window.api.sendConnectionRequest(uid);
                connectBtn.textContent = 'Pending'; connectBtn.classList.add('pending');
                connectBtn.style.background = '#e5e7eb'; connectBtn.style.color = '#6b7280'; connectBtn.style.border = '1px solid #d1d5db';
            } catch (err) {
                connectBtn.textContent = 'Connect'; connectBtn.disabled = false; connectBtn.style.opacity = '1';
                alert(err.message || "Failed to send request.");
            } finally { delete stateLocks[uid]; }
        }
    });
}

document.addEventListener('DOMContentLoaded', initPostsSystem);