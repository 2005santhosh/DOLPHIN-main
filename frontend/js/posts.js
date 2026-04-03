// Security: Escapes HTML to prevent XSS
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

// Performance: Uses DocumentFragment
function renderFeed(posts) {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;
    feed.innerHTML = ''; // Clear safely

    if (!posts || posts.length === 0) {
        feed.innerHTML = '<div style="text-align: center; padding: 3rem; color: #6b7280;">No posts yet.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.dataset.postId = post._id;

        const defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName)}&background=e2e8f0&color=64748b&size=100`;
        let img = post.authorImage || defaultImg;
        if (img.includes('cloudinary')) img = img.replace('/upload/', '/upload/f_auto,q_auto,w_100/');

        card.innerHTML = `
            <div class="post-header">
                <img src="${img}" loading="lazy" class="post-avatar" onerror="this.onerror=null;this.src='${defaultImg}';">
                <div class="post-author-info">
                    <div><span class="post-author-name"></span><span class="post-role-badge"></span></div>
                    <span class="post-time"></span>
                </div>
            </div>
            <div class="post-content"></div>
            <div class="post-tags"></div>
            <div class="post-actions">
                <button class="like-btn ${post.isLikedByMe ? 'liked' : ''}" data-liked="${!!post.isLikedByMe}">
                    <span class="heart-icon">${post.isLikedByMe ? '❤️' : '🤍'}</span> 
                    <span class="like-count">${post.likeCount || 0}</span>
                </button>
                <div class="connect-container"></div>
            </div>
        `;

        // INJECT TEXT SECURELY (100% XSS Proof)
        card.querySelector('.post-author-name').textContent = post.authorName;
        card.querySelector('.post-role-badge').textContent = post.authorRole;
        card.querySelector('.post-time').textContent = getTimeAgo(post.createdAt);
        card.querySelector('.post-content').textContent = post.content;

        const tagsEl = card.querySelector('.post-tags');
        if (post.tags) post.tags.forEach(t => {
            const span = document.createElement('span');
            span.className = 'post-tag';
            span.textContent = `#${t.trim()}`;
            tagsEl.appendChild(span);
        });

        // Connect Button Logic
        const connectContainer = card.querySelector('.connect-container');
        if (currentUser._id && post.authorId !== currentUser._id) {
            const isPending = currentUser.pendingConnections?.includes(post.authorId);
            const btn = document.createElement('button');
            btn.className = `btn-connect ${isPending ? 'pending' : ''}`;
            btn.dataset.userId = post.authorId;
            btn.textContent = isPending ? 'Pending' : 'Connect';
            if (isPending) btn.disabled = true;
            connectContainer.appendChild(btn);
        }

        fragment.appendChild(card);
    });
    feed.appendChild(fragment);
}

// State locks to prevent spam
const stateLocks = {};

function initPostsSystem() {
    const feed = document.getElementById('posts-feed');
    if (!feed) return;

    // 1. Load Feed
    window.api.getFeed().then(renderFeed).catch(() => {
        feed.innerHTML = '<div style="color:red;text-align:center;">Failed to load.</div>';
    });

    // 2. Create Post
    const submitBtn = document.getElementById('submit-post-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const contentEl = document.getElementById('post-content');
            const content = contentEl.value.trim();
            if (!content) return;

            submitBtn.disabled = true; submitBtn.textContent = 'Posting...';
            try {
                const postType = document.getElementById('post-type').value;
                const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t);
                await window.api.createPost(content, postType, tags);
                contentEl.value = ''; document.getElementById('post-tags').value = '';
                const posts = await window.api.getFeed();
                renderFeed(posts);
            } catch (err) { alert(err.message); }
            finally { submitBtn.disabled = false; submitBtn.textContent = 'Post'; }
        });
    }

    // 3. Event Delegation (1 listener for whole feed)
    feed.addEventListener('click', async (e) => {
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const id = likeBtn.closest('.post-card').dataset.postId;
            if (stateLocks[id]) return; stateLocks[id] = true;
            
            const isLiked = likeBtn.dataset.liked === 'true';
            likeBtn.dataset.liked = String(!isLiked);
            likeBtn.classList.toggle('liked');
            likeBtn.querySelector('.heart-icon').textContent = isLiked ? '🤍' : '❤️';
            likeBtn.querySelector('.like-count').textContent = parseInt(likeBtn.querySelector('.like-count').textContent) + (isLiked ? -1 : 1);

            try { await window.api.toggleLike(id); } 
            catch { /* Revert UI on failure */ location.reload(); }
            finally { delete stateLocks[id]; }
        }

        const connectBtn = e.target.closest('.btn-connect');
        if (connectBtn && !connectBtn.disabled) {
            const uid = connectBtn.dataset.userId;
            if (stateLocks[uid]) return; stateLocks[uid] = true;
            
            connectBtn.textContent = 'Sending...'; connectBtn.disabled = true;
            try {
                await window.api.sendConnectionRequest(uid);
                connectBtn.textContent = 'Pending'; connectBtn.classList.add('pending');
            } catch (err) {
                connectBtn.textContent = 'Connect'; connectBtn.disabled = false;
                alert(err.message);
            } finally { delete stateLocks[uid]; }
        }
    });
}

document.addEventListener('DOMContentLoaded', initPostsSystem);