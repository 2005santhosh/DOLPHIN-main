// ==========================================
    // INITIAL SETUP
    // ==========================================
    let user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    const userId = (user._id || user.id)?.toString();
    //const API_URL = "https://dolphin-main-production.up.railway.app/api";
    if (!token) window.location.href = 'login.html';

    // Data Cache
    let watchlist = [];
    let myRequests = [];

        // ==========================================
    // UI UPDATE HELPER
    // ==========================================
    function updateNavbar(userData) {
        // REMOVED: document.getElementById('user-name').textContent = ...;
        
        const avatarEl = document.querySelector('.user-avatar');
        if (userData.profilePicture) {
            const imgSrc = userData.profilePicture.startsWith('http') ? userData.profilePicture : `${window.location.origin}${userData.profilePicture}`;
            avatarEl.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            avatarEl.textContent = (userData.name || 'I').charAt(0);
        }
        
        const preview = document.getElementById('settings-profile-preview');
        const nameInput = document.getElementById('settings-full-name');
        if(preview) preview.src = userData.profilePicture ? (userData.profilePicture.startsWith('http') ? userData.profilePicture : `${window.location.origin}${userData.profilePicture}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}`;
        if(nameInput) nameInput.value = userData.name || '';
    }

    updateNavbar(user);

    // ==========================================
    // MODAL LOGIC (LEGAL PAGES)
    // ==========================================
    function openLegalModal(type) {
        const modal = document.getElementById('legal-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        if (type === 'privacy') {
            title.textContent = "Privacy Policy";
            body.innerHTML = `
                <p><strong>Effective Date:</strong> March, 2026</p>
                <p>This privacy policy describes how Dolphin collects, uses, and shares your personal information.</p>
                <h4 style="margin-top:1rem;">Information We Collect</h4>
                <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include your name, email address, phone number, and profile information.</p>
                <h4 style="margin-top:1rem;">How We Use Information</h4>
                <p>We use the information we collect to provide, maintain, and improve our services, to process transactions and send you related information, to respond to your comments and questions, and to provide customer service.</p>
                <h4 style="margin-top:1rem;">Data Security</h4>
                <p>We take reasonable measures to help protect your personal information from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>
            `;
        } else if (type === 'terms') {
            title.textContent = "Terms of Service";
            body.innerHTML = `
                <p><strong>Effective Date:</strong> March, 2026</p>
                <p>Welcome to Dolphin. These Terms of Service govern your use of our website located at dolphin.com and our services.</p>
                <h4 style="margin-top:1rem;">Acceptance of Terms</h4>
                <p>By accessing and using our services, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
                <h4 style="margin-top:1rem;">User Responsibilities</h4>
                <p>You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur under your account or password.</p>
                <h4 style="margin-top:1rem;">Limitation of Liability</h4>
                <p>In no event shall Dolphin, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
            `;
        } else if (type === 'support') {
            title.textContent = "Support";
            body.innerHTML = `
                <p>We are here to help. If you have any questions or need assistance, please reach out to us through the following channels:</p>
                <div style="margin-top: 1.5rem;">
                    <p><strong>Email:</strong> support@pacificdev.in</p>
                    <p><strong>Phone:</strong> +91 1234567890</p>
                    <p><strong>Address:</strong><br>Dolphin HQ<br>123 Startup Lane<br>Bangalore, India</p>
                </div>
                <p style="margin-top: 1.5rem;">Our support hours are Monday to Friday, 9:00 AM to 6:00 PM IST.</p>
            `;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById('legal-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Close modal on outside click
    document.getElementById('legal-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // ==========================================
    // MOBILE MENU & OVERLAY LOGIC express
    // ==========================================
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.add('active');
        overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            if (sidebar.classList.contains('active')) closeSidebar();
            else openSidebar();
        });
    }
    
    overlay.addEventListener('click', closeSidebar);

    // ==========================================
    // BADGE HELPERS
    // ==========================================
    function incrementSidebarBadge(badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            let count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
            badge.style.display = 'flex';
        }
    }
    
    function clearSidebarBadge(badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) { 
            badge.textContent = '0'; 
            badge.style.display = 'none'; 
        }
    }

    // ==========================================
    // SOCKET.IO
    // ==========================================
    let socket;
    const SOCKET_URL = "https://dolphin-main-production.up.railway.app";
    if (typeof io === 'function' && userId) {
        socket = io(SOCKET_URL, { auth: { token: token } });
        socket.emit('join', userId);
        
        socket.on('newNotification', (n) => {
            const badge = document.getElementById('notif-badge-count');
            if(badge) { badge.style.display = 'flex'; badge.textContent = (parseInt(badge.textContent) || 0) + 1; }
        });
        
        socket.on('newStartupValidated', () => {
            const badge = document.getElementById('notif-badge-count');
            if(badge) { badge.style.display = 'flex'; badge.textContent = (parseInt(badge.textContent) || 0) + 1; }
            if(document.getElementById('dashboard-page').classList.contains('active')) loadDashboard();
        });

        socket.on('receiveMessage', (msg) => {
            const senderId = (msg.senderId._id || msg.senderId)?.toString();
            if(currentChatPartnerId === senderId) {
                appendMessage(msg, false);
            } else {
                incrementSidebarBadge('sidebar-chat-badge');
            }
        });
        
        socket.on('newRequest', () => {
            incrementSidebarBadge('sidebar-req-badge');
            const badge = document.getElementById('notif-badge-count');
            if(badge) { badge.style.display = 'flex'; badge.textContent = (parseInt(badge.textContent) || 0) + 1; }
        });
        
        socket.on('requestStatusUpdate', () => {
             const badge = document.getElementById('notif-badge-count');
             if(badge) { badge.style.display = 'flex'; badge.textContent = (parseInt(badge.textContent) || 0) + 1; }
             if(document.getElementById('requests-page').classList.contains('active')) loadRequests();
        });
    }

    // ==========================================
    // NAVIGATION LOGIC (Refactored)
    // ==========================================
    
    // Function to switch pages programmatically
    function switchPage(pageName) {
        // 1. Update Sidebar Active State
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const navItem = document.querySelector(`[data-page="${pageName}"]`);
        if (navItem) navItem.classList.add('active');

        // 2. Update Page Visibility
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`${pageName}-page`);
        if (pageEl) pageEl.classList.add('active');

        // 3. Load Content
        loadPageContent(pageName);

        // 4. Handle Badges
        if(pageName === 'requests') clearSidebarBadge('sidebar-req-badge');
        if(pageName === 'chat') clearSidebarBadge('sidebar-chat-badge');
        
        // 5. Close mobile menu if open
        if(window.innerWidth <= 768) {
            closeSidebar();
        }
    }

    // Attach click listeners to sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        switchPage(page);
      });
    });
    
    document.getElementById('user-menu').addEventListener('click', () => switchPage('settings'));
    
    function loadPageContent(page) {
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'startups': loadStartups(); break;
        case 'watchlist': loadWatchlist(); break;
        case 'settings': loadSettings(); break;
        case 'requests': loadRequests(); break;
        case 'chat': loadConversations(); break;
      }
    }

    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    const notifBtn = document.getElementById('notification-btn');
    const notifDropdown = document.getElementById('notification-dropdown');
    
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isOpen = notifDropdown.style.display === 'flex';
            notifDropdown.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) await loadNotificationList();
        });
        
        window.closeNotifDropdown = () => notifDropdown.style.display = 'none';
        
        window.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && notifBtn && !notifBtn.contains(e.target)) closeNotifDropdown();
        });
    }

    async function loadNotificationList() {
        const list = document.getElementById('notif-list');
        if(!list) return;
        list.innerHTML = '<p style="padding:1rem; text-align:center;">Loading...</p>';
        try {
            const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            const notifications = data.notifications || [];
            if (notifications.length === 0) return list.innerHTML = '<p style="padding:1rem; text-align:center; color:#666;">No notifications</p>';
            list.innerHTML = notifications.map(n => `
                <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n._id}')">
                    <div style="font-weight:600;">${n.title}</div>
                    <div style="font-size:0.85rem; color:#555;">${n.message}</div>
                    <div style="font-size:0.75rem; color:#999; margin-top:4px;">${new Date(n.createdAt).toLocaleString()}</div>
                </div>
            `).join('');
        } catch(e) { list.innerHTML = '<p style="color:red; text-align:center;">Error</p>'; }
    }
    
    window.handleNotifClick = async (id) => { 
        closeNotifDropdown(); 
        await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); 
        updateNotificationBadge(); 
    };

    async function updateNotificationBadge() {
        try {
            const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            const unread = (data.notifications || []).filter(n => !n.read).length;
            const badge = document.getElementById('notif-badge-count');
            if(badge) {
                badge.textContent = unread;
                badge.style.display = unread > 0 ? 'flex' : 'none';
            }
        } catch(e) {}
    }
    updateNotificationBadge();

    window.markAllRead = async () => {
        try {
            await fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }});
            document.querySelectorAll('.notif-item.unread').forEach(i => i.classList.remove('unread'));
            const badge = document.getElementById('notif-badge-count');
            if(badge) { badge.style.display = 'none'; badge.textContent = '0'; }
        } catch(e) { alert('Failed'); }
    };

    window.clearNotifications = async () => {
        if(!confirm('Clear all?')) return;
        try {
            await fetch(`${API_URL}/notifications/clear`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
            document.getElementById('notif-list').innerHTML = '<p style="padding:1rem; text-align:center;">No notifications</p>';
            const badge = document.getElementById('notif-badge-count');
            if(badge) { badge.style.display = 'none'; badge.textContent = '0'; }
        } catch(e) { alert('Failed'); }
    };

    // ==========================================
    // DATA LOADING
    // ==========================================
    async function loadDashboard() {
      try {
        const startupRes = await fetch(`${API_URL}/investor/validated-startups`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!startupRes.ok) throw new Error("Failed to load startups");
        const startupData = await startupRes.json();
        const startups = startupData.startups || [];
        
        const reqRes = await fetch(`${API_URL}/investor/my-requests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if(reqRes.ok) {
            const reqData = await reqRes.json();
            myRequests = reqData.requests || [];
        }

        const watchlistRes = await fetch(`${API_URL}/investor/watchlist`, { headers: { 'Authorization': `Bearer ${token}` }});
        if(watchlistRes.ok) {
            const watchlistData = await watchlistRes.json();
            watchlist = watchlistData.map(s => s._id);
        }

        document.getElementById('total-startups').textContent = startups.length;
        let highest = 0;
        startups.forEach(s => { if (s.validationScore > highest) highest = s.validationScore; });
        document.getElementById('highest-score').textContent = highest + '%';
        document.getElementById('watchlist-count').textContent = watchlist.length;

        const container = document.getElementById('validated-startups');
        container.innerHTML = '';
        if(startups.length === 0) container.innerHTML = '<p style="text-align:center; padding:2rem; color:#666;">No validated startups found.</p>';
        else startups.forEach(s => container.appendChild(createStartupCard(s)));
        
        document.getElementById('search-startup').oninput = (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#validated-startups .startup-card').forEach(card => {
                card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        };

      } catch(e) { 
        console.error("Dashboard Error:", e); 
        document.getElementById('validated-startups').innerHTML = `<p style="color:red; text-align:center;">${e.message}</p>`;
      }
    }
    
    async function loadStartups() {
        const container = document.getElementById('all-startups');
        container.innerHTML = '<p style="text-align:center;">Loading...</p>';
        try {
            const startupRes = await fetch(`${API_URL}/investor/validated-startups`, { headers: { 'Authorization': `Bearer ${token}` }});
            const startupData = await startupRes.json();
            const startups = startupData.startups || [];

            container.innerHTML = '';
            if(startups.length === 0) container.innerHTML = '<p style="text-align:center;">None.</p>';
            else startups.forEach(s => container.appendChild(createStartupCard(s)));

            document.getElementById('search-all-startups').oninput = (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('#all-startups .startup-card').forEach(card => {
                    card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            };
        } catch(e) { container.innerHTML = '<p style="color:red;">Error</p>'; }
    }

    async function loadWatchlist() {
        const container = document.getElementById('watchlist-startups');
        container.innerHTML = '<p style="text-align:center;">Loading...</p>';
        try {
            const res = await fetch(`${API_URL}/investor/watchlist`, { headers: { 'Authorization': `Bearer ${token}` }});
            const list = await res.json();
            container.innerHTML = '';
            if(list.length === 0) return container.innerHTML = '<p style="text-align:center;">Empty.</p>';
            list.forEach(s => container.appendChild(createStartupCard(s)));
        } catch(e) { container.innerHTML = '<p style="color:red; text-align:center;">Error</p>'; }
    }

    // ==========================================
    // UI GENERATORS
    // ==========================================
    function createStartupCard(startup) {
        const card = document.createElement('div');
        card.className = 'startup-card';
        
        const isWatchlisted = watchlist.includes(startup._id);
        const founder = startup.founderId || {};
        
        const imgUrl = founder.profilePicture 
            ? (founder.profilePicture.startsWith('http') ? founder.profilePicture : `${window.location.origin}${founder.profilePicture}`)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(founder.name || 'User')}&background=random`;

        const myReq = myRequests.find(r => (r.startupId?._id || r.startupId) === startup._id);
        
        let actionBtnHtml = '';
        if (myReq && myReq.status === 'accepted') {
            actionBtnHtml = `<button class="btn btn-primary btn-sm" onclick="window.openChat('${founder._id}', '${founder.name}', '${founder.profilePicture || ''}')">Chat</button>`;
        } else if (myReq && myReq.status === 'pending') {
            actionBtnHtml = `<button class="btn btn-secondary btn-sm" disabled>Request Pending</button>`;
        } else {
            actionBtnHtml = `<button class="btn btn-primary btn-sm" onclick="expressInterest('${startup._id}')">Send Request</button>`;
        }

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:1.5rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                <img src="${imgUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:3px solid #eee;">
                <div style="flex:1; min-width: 150px;">
                    <h3 style="margin:0; font-size: 1.3rem;">${startup.name}</h3>
                    <div style="font-size:0.95rem; color:var(--text-secondary); margin-top: 0.25rem;">${startup.industry || 'N/A'}</div>
                </div>
                <div style="text-align:right; background: var(--background); padding: 0.75rem 1.25rem; border-radius: 12px;">
                    <div style="font-size:1.5rem; font-weight:700; color:#3b82f6;">${startup.validationScore || 0}%</div>
                    <div style="font-size:0.8rem; color:#999; text-transform: uppercase; font-weight: 600;">Score</div>
                </div>
            </div>
            
            <p style="color:#444; margin:0 0 1.5rem 0; font-size:1rem; line-height: 1.6;">${startup.thesis || 'No description available.'}</p>
            
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:1.5rem; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div style="font-size:1rem; color:var(--text-primary);">
                    Founder: <strong>${founder.name || 'Unknown'}</strong>
                </div>
                <div style="display:flex; gap:0.75rem;">
                    <button class="btn btn-secondary btn-sm" onclick="toggleWatchlist('${startup._id}')">
                        ${isWatchlisted ? 'Unwatch' : 'Watch'}
                    </button>
                    ${actionBtnHtml}
                </div>
            </div>
        `;
        return card;
    }

    // ==========================================
    // ACTIONS
    // ==========================================
    window.toggleWatchlist = async (id) => {
        try {
            const isWatchlisted = watchlist.includes(id);
            if (isWatchlisted) {
                await fetch(`${API_URL}/investor/watchlist/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
                watchlist = watchlist.filter(i => i !== id);
                alert('Removed');
            } else {
                await fetch(`${API_URL}/investor/watchlist`, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ startupId: id }) });
                watchlist.push(id);
                alert('Added');
            }
            
            const activePage = document.querySelector('.nav-item.active').dataset.page;
            if (activePage === 'watchlist') loadWatchlist();
            else loadDashboard(); 
            
        } catch(e) { alert('Error'); }
    };

    window.expressInterest = async (startupId) => {
        try {
            const res = await fetch(`${API_URL}/investor/express-interest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ startupId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('Request Sent!');
            loadDashboard(); 
        } catch(e) { alert(e.message); }
    };
    
    // ==========================================
    // REQUESTS LOGIC
    // ==========================================
    async function loadRequests() {
        const incomingList = document.getElementById('incoming-requests-list');
        const sentList = document.getElementById('sent-requests-list');
        
        incomingList.innerHTML = '<p style="text-align:center;">Loading...</p>';
        sentList.innerHTML = '<p style="text-align:center;">Loading...</p>';
        
        try {
            const res = await fetch(`${API_URL}/investor/my-requests`, { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            const requests = data.requests || [];
            
            const incomingReqs = requests.filter(r => r.initiator === 'founder');
            const sentReqs = requests.filter(r => r.initiator === 'investor');

            document.querySelector('[data-tab="incoming"]').textContent = `Incoming (${incomingReqs.length})`;
            document.querySelector('[data-tab="sent"]').textContent = `Sent (${sentReqs.length})`;

            incomingList.innerHTML = '';
            if (incomingReqs.length === 0) {
                incomingList.innerHTML = '<p style="text-align: center; padding: 2rem;">No incoming requests.</p>';
            } else {
                incomingReqs.forEach(r => incomingList.appendChild(createIncomingRequestItem(r)));
            }

            sentList.innerHTML = '';
            if (sentReqs.length === 0) {
                sentList.innerHTML = '<p style="text-align: center; padding: 2rem;">No sent requests.</p>';
            } else {
                sentReqs.forEach(r => sentList.appendChild(createSentRequestItem(r)));
            }

        } catch(e) { 
            incomingList.innerHTML = '<p style="color:red;">Error</p>'; 
        }
    }

    function createIncomingRequestItem(request) {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const startupName = request.startupId?.name || 'Startup';
        const founder = request.founderId || {};
        const founderId = founder._id;
        const founderName = founder.name || 'Founder';
        const founderPic = founder.profilePicture || '';

        let actionsHtml = '';
        if (request.status === 'accepted') {
            actionsHtml = `
              <span class="status-accepted">Accepted</span>
              <button class="btn btn-primary btn-sm" onclick="window.openChat('${founderId}', '${founderName}', '${founderPic}')">Chat</button>
            `;
        } else {
            actionsHtml = `<span class="status-${request.status}">${request.status.toUpperCase()}</span>`;
        }

        item.innerHTML = `
            <div class="list-item-content">
              <div class="list-item-title">${startupName}</div>
              <div class="list-item-subtitle">From: ${founderName}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              ${actionsHtml}
            </div>
        `;
        return item;
    }

    function createSentRequestItem(request) {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const startupName = request.startupId?.name || 'Startup';
        const founder = request.founderId || {};
        const founderId = founder._id;
        const founderName = founder.name || 'Founder';
        const founderPic = founder.profilePicture || '';

        let statusHtml = '';
        if (request.status === 'pending') {
            statusHtml = '<span class="status-pending">Pending</span>';
        } else if (request.status === 'accepted') {
            statusHtml = `
              <span class="status-accepted">Accepted</span>
              <button class="btn btn-primary btn-sm" onclick="window.openChat('${founderId}', '${founderName}', '${founderPic}')">Chat</button>
            `;
        } else {
            statusHtml = '<span class="status-rejected">Rejected</span>';
        }

        item.innerHTML = `
            <div class="list-item-content">
              <div class="list-item-title">To: ${startupName}</div>
              <div class="list-item-subtitle">Founder: ${founderName}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              ${statusHtml}
            </div>
        `;
        return item;
    }

    // Tabs Logic
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });

    
    // ==========================================
    // SETTINGS LOGIC
    // ==========================================
    function loadSettings() {
        document.getElementById('settings-full-name').value = user.name || '';
        document.getElementById('settings-email').value = user.email || '';
        
        const preview = document.getElementById('settings-profile-preview');
        if (user.profilePicture) {
             const imgSrc = user.profilePicture.startsWith('http') ? user.profilePicture : `${window.location.origin}${user.profilePicture}`;
             preview.src = imgSrc;
        }
    }
    
    document.getElementById('profile-picture-input')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5000000) return alert('File too large. Max 5MB.');
            const reader = new FileReader();
            reader.onload = function(event) { document.getElementById('settings-profile-preview').src = event.target.result; };
            reader.readAsDataURL(file);
        }
    });

        document.getElementById('upload-picture-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('profile-picture-input');
        const btn = document.getElementById('upload-picture-btn');
        
        if (!input.files[0]) return alert('Select file');
        
        const fd = new FormData();
        fd.append('profilePicture', input.files[0]);

        // 1. Set Loading State
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Uploading...`;
        btn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/auth/upload-profile-picture`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
            const d = await res.json();
            if (!res.ok) throw new Error(d.message);
            
            alert('Uploaded!');
            user.profilePicture = d.profilePicture;
            localStorage.setItem('user', JSON.stringify(user));
            updateNavbar(user);
        } catch(e) { 
            alert(e.message); 
        } finally {
            // 2. Reset Button State
            btn.innerHTML = originalText;
            btn.disabled = false;
            input.value = ''; // Reset file input
        }
    });
    
    document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('settings-full-name').value;
        try {
            const res = await fetch(`${API_URL}/auth/profile`, { method: 'PUT', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.message);
            alert('Saved');
            user.name = name;
            localStorage.setItem('user', JSON.stringify(user));
            updateNavbar(user);
        } catch(e) { alert(e.message); }
    });

    window.togglePassword = function(inputId) {
        const input = document.getElementById(inputId);
        const icon = document.querySelector(`#${inputId}-toggle-icon`);
        if (input.type === 'password') {
            input.type = 'text';
            if(icon) icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            input.type = 'password';
            if(icon) icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    };

    document.getElementById('update-password-btn')?.addEventListener('click', async () => {
        const curr = document.getElementById('current-password').value;
        const newP = document.getElementById('new-password').value;
        const conf = document.getElementById('confirm-password').value;
        if(!curr || !newP || !conf) return alert('Fill all fields');
        if(newP !== conf) return alert('Passwords do not match');
        if(newP.length < 8) return alert('Min 8 chars');
        try {
            const res = await fetch(`${API_URL}/auth/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ currentPassword: curr, newPassword: newP }) });
            const d = await res.json();
            if (!res.ok) throw new Error(d.message);
            alert('Updated!');
            document.getElementById('current-password').value = ''; 
            document.getElementById('new-password').value = ''; 
            document.getElementById('confirm-password').value = '';
        } catch(e) { alert(e.message); }
    });
    
    document.getElementById('delete-account-btn')?.addEventListener('click', async () => { if(confirm('Delete?')) { await api.deleteAccount(); localStorage.clear(); window.location.href='login.html'; }});
    document.getElementById('logout-btn')?.addEventListener('click', () => { localStorage.clear(); window.location.href='login.html'; });

    // ==========================================
    // CHAT LOGIC
    // ==========================================
    let currentChatPartnerId = null;
    
    async function chatApiCall(endpoint, method = 'GET', body = null) {
      const config = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
      if (body) config.body = JSON.stringify(body);
      const res = await fetch(`${API_URL}/chat${endpoint}`, config);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    }

    window.openChat = async function(partnerId, partnerName, partnerPic) {
        // 1. Navigate to Chat Page first
        switchPage('chat');
        
        // 2. Setup UI for specific chat
        currentChatPartnerId = partnerId;
        
        const header = document.getElementById('chat-header');
        const headerInfo = header.querySelector('.header-info');
        const imgUrl = partnerPic 
            ? (partnerPic.startsWith('http') ? partnerPic : `${window.location.origin}${partnerPic}`)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`;

        headerInfo.innerHTML = `
            <img src="${imgUrl}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
            <span>${partnerName}</span>
        `;
        
        header.style.display = 'flex';
        document.getElementById('chat-input-area').style.display = 'block';

        // 3. Load Messages
        const msgs = await chatApiCall(`/${partnerId}`);
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        msgs.forEach(m => appendMessage(m, (m.senderId._id || m.senderId) === userId));
        container.scrollTop = container.scrollHeight;
        
        // 4. Handle Mobile View Switch
        if(window.innerWidth <= 768) {
             document.getElementById('chat-page').classList.add('mobile-chat-active');
        } else {
             // Ensure clean state on desktop
             document.getElementById('chat-page').classList.remove('mobile-chat-active');
        }
    }

    // Mobile Back Button Logic
    window.closeChatMobile = function() {
        document.getElementById('chat-page').classList.remove('mobile-chat-active');
        currentChatPartnerId = null;
        // Reset header
        document.getElementById('chat-header').style.display = 'none';
        document.getElementById('chat-input-area').style.display = 'none';
        document.getElementById('messages-container').innerHTML = '';
    }

    function appendMessage(m, isSent) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = `message-row ${isSent ? 'sent' : 'received'}`;
        div.innerHTML = `<div class="message-bubble">${m.content}<div class="message-time">${new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    window.sendMessage = async function() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        if (!content) return;
        
        appendMessage({ content, createdAt: new Date() }, true);
        input.value = '';
        
        try {
            await chatApiCall('/send', 'POST', { receiverId: currentChatPartnerId, content });
        } catch(e) { alert('Failed'); }
    };
        async function loadConversations() {
        // Target the inner container, not the main list wrapper
        const list = document.getElementById('conversations-container');
        if(!list) return;
        
        // Clear previous list items (but keep the search bar)
        list.innerHTML = '';

        try {
            const convs = await chatApiCall('/conversations');
            if(convs.length === 0) {
                list.innerHTML = '<p style="padding:1rem; text-align:center;">No chats found.</p>';
                return;
            }
            
            convs.forEach(c => {
                const div = document.createElement('div');
                // Added 'conversation-item' class for easier selection later
                div.className = 'conversation-item'; 
                div.style.cssText = 'padding: 1rem; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; gap: 0.75rem;';
                
                const imgUrl = c.profilePicture 
                    ? (c.profilePicture.startsWith('http') ? c.profilePicture : `${window.location.origin}${c.profilePicture}`)
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`;

                div.innerHTML = `
                    <img src="${imgUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1; overflow: hidden;">
                        <div style="font-weight:600;" class="conv-name">${c.name}</div>
                        <small style="color:#666; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.lastMessage || ''}</small>
                    </div>
                `;
                
                div.onclick = () => openChat(c._id, c.name, c.profilePicture);
                list.appendChild(div);
            });
        } catch(e) { 
            console.error(e); 
            list.innerHTML = '<p style="padding:1rem; text-align:center; color:red;">Error loading chats</p>';
        }
    }
        // Add this code near your other initialization logic (e.g., inside DOMContentLoaded)

    const chatSearchInput = document.getElementById('chat-search-input');
    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const items = document.querySelectorAll('.conversation-item');

            items.forEach(item => {
                // We look for the name inside the item we generated earlier
                const nameElement = item.querySelector('.conv-name');
                if (nameElement) {
                    const name = nameElement.textContent.toLowerCase();
                    // Toggle display based on match
                    if (name.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });
    }
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        loadDashboard();
        updateNotificationBadge();
        // --- ADD DELETE ACCOUNT LISTENER ---
      const deleteBtn = document.getElementById('delete-account-btn');
      if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
              // 1. Confirm with the user
              if (!confirm('⚠️ Are you sure you want to delete your account? This action cannot be undone.')) {
                  return;
              }

              // 2. Confirm again (Safety measure)
              const confirmation = prompt("Please type 'DELETE' to confirm account deletion.");
              if (confirmation !== 'DELETE') {
                  alert('Deletion cancelled.');
                  return;
              }

              try {
                  // 3. Call the API
                  const res = await fetch(`${API_URL}/auth/account`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                  });

                  const data = await res.json();

                  if (!res.ok) {
                      throw new Error(data.message || 'Failed to delete account');
                  }

                  // 4. Clean up and Redirect
                  alert('✅ Your account has been deleted successfully.');
                  localStorage.clear();
                  window.location.href = 'index.html'; // Redirect to landing page

              } catch (err) {
                  console.error('Delete Account Error:', err);
                  alert(err.message);
              }
          });
      }
    });