// Handle window resize
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    mobileToggle?.classList.remove('active');
    sidebar.classList.remove('active');
    if (sidebarOverlay) {
      sidebarOverlay.classList.remove('active');
    }
    document.body.style.overflow = '';
  }
});
    const API_URL = "https://dolphin-main-production.up.railway.app/api";
    const API_BASE = `${API_URL}/api/provider`;
    const AUTH_BASE = `${API_URL}/api/auth`;

    // Generic Helper to handle Auth headers and errors
    async function apiCall(endpoint, method = 'GET', body = null, base = API_BASE) {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const config = { method, headers };
      if (body) config.body = JSON.stringify(body);

      try {
        const response = await fetch(`${base}${endpoint}`, config);
        
        // Handle 401 Unauthorized
        if (response.status === 401) {
           localStorage.removeItem('token');
           localStorage.removeItem('user');
           window.location.href = 'login.html'; 
           return;
        }
        
        // ✅ FIX: Try to parse JSON error message if response is not OK
        if (!response.ok) {
          let errorMsg = `API Error: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } catch (e) {
            // Ignore JSON parse error
          }
          throw new Error(errorMsg);
        }
        
        return await response.json();
      } catch (error) {
        console.error('API Call Failed:', error);
        throw error; // Re-throw so the calling function can catch it
      }
    }

    const api = {
      getMyRequests: async () => {
        const data = await apiCall('/my-requests');
        return data.requests || [];
      },
      getEligibleFounders: async () => {
        return await apiCall('/eligible-founders');
      },
      updateIntroRequest: async (id, status) => {
        return await apiCall(`/requests/${id}`, 'PUT', { status });
      },
      sendProviderRequest: async (startupId, message, servicesOffered) => {
        return await apiCall('/send-request', 'POST', { 
          startupId, 
          message, 
          servicesOffered
        });
      },
      getProfile: async () => {
        return await apiCall('/profile');
      },
      updateProfile: async (profileData) => {
        return await apiCall('/profile', 'PUT', profileData);
      },
      deleteAccount: async () => {
        return await apiCall('/account', 'DELETE', null, AUTH_BASE);
      },
      
    };
        // ==========================================
    // HELPER: Verified Badge HTML Generator
    // ==========================================
    function getVerifiedBadgeHtml(state) {
      // A user is verified if they are APPROVED or in any STAGE (1-7)
      const verifiedStates = ['APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7'];
      
      if (verifiedStates.includes(state)) {
        return `<span class="verified-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> VERIFIED</span>`;
      }
      return '';
    }
    // ==========================================
    // FRONTEND LOGIC
    // ==========================================

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');
    
    // ✅ CRITICAL FIX: Force ID to String immediately
    const userId = (user._id || user.id)?.toString();

    if (!token) console.warn("No token found.");

    document.getElementById('user-name').textContent = user.name || 'Provider';
    const nameArray = (user.name || 'Provider').split(' ');
    document.querySelector('.user-avatar').textContent = nameArray.map(n => n.charAt(0)).join('');

  
    function loadPageContent(page) {
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'profile': loadProfile(); break;
        case 'founders': loadFounders(); break;
        case 'requests': loadRequests(); break;
        case 'settings': loadSettings(); break;
         case 'chat': loadConversations(); break;
      }
    }
    
    async function loadDashboard() {
      try {
        // 1. Fetch Profile Data (Now includes rating & avatar) incoming
        // We use api.getProfile() which hits /api/provider/profile
        const profile = await api.getProfile();

        // Update Header Avatar
        if (profile.profilePicture) {
          updateProviderHeaderAvatar(profile.profilePicture);
        } else if (profile.userId && profile.userId.profilePicture) {
           updateProviderHeaderAvatar(profile.userId.profilePicture);
        } else {
          const name = profile.name || 'User';
          const initials = name.split(' ').map(n => n.charAt(0)).join('');
          document.querySelector('.user-avatar').textContent = initials || 'U';
        }

        // ✅ FIX: Use the calculated rating from backend
        document.getElementById('avg-rating').textContent = profile.avgRating || '0.0';

        // 2. Load Stats
        const requests = await api.getMyRequests();
        const activeEngagements = requests.filter(r => r.status === 'accepted').length;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const acceptedRequests = requests.filter(r => r.status === 'accepted').length;
        const rejectedRequests = requests.filter(r => r.status === 'rejected').length;
        
        document.getElementById('active-engagements').textContent = activeEngagements;

        const totalClosed = acceptedRequests + rejectedRequests;
        const responseRate = totalClosed > 0 ? Math.round((acceptedRequests / totalClosed) * 100) + '%' : '0%';
        document.getElementById('response-rate').textContent = responseRate;

        try {
          const eligible = await api.getEligibleFounders();
          document.getElementById('eligible-founders').textContent = String(eligible?.length || 0);
        } catch (e) {
          document.getElementById('eligible-founders').textContent = '0';
        }

        // Recent Activity
        const recentActivity = document.getElementById('recent-activity');
        recentActivity.innerHTML = '';
        if (requests.length === 0) {
          recentActivity.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No recent activity.</p>';
        } else {
          requests.slice(0, 3).forEach(request => {
            const statusClass = request.status === 'accepted' ? 'status-accepted' : 
                               request.status === 'rejected' ? 'status-rejected' : 'status-pending';
            const startupName = request.startupId?.name || request.startupName || 'Unnamed Startup';
            
            const activityItem = document.createElement('div');
            activityItem.className = 'list-item';
            activityItem.innerHTML = `
              <div class="list-item-content">
                <div class="list-item-title">${startupName}</div>
                <div class="list-item-subtitle">${new Date(request.createdAt).toLocaleDateString()}</div>
              </div>
              <span class="list-item-status ${statusClass}">${request.status.toUpperCase()}</span>
            `;
            recentActivity.appendChild(activityItem);
          });
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        const activityEl = document.getElementById('recent-activity');
        if(activityEl) activityEl.innerHTML = `<p style="text-align: center; color: var(--danger);">Error: ${error.message}</p>`;
      }
    }

    // Profile
    async function loadProfile() {
      try {
        const profile = await api.getProfile();
        if (profile) {
            document.getElementById('provider-name').value = profile.name || user.name || '';
            document.getElementById('service-category').value = profile.category || 'mentor';
            document.getElementById('experience-level').value = profile.experienceLevel || 'mid';
            document.getElementById('specialties').value = (profile.specialties || []).join(', ');
            document.getElementById('bio').value = profile.description || profile.bio || '';
            document.getElementById('availability').value = profile.availability || 'medium';
            document.getElementById('contact-method').value = profile.contactMethod || 'email';
        }
      } catch (err) {
        // Fallback logic
      }
    }

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const profileData = {
        name: document.getElementById('provider-name').value,
        category: document.getElementById('service-category').value,
        experienceLevel: document.getElementById('experience-level').value,
        specialties: document.getElementById('specialties').value.split(',').map(s => s.trim()).filter(s => s),
        description: document.getElementById('bio').value,
        availability: document.getElementById('availability').value,
        contactMethod: document.getElementById('contact-method').value
      };
      try {
        await api.updateProfile(profileData);
        alert('Profile updated successfully!');
      } catch (error) {
        alert(`Failed: ${error.message}`);
      }
    });
    
        // ==========================================
    // MOBILE MENU & NAVIGATION LOGIC (FIXED)
    // ==========================================

    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    // 1. Toggle Button Logic
    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      });
    }

    // 2. Close Sidebar when clicking Overlay
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        closeSidebar();
      });
    }

    // Helper to close sidebar
    function closeSidebar() {
        if (mobileToggle) mobileToggle.classList.remove('active');
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // 3. Navigation Logic (Close sidebar on link click for mobile)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // A. Close Sidebar if on Mobile
        if (window.innerWidth <= 768) {
           closeSidebar();
        }

        // B. Update Active States
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // C. Switch Page
        const page = item.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');
        
        // D. Load Content
        loadPageContent(page);
      });
    });
        // ==========================================
    // MISSING NOTIFICATION FUNCTIONS
    // ==========================================

    window.markAllRead = async function() {
        try {
            const token = localStorage.getItem('token');
            // 1. Update Backend
            const res = await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // 2. Update Frontend UI
                document.querySelectorAll('.notif-item.unread').forEach(item => {
                    item.classList.remove('unread');
                });
                // Remove the red badge
                const badge = document.getElementById('notif-badge-count');
                if(badge) badge.style.display = 'none';
            } else {
                alert('Failed to mark as read');
            }
        } catch(e) {
            console.error(e);
            alert('Error marking read');
        }
    };

    window.clearNotifications = async function() {
        if(!confirm('Delete all notifications?')) return;
        
        try {
            const token = localStorage.getItem('token');
            
            // ✅ FIX: Change URL from '/api/notifications' to '/api/notifications/clear'
            const res = await fetch(`${API_URL}/notifications/clear`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                // Clear UI on success
                const notifList = document.getElementById('notif-list');
                notifList.innerHTML = '<div class="notif-empty">No notifications yet</div>';
                const badge = document.getElementById('notif-badge-count');
                if(badge) badge.style.display = 'none';
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to clear');
            }
        } catch(e) { 
            console.error(e);
            alert('Error clearing notifications'); 
        }
    };
        // ==========================================
    // NOTIFICATION BELL FIX (CORRECTED)
    // ==========================================

    const notifBtn = document.getElementById('notification-btn');
    const notifDropdown = document.getElementById('notification-dropdown');
    
    // FIX: Define variables globally or inside functions, but don't rely on undefined globals
    // const notifList = document.getElementById('notif-list'); // Optional: Can be global, but safer inside function

    if (notifBtn) {
      notifBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); 
        
        const isVisible = notifDropdown.classList.contains('active');
        
        if (isVisible) {
            notifDropdown.classList.remove('active');
        } else {
            notifDropdown.classList.add('active');
            await loadNotificationList();
        }
      });
    }

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
      if (notifDropdown && notifDropdown.classList.contains('active')) {
        if (!notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
           notifDropdown.classList.remove('active');
        }
      }
    });

    function closeNotifDropdown() {
      if(notifDropdown) notifDropdown.classList.remove('active');
    }

    async function loadNotificationList() {
      // FIX: Define notifList HERE inside the function
      const notifList = document.getElementById('notif-list');
      if (!notifList) return;

      notifList.innerHTML = '<div class="notif-empty">Loading...</div>';
      
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const notifications = data.notifications || [];
        
        if (notifications.length === 0) {
          notifList.innerHTML = '<div class="notif-empty">No notifications yet</div>';
          return;
        }

        notifList.innerHTML = notifications.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n._id}')">
            <div class="notif-item-content">
              <div class="notif-item-title">${n.title}</div>
              <div class="notif-item-message">${n.message}</div>
              <div class="notif-item-time">${new Date(n.createdAt).toLocaleString()}</div>
            </div>
          </div>
        `).join('');

      } catch (error) {
        console.error('Error loading notifications list:', error);
        notifList.innerHTML = '<div class="notif-empty" style="color:var(--error);">Failed to load</div>';
      }
    }
    
    async function updateNotificationBadge() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const unread = (data.notifications || []).filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge-count');
        if(badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
      } catch(e) { console.error("Error syncing badge", e); }
    }

    // Load badge on start
    updateNotificationBadge();
        // ==========================================
    // UNIFIED SOCKET.IO LOGIC (PROVIDER) - ENHANCED
    // ==========================================
    
    let currentChatPartnerId = null;
    let socket = null;

    if (typeof io === 'function' && userId) {
         socket = io({
            auth: { token: token } 
        });

        socket.emit('join', userId);
        console.log('🔌 Provider Socket connected:', userId);

        // 1. Listen for Incoming Messages
        socket.on('receiveMessage', (msg) => {
            if (!msg || !msg.senderId) return;

            const senderId = (msg.senderId._id || msg.senderId)?.toString();
            if (!senderId) return;

            const isCurrentChat = currentChatPartnerId?.toString() === senderId;
            const isMe = senderId === userId;

            if (isCurrentChat && !isMe) {
                const container = document.getElementById('messages-container');
                const div = document.createElement('div');
                div.className = 'message-row received';
                const time = new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                div.innerHTML = `<div class="message-bubble">${msg.content}<div class="message-time" style="text-align: left;">${time}</div></div>`;
                container.appendChild(div);
                container.scrollTop = container.scrollHeight;
            } else if (!isMe) {
                // ✅ Update Chat Badge if chat not open
                incrementSidebarBadge('sidebar-chat-badge');
            }
        });

        // 2. Listen for New Requests (Incoming)
        socket.on('newRequest', (data) => {
             console.log("New Request Received", data);
             // Update Requests Badge
             incrementSidebarBadge('sidebar-req-badge');
             
             // Refresh Dashboard stats if active
             if(document.getElementById('dashboard-page').classList.contains('active')) {
                 loadDashboard();
             }
        });

        // 3. Listen for Request Status Updates (Sent Requests Accepted/Rejected)
        socket.on('requestStatusUpdate', (data) => {
             console.log("Request Status Updated", data);
             // Update Notification Bell
             updateNotificationBadge();
             
             // Refresh Requests Page if active
             if(document.getElementById('requests-page').classList.contains('active')) {
                 loadRequests();
             }
        });

        // 4. Listen for General Notifications
        socket.on('newNotification', (notification) => {
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                let count = parseInt(badge.textContent) || 0;
                badge.textContent = count + 1;
                badge.style.display = 'flex';
            }
            
            // Optional: Refresh list if dropdown is open
            if(document.getElementById('notification-dropdown').style.display === 'flex') {
                loadNotificationList();
            }
        });

    } else {
        console.error('❌ Provider Socket not initialized.');
    }

    // ==========================================
    // HELPER FUNCTIONS FOR BADGES
    // ==========================================

        // ==========================================
    // HELPER FUNCTIONS FOR BADGES
    // ==========================================

    function incrementSidebarBadge(badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            let count = parseInt(badge.textContent) || 0;
            count++;
            badge.textContent = count;
            badge.style.display = 'flex'; // Use flex to center number
        }
    }

    function clearSidebarBadge(badgeId) {
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
    }

    // Connect the clear functions to the click handlers
    document.querySelector('[data-page="requests"]')?.addEventListener('click', () => {
        clearSidebarBadge('sidebar-req-badge');
        // Also clear the "Incoming" tab count if you have one
        // document.querySelector('[data-tab="incoming"]')?.click(); 
    });
    
    document.querySelector('[data-page="chat"]')?.addEventListener('click', () => {
        clearSidebarBadge('sidebar-chat-badge');
    });
       

    window.sendMessage = async function() {
        const input = document.getElementById('message-input');
        const content = input.value.trim();
        if (!content || !currentChatPartnerId) return;
        
        // 11. ✅ OPTIMISTIC UI: Append immediately
        const container = document.getElementById('messages-container');
        const emptyMsg = container.querySelector('p');
        if(emptyMsg) emptyMsg.remove();

        const div = document.createElement('div');
        div.className = 'message-row sent';
        div.innerHTML = `
          <div class="message-bubble">
            ${content}
            <div class="message-time" style="text-align: right;">Just now</div>
          </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        
        // 2. Clear input
        input.value = '';

        // 3. Send to server
        try {
            await chatApiCall('/send', 'POST', { receiverId: currentChatPartnerId, content });
        } catch(e) { 
            console.error(e);
            alert('Failed to send message'); 
        }
    };
       // Founders Page (With Robust Data Handling)
    async function loadFounders() {
      const foundersList = document.getElementById('founders-list');
      foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading...</p>';

      try {
        // 1. Fetch Founders
        const founders = await api.getEligibleFounders();
        
        // 2. ✅ Fetch My Requests to check status
        const myRequests = await api.getMyRequests();
        
        // 3. Create a Map: startupId -> status
        const requestStatusMap = {};
        myRequests.forEach(req => {
            const startupId = req.startupId?._id || req.startupId;
            if (startupId) {
                requestStatusMap[startupId] = req.status;
            }
        });

        foundersList.innerHTML = '';

        const validFounders = (founders || []).filter(f => f.founderId && f.founderId.name);

        if (!validFounders || validFounders.length === 0) {
          foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No eligible founders found.</p>';
        } else {
          window.currentFoundersList = validFounders;
          window.currentRequestStatusMap = requestStatusMap; 
          
          validFounders.forEach(founder => {
            const founderCard = createFounderCard(founder, requestStatusMap);
            foundersList.appendChild(founderCard);
          });
        }

        // Update filters
        document.getElementById('stage-filter').addEventListener('change', () => filterFounders(validFounders, requestStatusMap));
        document.getElementById('industry-filter').addEventListener('change', () => filterFounders(validFounders, requestStatusMap));

      } catch (error) {
        console.error('Error loading founders:', error);
        // ✅ Show specific error to user
        foundersList.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 2rem;">Error: ${error.message}</p>`;
      }
    }

    function createFounderCard(founder, requestStatusMap = {}) {
      const card = document.createElement('div');
      card.className = 'founder-card';

      const userRef = founder.founderId || {};
      const founderName = userRef.name || 'Unknown Founder';
      const points = userRef.rewardPoints || 0;
      
      // ✅ Get state safely
      const userState = userRef.state || '';
      
      const profileImg = userRef.profilePicture 
        ? userRef.profilePicture 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(founderName)}&background=random&color=fff&size=128`;

      // ✅ Call the helper
      const verifiedBadgeHtml = getVerifiedBadgeHtml(userState);

      const founderId = founder._id; 
      const requestStatus = requestStatusMap[founderId]; 
      
      let actionsHtml = '';
      
      if (requestStatus === 'accepted') {
          const founderUserId = userRef._id || userRef;
          actionsHtml = `
            <button class="btn btn-success" style="cursor: default; opacity: 0.8;">Connected</button>
            <button class="btn btn-primary" onclick="window.openChat('${founderUserId}', '${founderName}')">Chat</button>
          `;
      } else if (requestStatus === 'pending') {
          actionsHtml = `
            <button class="btn btn-secondary" disabled>Request Pending</button>
            <button class="btn btn-secondary" onclick="viewFounderProfile('${founderId}')">View Profile</button>
          `;
      } else if (requestStatus === 'rejected') {
          actionsHtml = `
            <button class="btn btn-danger" onclick="openRequestModal('${founderId}')">Request Rejected (Retry)</button>
            <button class="btn btn-secondary" onclick="viewFounderProfile('${founderId}')">View Profile</button>
          `;
      } else {
          actionsHtml = `
            <button class="btn btn-primary" onclick="openRequestModal('${founderId}')">Send Connection Request</button>
            <button class="btn btn-secondary" onclick="viewFounderProfile('${founderId}')">View Profile</button>
          `;
      }

      card.innerHTML = `
        <div class="founder-header">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <img src="${profileImg}" alt="${founderName}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb;">
            <div>
              <div class="founder-name" style="display: flex; align-items: center;">
                ${founder.startupName || 'Unnamed Startup'}
                ${verifiedBadgeHtml}
              </div>
              <div style="font-size: 0.85rem; color: #666; margin-top: 4px;">Founder: ${founderName}</div>
              <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">⭐ ${points} Points</div>
            </div>
          </div>
        </div>
        
        <p style="margin: 1rem 0; color: #444;">${founder.thesis || 'No thesis provided.'}</p>
        
        <div class="founder-details">
          <div class="detail-item">
            <span class="detail-label">Industry</span>
            <span class="detail-value">${founder.industry || 'Not specified'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Validation Score</span>
            <span class="detail-value" style="font-weight: 700; color: var(--success);">${founder.validationScore ?? 0}%</span>
          </div>
        </div>
        
        <div class="request-actions" style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          ${actionsHtml}
        </div>
      `;
      return card;
    }
    function filterFounders(allFounders, statusMap) {
      const stageFilter = document.getElementById('stage-filter').value;
      const industryFilter = document.getElementById('industry-filter').value;
      const foundersList = document.getElementById('founders-list');
      foundersList.innerHTML = '';

      const filtered = allFounders.filter(founder => {
        const stage = founder.founderId?.stage;
        const matchesStage = stageFilter === 'all' || stage?.toString() === stageFilter; 
        const matchesIndustry = industryFilter === 'all' || 
          founder.industry?.toLowerCase().includes(industryFilter);

        return matchesStage && matchesIndustry;
      });

      window.currentFoundersList = filtered;

      if (filtered.length === 0) {
        foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No founders match.</p>';
      } else {
        // Pass statusMap to keep button states correct after filtering
        filtered.forEach(founder => foundersList.appendChild(createFounderCard(founder, statusMap)));
      }
    }

        // ==========================================
    // FIX: Missing viewFounderProfile Function
    // ==========================================
       window.viewFounderProfile = function(startupId) {
      const profileModal = document.getElementById('profile-modal');
      const target = window.currentFoundersList?.find(f => f._id === startupId);

      profileModal.classList.add('active');
      const contentDiv = document.getElementById('profile-content');
      contentDiv.style.display = 'none';
      document.getElementById('profile-loader').style.display = 'block';

      if (!target) {
        document.getElementById('profile-loader').style.display = 'none';
        contentDiv.innerHTML = `<p style="color:red; padding: 2rem; text-align:center;">Profile data not found.</p>`;
        contentDiv.style.display = 'block';
        return;
      }

      const user = target.founderId || {};
      
      // ✅ FIX: Get state safely
      const userState = user.state || '';
      const profileImg = user.profilePicture 
        ? user.profilePicture 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&color=fff&size=128`;

      // ✅ FIX: Use the helper function
      const verifiedBadgeHtml = getVerifiedBadgeHtml(userState);

      document.getElementById('detail-startup-name').innerHTML = `${target.startupName} ${verifiedBadgeHtml}`;
      document.getElementById('detail-thesis').textContent = target.thesis || 'N/A';
      document.getElementById('detail-industry').textContent = target.industry || 'N/A';
      document.getElementById('detail-score').textContent = (target.validationScore ?? 0) + '%';
      document.getElementById('detail-founder-name').textContent = user.name || 'Unknown';
      document.getElementById('detail-founder-email').textContent = user.email || 'N/A';
      
      // Update Founder Name row to include image
      const founderNameRow = document.querySelector('#profile-content .founder-details .detail-item:first-child');
      if(founderNameRow) {
        founderNameRow.innerHTML = `
          <span class="detail-label">Founder</span>
          <span class="detail-value" style="display: flex; align-items: center; gap: 8px;">
            <img src="${profileImg}" style="width: 24px; height: 24px; border-radius: 50%;">
            ${user.name || 'Unknown'}
          </span>
        `;
      }

      // Hide the Stage row
      const stageRow = document.getElementById('detail-stage')?.parentElement;
      if(stageRow) stageRow.style.display = 'none';

      document.getElementById('profile-loader').style.display = 'none';
      contentDiv.style.display = 'block';
    };
       // ==========================================
    // REQUESTS LOGIC (SPLIT INCOMING / SENT)
    // ==========================================

    async function loadRequests() {
      try {
        const requests = await api.getMyRequests();
        
        const incomingContainer = document.getElementById('incoming-requests-list');
        const sentContainer = document.getElementById('sent-requests-list');
        
        incomingContainer.innerHTML = '';
        sentContainer.innerHTML = '';

        // 1. Filter Lists
        // Incoming: Founder sent to Provider (initiator == 'founder')
        const incomingReqs = requests.filter(r => r.initiator === 'founder');
        // Sent: Provider sent to Founder (initiator == 'provider')
        const sentReqs = requests.filter(r => r.initiator === 'provider');

        // 2. Update Tab Counts
        document.querySelector('[data-tab="incoming"]').textContent = `Incoming (${incomingReqs.length})`;
        document.querySelector('[data-tab="sent"]').textContent = `Sent (${sentReqs.length})`;

        // 3. Render Incoming
        if (incomingReqs.length === 0) {
          incomingContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No incoming requests.</p>';
        } else {
          incomingReqs.forEach(request => {
            incomingContainer.appendChild(createIncomingRequestItem(request));
          });
        }

        // 4. Render Sent
        if (sentReqs.length === 0) {
          sentContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No sent requests.</p>';
        } else {
          sentReqs.forEach(request => {
            sentContainer.appendChild(createSentRequestItem(request));
          });
        }

      } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('incoming-requests-list').innerHTML = `<p style="text-align:center; color:red;">Error: ${error.message}</p>`;
      }
    }

       // Helper: Create Incoming Request Item (From Founder)
    function createIncomingRequestItem(request) {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const startupName = request.startupId?.name || 'Startup';
      const founder = request.founderId || {};
      const founderId = founder._id || 'unknown';
      const founderName = founder.name || 'Founder';
      
      // FIX: Safely get picture
      const founderPic = founder.profilePicture || ''; 

      const displayTitle = request.servicesOffered || 'Connection Request';
      const displayMessage = request.message || 'No message provided.';

      let actionsHtml = '';
      if (request.status === 'accepted') {
        actionsHtml = `
          <span class="status-accepted">Accepted</span>
          <button class="btn btn-primary btn-sm" onclick="window.openChat('${founderId}', '${founderName}', '${founderPic}')">Chat</button>
        `;
      } else if (request.status === 'pending') {
        actionsHtml = `
          <button class="btn btn-accept" onclick="updateRequest('${request._id}', 'accepted')">Accept</button>
          <button class="btn btn-reject" onclick="updateRequest('${request._id}', 'rejected')">Reject</button>
        `;
      } else {
        actionsHtml = `<span class="status-rejected">Rejected</span>`;
      }

      item.innerHTML = `
        <div class="list-item-content">
          <div class="list-item-title" style="font-weight: 700; color: var(--primary);">${startupName}</div>
          <div class="list-item-subtitle">From: ${founderName}</div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #444;">
            <strong>Subject:</strong> ${displayTitle}
          </div>
          <div style="margin-top: 0.25rem; font-size: 0.85rem; color: #666; font-style: italic;">
            "${displayMessage}"
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink: 0;">
          ${actionsHtml}
        </div>
      `;
      return item;
    }

    // Helper: Create Sent Request Item (By Provider)
    function createSentRequestItem(request) {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const startupName = request.startupId?.name || 'Startup';
      const founder = request.founderId || {};
      const founderId = founder._id || 'unknown';
      const founderName = founder.name || 'Founder';
      
      // FIX: Safely get picture
      const founderPic = founder.profilePicture || '';

      const displayTitle = request.servicesOffered || 'Connection Request';
      const displayMessage = request.message || 'No message provided.';

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
          <div class="list-item-title" style="font-weight: 700;">To: ${startupName}</div>
          <div class="list-item-subtitle">Founder: ${founderName}</div>
           <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #444;">
            <strong>Subject:</strong> ${displayTitle}
          </div>
          <div style="margin-top: 0.25rem; font-size: 0.85rem; color: #666; font-style: italic;">
            "${displayMessage}"
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink: 0;">
          ${statusHtml}
        </div>
      `;
      return item;
    }
    
    // Update Request Action (Accept/Reject)
    window.updateRequest = async function(requestId, newStatus) {
      if (!confirm(`Are you sure you want to ${newStatus} this request?`)) return;
      try {
        // Call API (Make sure this route exists in backend/provider.js)
        await api.updateIntroRequest(requestId, newStatus);
        alert(`Request marked as ${newStatus}!`);
        loadRequests(); // Refresh list
        loadDashboard(); // Refresh stats
      } catch (error) {
        alert('Failed: ' + error.message);
      }
    };
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

    // Modals
    const requestModal = document.getElementById('request-modal');
    const profileModal = document.getElementById('profile-modal');
    let currentStartupId = null;

    window.openRequestModal = function(startupId) {
      currentStartupId = startupId;
      document.getElementById('request-message').value = '';
      document.getElementById('services-offered').value = '';
      requestModal.classList.add('active');
    };

        // Send Request Logic
    document.getElementById('send-request').addEventListener('click', async () => {
      const message = document.getElementById('request-message').value.trim();
      const services = document.getElementById('services-offered').value.trim();
      
      if (!message) return alert('Please explain how you can help.');
      if (!services) return alert('Please list the services you offer.');

      try {
        // Calls the updated API function
        const result = await api.sendProviderRequest(currentStartupId, message, services);
        
        if (result.success) {
          alert('Connection request sent successfully!');
          requestModal.classList.remove('active');
          // Optional: Refresh dashboard stats
          loadDashboard(); 
        } else {
          alert(result.message || 'Failed to send request');
        }
      } catch (error) {
        console.error(error);
        alert('Failed: ' + error.message);
      }
    });
    document.getElementById('cancel-request').addEventListener('click', () => requestModal.classList.remove('active'));
    document.querySelector('.modal-close').addEventListener('click', () => requestModal.classList.remove('active'));
    
    // Close Profile Modal
    document.getElementById('close-profile').addEventListener('click', () => profileModal.classList.remove('active'));

        // ==========================================
    // SETTINGS LOGIC (PROVIDER) - FIXED
    // ==========================================

    function loadSettings() {
      // 1. Safely get elements
      const nameInput = document.getElementById('settings-full-name');
      const emailInput = document.getElementById('settings-email');
      const roleInput = document.getElementById('settings-role');
      
      // 2. Set initial values
      if(nameInput) nameInput.value = user.name || '';
      if(emailInput) emailInput.value = user.email || '';
      if(roleInput) roleInput.value = 'Provider';
      
      // 3. Fetch fresh data
      fetch(`${API_URL}/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => {
            if(r.status === 404) return api.getProfile(); // Fallback
            return r.json();
        })
        .then(data => {
           const profile = data.profile || data;

           // Update Toggle
           const notifCheckbox = document.getElementById('email-notifications');
           if(notifCheckbox) notifCheckbox.checked = profile.emailNotifications ?? true;
           
           // Update Picture
           const previewImg = document.getElementById('settings-profile-preview');
           if (previewImg) {
             if (profile.profilePicture) {
               const imageUrl = profile.profilePicture.startsWith('http') 
                 ? profile.profilePicture 
                 : `${window.location.origin}${profile.profilePicture}`;
               previewImg.src = imageUrl;
               updateProviderHeaderAvatar(imageUrl);
             } else {
               const name = profile.name || 'User';
               previewImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=100`;
             }
           }
        })
        .catch(err => console.error('Settings Load Error:', err));
    }

        // Helper to update header avatar
    function updateProviderHeaderAvatar(imageUrl) {
      const avatarEl = document.querySelector('.user-avatar');
      if (avatarEl && imageUrl) {
        const fullUrl = imageUrl.startsWith('http') 
          ? imageUrl 
          : `${window.location.origin}${imageUrl}`;
        avatarEl.innerHTML = `<img src="${fullUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      }
    }

    // Handle File Selection
    document.getElementById('profile-picture-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) return alert('File too large (max 5MB)');
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('settings-profile-preview');
            if(preview) preview.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Handle Upload
    document.getElementById('upload-picture-btn')?.addEventListener('click', async () => {
      const fileInput = document.getElementById('profile-picture-input');
      if (!fileInput?.files?.length) return alert('Select an image first');

      const formData = new FormData();
      formData.append('profilePicture', fileInput.files[0]);

      try {
        const res = await fetch(`${API_URL}/auth/upload-profile-picture`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        alert('Picture updated!');
        user.profilePicture = data.profilePicture;
        localStorage.setItem('user', JSON.stringify(user));
        updateProviderHeaderAvatar(data.profilePicture);
      } catch (err) { alert(err.message); }
    });

    // Update Profile Button
    document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
      const nameEl = document.getElementById('settings-full-name');
      const notifEl = document.getElementById('email-notifications');
      
      const name = nameEl?.value.trim();
      const emailNotifications = notifEl?.checked;

      if (!name) return alert('Name is required');
      
      try {
        // 1. Try Auth Route (Best for Name/Notifications)
        let res = await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name, emailNotifications })
        });

        // 2. Fallback to Provider Route if Auth fails (Only for name)
        if (res.status === 404) {
             res = await api.updateProfile({ name }); 
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');

        alert('Profile updated!');
        user.name = name;
        localStorage.setItem('user', JSON.stringify(user));
        document.getElementById('user-name').textContent = name;

      } catch (err) { alert(err.message); }
    });

    // Toggle Notifications
    document.getElementById('email-notifications')?.addEventListener('change', async (e) => {
       try {
         await fetch(`${API_URL}/auth/profile`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
           body: JSON.stringify({ emailNotifications: e.target.checked })
         });
       } catch (err) { alert('Failed to save preference'); }
    });

        // ==========================================
    // PASSWORD CHANGE LOGIC (FIXED + EYE ICON)
    // ==========================================
    
    // Toggle Password Visibility
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
        const currEl = document.getElementById('current-password');
        const newEl = document.getElementById('new-password');
        const confEl = document.getElementById('confirm-password');

        const curr = currEl.value;
        const newP = newEl.value;
        const conf = confEl.value;

        if(!curr || !newP || !conf) return alert('Fill all password fields');
        if(newP !== conf) return alert('Passwords do not match');
        if(newP.length < 8) return alert('Password must be 8+ characters');

        try {
            const res = await fetch(`${API_URL}/auth/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: curr, newPassword: newP })
            });

            const data = await res.json(); // Always parse JSON

            if (!res.ok) {
                // ✅ Only throw error if response is NOT OK
                throw new Error(data.message || 'Failed to update');
            }

            // ✅ Only success if we reach here
            alert('Password Updated!');
            currEl.value = '';
            newEl.value = '';
            confEl.value = '';

        } catch(e) { 
            alert(e.message); 
        }
    });

    // Delete & Logout
    document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
      if (!confirm('Delete account permanently?')) return;
      try {
        await api.deleteAccount();
        localStorage.clear();
        window.location.href = 'login.html';
      } catch(e) { alert(e.message); }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      if (confirm('Logout?')) {
        localStorage.clear();
        window.location.href = 'login.html';
      }
    });

    document.getElementById('update-profile-btn')?.addEventListener('click', () => {
      const name = document.getElementById('full-name').value.trim();
      const email = document.getElementById('email').value.trim();
      if (!name || !email) return alert('Fill all fields');
      alert('Updated!');
    });

    document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
      if(!confirm('Delete account?')) return;
      try {
        await api.deleteAccount();
        localStorage.clear();
        window.location.href = 'login.html';
      } catch(e) { alert(e.message); }
    });
    
    document.getElementById('logout-btn')?.addEventListener('click', () => {
       localStorage.clear();
       window.location.href = 'login.html';
    });

    // Init
    document.addEventListener('DOMContentLoaded', loadDashboard);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (requestModal.classList.contains('active') || profileModal.classList.contains('active'))) {
        requestModal.classList.remove('active');
        profileModal.classList.remove('active');
      }
    });
        // ==========================================
    // CORRECTED CHAT & REQUESTS LOGIC
    // ==========================================

    // 1. Global Helper for Chat API (Must be global scope)
    async function chatApiCall(endpoint, method = 'GET', body = null) {
      const token = localStorage.getItem('token');
      
      // FIX: Proper headers construction
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const config = { method, headers };
      
      // FIX: Strictly stringifying body
      if (body) {
        config.body = JSON.stringify(body);
      }

      // FIX: Correct URL path
      const response = await fetch(`${API_URL}/chat${endpoint}`, config);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Network Error');
      }
      return response.json();
    }

        function createRequestItem(request) {
      const item = document.createElement('div');
      item.className = 'list-item';
      const startupName = request.startupId?.name || 'Unnamed Startup';
      
      const founder = request.founderId || {};
      const founderId = founder._id || founder;
      const founderName = founder.name || 'Founder';
      const founderPic = founder.profilePicture || ''; // Get picture

      let actions = '';
      if (request.status === 'accepted') {
        // ✅ Pass founderPic
        actions = `<button class="btn btn-primary btn-sm" onclick="window.openChat('${founderId}', '${founderName}', '${founderPic}')">Chat</button>`;
      }

      const msgPreview = request.message ? `<div style="font-size:0.85rem; color:#555; margin-top:4px;"><i>"${request.message}"</i></div>` : '';

      item.innerHTML = `
        <div class="list-item-content">
          <div class="list-item-title">${startupName}</div>
          <div class="list-item-subtitle">From: ${founderName}</div>
          ${msgPreview}
        </div>
        <div style="display:flex; align-items:center; gap:1rem;">
            <span class="status-${request.status}">${request.status.toUpperCase()}</span>
            ${actions}
        </div>
      `;
      return item;
    }
   
    // // 3. Chat Logic Variables
    // // let chatSocket;

    // // Initialize Socket
    // // if (typeof io !== 'undefined') {
    // //     chatSocket = io();
    // //     if (user && user.id) chatSocket.emit('join', user.id);

    // //     chatSocket.on('receiveMessage', (msg) => {
    // //       if (currentChatPartnerId === msg.senderId._id) {
    // //          const container = document.getElementById('messages-container');
    // //          const div = document.createElement('div');
    // //          div.style.marginBottom = '0.5rem';
    // //          div.style.textAlign = 'left';
    // //          div.innerHTML = `<span style="background: #e5e7eb; padding: 0.5rem 0.75rem; border-radius: 8px; display: inline-block;">${msg.content}</span>`;
    // //          container.appendChild(div);
    // //          container.scrollTop = container.scrollHeight;
    // //       } else {
    // //          console.log('New message from', msg.senderId.name);
    // //          if (document.getElementById('chat-page').classList.contains('active')) {
    // //              loadConversations(); 
    // //          }
    // //       }
    // //     });
    // // } else {
    // //     console.warn("Socket.IO not loaded.");
    // // }

    // 4. Navigation Helper (Needed for button click)
    function navigateToPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${pageName}-page`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
        loadPageContent(pageName);
    }


        // ==========================================
    // ROBUST CHAT LOGIC
    // ==========================================

       window.openChat = async function(partnerId, partnerName, partnerPic) {
        // ✅ FIX: Navigate to Chat Page immediately (works from any page like Requests)
        navigateToPage('chat');

        if (!partnerId) return console.error("No Partner ID provided");
        
        // Sanitize Name
        partnerName = partnerName || 'Unknown User';

        // Sanitize Image URL
        let avatarUrl = '';
        if (partnerPic && partnerPic !== 'undefined' && partnerPic !== 'null') {
             avatarUrl = partnerPic.startsWith('http') ? partnerPic : `${window.location.origin}${partnerPic}`;
        } else {
             avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`;
        }

        // UI Setup
        const chatPage = document.getElementById('chat-page');
        const emptyState = document.getElementById('chat-empty');
        const activeView = document.getElementById('chat-active-view');
        const headerImg = document.getElementById('chat-partner-img');
        const headerName = document.getElementById('chat-partner-name');

        emptyState.style.display = 'none';
        activeView.style.display = 'flex';
        
        // Set Header Info
        headerImg.src = avatarUrl;
        headerName.textContent = partnerName;

        // Mobile Toggle Class (Triggers the slide-in animation)
        chatPage.classList.add('chat-active');

        // Load Messages
        currentChatPartnerId = partnerId.toString(); 
        
        try {
            const msgs = await chatApiCall(`/${partnerId}`);
            const container = document.getElementById('messages-container');
            container.innerHTML = '';
            
            if(msgs.length === 0) { 
                container.innerHTML = '<p style="text-align:center; color:#999; margin-top:2rem;">No messages yet. Say hello! 👋</p>'; 
            } else {
                msgs.forEach(m => {
                    const div = document.createElement('div');
                    let senderId = (m.senderId._id || m.senderId).toString();
                    const isSent = senderId === userId;
                    
                    div.className = `message-row ${isSent ? 'sent' : 'received'}`;
                    const time = new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    div.innerHTML = `
                      <div class="message-bubble">
                        ${m.content}
                        <div class="message-time">${time}</div>
                      </div>
                    `;
                    container.appendChild(div);
                });
                container.scrollTop = container.scrollHeight;
            }
        } catch(e) { 
            console.error("Error loading messages:", e);
        }
    }

    async function loadConversations() {
        try {
            const convs = await chatApiCall('/conversations');
            const list = document.getElementById('conversations-list');
            list.innerHTML = '';
            
            if (!convs || convs.length === 0) {
                list.innerHTML = '<div style="padding:2rem; text-align:center; color:#999;">No conversations yet.</div>';
                return;
            }

            convs.forEach(c => {
                let partner = null;
                
                // ====================================================
                // LOGIC UPDATE: Handle all 3 possible API formats
                // ====================================================

                // 1. Flat Structure (YOUR CURRENT FORMAT):
                // The object itself has 'name' and 'lastMessage' directly on it.
                if (c.name && c.lastMessage) {
                    partner = c; 
                }
                // 2. Standard Structure: 
                // Object has a 'participants' array.
                else if (c.participants && Array.isArray(c.participants)) {
                    partner = c.participants.find(p => p._id.toString() !== userId);
                } 
                // 3. Nested Structure:
                // Object has 'founderId' or 'providerId'.
                else if (c.founderId) {
                    partner = c.founderId;
                } else if (c.providerId) {
                    partner = c.providerId;
                }

                if (!partner) {
                    console.warn("Could not identify partner in object:", c);
                    return; 
                }

                const partnerId = partner._id;
                const partnerName = partner.name || 'Unknown';
                
                // Safe Image Logic
                let partnerPic = partner.profilePicture;
                let avatarUrl = '';
                if (partnerPic && partnerPic !== 'undefined') {
                     avatarUrl = partnerPic.startsWith('http') ? partnerPic : `${window.location.origin}${partnerPic}`;
                } else {
                     avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`;
                }

                const div = document.createElement('div');
                div.className = 'conversation-item';
                
                // Get lastMessage. 
                // If format 1 (flat), it's c.lastMessage.
                // If format 2 (nested), it might be c.lastMessage or c.lastMessage?.content
                const previewText = c.lastMessage?.content || c.lastMessage || 'Start chatting...';

                div.innerHTML = `
                  <img src="${avatarUrl}" class="conversation-avatar">
                  <div class="conversation-info">
                    <div class="conversation-name">${partnerName}</div>
                    <div class="conversation-preview">${previewText}</div>
                  </div>
                `;
                
                div.onclick = () => window.openChat(partnerId, partnerName, partnerPic);
                list.appendChild(div);
            });
        } catch(e) { 
            console.error("Error loading conversations list:", e);
            document.getElementById('conversations-list').innerHTML = '<div style="padding:2rem; text-align:center; color:red;">Error loading chats.</div>';
        }
    }
    window.closeChatMobile = function() {
        const chatPage = document.getElementById('chat-page');
        chatPage.classList.remove('chat-active');
    };

    // Add Enter Key Listener
    document.getElementById('message-input')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') window.sendMessage();
    });
        // ==========================================
    // LEGAL MODAL LOGIC
    // ==========================================

    const legalDocs = {
        privacy: {
            title: "Privacy Policy",
            content: `
                <p><strong>Last Updated:</strong> March 2026</p>
                <p>At Dolphin, we are committed to protecting your privacy. This policy outlines how we collect, use, and safeguard your information when you use our platform to connect founders and service providers.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">1. Information We Collect</h4>
                <p>We collect information you provide directly to us, such as your name, email address, profile picture, professional expertise, and startup details. We also collect usage data to improve our services.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">2. How We Use Information</h4>
                <p>We use the information to facilitate connections between users, provide customer support, and communicate with you about updates and opportunities.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">3. Data Sharing</h4>
                <p>We do not sell your personal data. We share necessary information (like your public profile) to enable networking and mentorship features on the platform.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">4. Security</h4>
                <p>We implement standard security measures to protect your data, but no method of transmission over the Internet is 100% secure.</p>
            `
        },
        terms: {
            title: "Terms of Service",
            content: `
                <p><strong>Last Updated:</strong> March 2026</p>
                <p>Welcome to Dolphin. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">1. User Accounts</h4>
                <p>You are responsible for maintaining the confidentiality of your account. You agree to provide accurate information and update it as necessary.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">2. Acceptable Use</h4>
                <p>You agree not to use the platform for any unlawful purpose or in any way that could damage, disable, or impair the service. Harassment, spam, or fraudulent activity is strictly prohibited.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">3. Connections & Engagement</h4>
                <p>Connections made on Dolphin are between individuals. Dolphin is not liable for the outcome of any professional relationship formed through the platform.</p>
                <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">4. Termination</h4>
                <p>We reserve the right to suspend or terminate accounts that violate these terms or for any reason at our discretion.</p>
            `
        }
    };

    window.openLegalModal = function(type) {
        const doc = legalDocs[type];
        if (!doc) return;

        document.getElementById('legal-modal-title').textContent = doc.title;
        document.getElementById('legal-modal-body').innerHTML = doc.content;
        
        const modal = document.getElementById('legal-modal');
        modal.classList.add('active');
    };

    window.closeLegalModal = function() {
        const modal = document.getElementById('legal-modal');
        modal.classList.remove('active');
    };