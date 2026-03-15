// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const API_URL = 'https://api.dolphinorg.in/api';
const API_BASE = `${API_URL}/provider`;
const AUTH_BASE = `${API_URL}/auth`;

const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const userId = (user._id || user.id)?.toString();

if (!token) console.warn("No token found.");

// ==========================================
// 2. API & HELPER FUNCTIONS
// ==========================================

async function apiCall(endpoint, method = 'GET', body = null, base = API_BASE) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    const response = await fetch(`${base}${endpoint}`, config);
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = 'login.html';
      return;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

async function chatApiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  const response = await fetch(`${API_URL}/chat${endpoint}`, config);
  if (!response.ok) throw new Error('Network Error');
  return response.json();
}

const api = {
  getMyRequests: async () => {
    const data = await apiCall('/my-requests');
    if (Array.isArray(data)) return data;
    return data.requests || [];
  },
  getEligibleFounders: async () => apiCall('/eligible-founders'),
  updateIntroRequest: async (id, status) => apiCall(`/requests/${id}`, 'PUT', { status }),
  sendProviderRequest: async (startupId, message, servicesOffered) => apiCall('/send-request', 'POST', { startupId, message, servicesOffered }),
  getProfile: async () => apiCall('/profile'),
  updateProfile: async (profileData) => apiCall('/profile', 'PUT', profileData),
  deleteAccount: async () => apiCall('/account', 'DELETE', null, AUTH_BASE),
};

// ==========================================
// HELPER: VERIFIED BADGE (WITH WHITE CHECKMARK)
// ==========================================
function getVerifiedBadgeHtml(state) {
  const verifiedStates = ['APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7'];
  
  // If not verified, return empty string
  if (!verifiedStates.includes(state)) return '';

  // Inline styles ensure the White Checkmark appears on Blue Background
  return `<span class="verified-badge" style="position: absolute; bottom: 0; right: 0; background: #2563eb; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </span>`;
}

function identifyRequestType(req, currentUserId) {
  if (req.initiator === 'provider') return 'sent';
  if (req.initiator === 'founder') return 'incoming';
  const sender = (req.senderId?._id || req.senderId)?.toString();
  if (sender) return sender === currentUserId ? 'sent' : 'incoming';
  if (req.servicesOffered) return 'sent';
  return 'incoming';
}

function updateProviderHeaderAvatar(imageUrl) {
  const avatarEl = document.querySelector('.user-avatar');
  if (avatarEl && imageUrl) {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`;
    avatarEl.innerHTML = `<img src="${fullUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  }
}

// Toggles visibility of verified badges in Navbar and Settings
function updateVerifiedBadges(state) {
    const verifiedStates = ['APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7'];
    const isApproved = verifiedStates.includes(state);
    
    const navBadge = document.getElementById('navbar-verified-badge');
    const settingsBadge = document.getElementById('settings-verified-badge');
    
    if(navBadge) navBadge.style.display = isApproved ? 'flex' : 'none';
    if(settingsBadge) settingsBadge.style.display = isApproved ? 'flex' : 'none';
}

function navigateToPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`${pageName}-page`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if(navItem) navItem.classList.add('active');
  loadPageContent(pageName);
}

// ==========================================
// 3. UI HELPERS: TOAST & CONFIRM
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

function showConfirm(message, onConfirm) {
  const modal = document.getElementById('custom-confirm-modal');
  const msgEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!modal || !msgEl || !okBtn || !cancelBtn) return;

  msgEl.textContent = message;
  modal.classList.add('active');

  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    if (typeof onConfirm === 'function') onConfirm();
  });

  newCancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
}

// ==========================================
// 4. NOTIFICATION LOGIC
// ==========================================

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
// 5. CORE PAGE LOADERS (OPTIMIZED)
// ==========================================

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
  // 1. INSTANT RENDER FROM CACHE (0ms latency)
  try {
    const cachedProfile = localStorage.getItem('providerProfileCache');
    if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        renderDashboardUI(profile);
        updateVerifiedBadges(profile.state);
    }
  } catch(e) {}

  // 2. PARALLEL FETCH (Background Sync)
  try {
    const [profile, requests, founders] = await Promise.all([
        api.getProfile(),
        api.getMyRequests(),
        api.getEligibleFounders()
    ]);

    // Update Cache
    localStorage.setItem('providerProfileCache', JSON.stringify(profile));

    // Render Fresh Data
    renderDashboardUI(profile);
    updateVerifiedBadges(profile.state);
    
    // Update Header Avatar
    if (profile.profilePicture) updateProviderHeaderAvatar(profile.profilePicture);
    else if (profile.userId?.profilePicture) updateProviderHeaderAvatar(profile.userId.profilePicture);

    // Update Stats
    document.getElementById('avg-rating').textContent = profile.avgRating || '0.0';
    const activeEngagements = requests.filter(r => r.status === 'accepted').length;
    document.getElementById('active-engagements').textContent = activeEngagements;
    const acceptedRequests = requests.filter(r => r.status === 'accepted').length;
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length;
    const totalClosed = acceptedRequests + rejectedRequests;
    document.getElementById('response-rate').textContent = totalClosed > 0 ? Math.round((acceptedRequests / totalClosed) * 100) + '%' : '0%';
    document.getElementById('eligible-founders').textContent = String(founders?.length || 0);

    // Recent Activity
    const recentActivity = document.getElementById('recent-activity');
    recentActivity.innerHTML = '';
    if (requests.length === 0) {
      recentActivity.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No recent activity.</p>';
    } else {
      requests.slice(0, 3).forEach(request => {
        const statusClass = request.status === 'accepted' ? 'status-accepted' : request.status === 'rejected' ? 'status-rejected' : 'status-pending';
        const startupName = request.startupId?.name || 'Unnamed Startup';
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div class="list-item-content"><div class="list-item-title">${startupName}</div><div class="list-item-subtitle">${new Date(request.createdAt).toLocaleDateString()}</div></div>
          <span class="list-item-status ${statusClass}">${request.status.toUpperCase()}</span>`;
        recentActivity.appendChild(item);
      });
    }
  } catch (error) { console.error('Dashboard Error:', error); }
}

function renderDashboardUI(profile) {
    const name = profile.name || user.name || 'Provider';
    document.getElementById('user-name').textContent = name;
    const nameArray = name.split(' ');
    if(!profile.profilePicture && !profile.userId?.profilePicture) {
        document.querySelector('.user-avatar').textContent = nameArray.map(n => n.charAt(0)).join('');
    }
}

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
  } catch (err) { console.error(err); }
}

function loadSettings() {
  // 1. Load Basic Info
  const nameInput = document.getElementById('settings-full-name');
  const emailInput = document.getElementById('settings-email');
  if(nameInput) nameInput.value = user.name || '';
  if(emailInput) emailInput.value = user.email || '';
  
  // 2. Handle Profile Picture & Badge
  const previewImg = document.getElementById('settings-profile-preview');
  
  // Load from cache instantly
  const cachedProfile = localStorage.getItem('providerProfileCache');
  if (cachedProfile) {
      const p = JSON.parse(cachedProfile);
      const pic = p.profilePicture || p.userId?.profilePicture;
      if (pic && previewImg) previewImg.src = pic.startsWith('http') ? pic : window.location.origin + pic;
      updateVerifiedBadges(p.state);
  }

  // Fresh fetch in background
  api.getProfile().then(profile => {
      updateVerifiedBadges(profile.state);
      if (profile.profilePicture && previewImg) {
          previewImg.src = profile.profilePicture.startsWith('http') ? profile.profilePicture : window.location.origin + profile.profilePicture;
      }
  });
}

// ==========================================
// 6. FOUNDERS PAGE LOGIC
// ==========================================
async function loadFounders() {
  const foundersList = document.getElementById('founders-list');
  foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading...</p>';

  try {
    // OPTIMIZED: Fetch in parallel
    const [founders, requests] = await Promise.all([
        api.getEligibleFounders(),
        api.getMyRequests()
    ]);
    
    const sentRequestsMap = {};
    const incomingRequestsMap = {};

    requests.forEach(req => {
      const startupId = (req.startupId?._id || req.startupId)?.toString();
      if (!startupId) return;
      const type = identifyRequestType(req, userId);
      if (type === 'sent') sentRequestsMap[startupId] = req;
      else incomingRequestsMap[startupId] = req;
    });

    foundersList.innerHTML = '';
    const validFounders = (founders || []).filter(f => f.founderId && f.founderId.name);

    if (!validFounders || validFounders.length === 0) {
      foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No eligible founders found.</p>';
    } else {
      window.currentFoundersList = validFounders;
      window.currentSentRequests = sentRequestsMap;
      window.currentIncomingRequests = incomingRequestsMap;
      
      validFounders.forEach(founder => foundersList.appendChild(createFounderCard(founder, sentRequestsMap, incomingRequestsMap)));
      
      document.getElementById('stage-filter')?.addEventListener('change', () => filterFounders(validFounders, sentRequestsMap, incomingRequestsMap));
      document.getElementById('industry-filter')?.addEventListener('change', () => filterFounders(validFounders, sentRequestsMap, incomingRequestsMap));
    }
  } catch (error) {
    console.error('Error loading founders:', error);
    foundersList.innerHTML = `<p style="text-align: center; color: var(--danger);">Error: ${error.message}</p>`;
  }
}

function filterFounders(allFounders, sentMap, incomingMap) {
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

    if (filtered.length === 0) {
      foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No founders match.</p>';
    } else {
      filtered.forEach(founder => foundersList.appendChild(createFounderCard(founder, sentMap, incomingMap)));
    }
}

// ==========================================
// HELPER: CREATE FOUNDER CARD (FIXED)
// ==========================================
function createFounderCard(founder, sentRequestsMap = {}, incomingRequestsMap = {}) {
  const card = document.createElement('div');
  card.className = 'founder-card';
  
  const userRef = founder.founderId || {};
  const founderName = userRef.name || 'Unknown';
  const startupIdStr = founder._id?.toString();
  card.id = `founder-card-${startupIdStr}`;

  const profileImg = userRef.profilePicture 
    ? userRef.profilePicture 
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(founderName)}&background=random&color=fff&size=128`;

  const mySentRequest = sentRequestsMap[startupIdStr];
  const myIncomingRequest = incomingRequestsMap[startupIdStr];
  const founderUserId = (userRef._id || userRef)?.toString();
  
  let actionsHtml = '';
  if (mySentRequest) {
      if (mySentRequest.status === 'accepted') actionsHtml = `<button class="btn btn-success" style="opacity: 0.8;">Connected</button><button class="btn btn-primary" onclick="window.openChat('${founderUserId}', '${founderName}', '${profileImg}')">Chat</button>`;
      else if (mySentRequest.status === 'pending') actionsHtml = `<button class="btn btn-secondary" disabled>Request Sent (Pending)</button><button class="btn btn-secondary" onclick="viewFounderProfile('${startupIdStr}')">View Profile</button>`;
      else actionsHtml = `<button class="btn btn-danger" onclick="openRequestModal('${startupIdStr}')">Rejected (Retry)</button><button class="btn btn-secondary" onclick="viewFounderProfile('${startupIdStr}')">View Profile</button>`;
  } else if (myIncomingRequest) {
      if (myIncomingRequest.status === 'accepted') actionsHtml = `<button class="btn btn-success" style="opacity: 0.8;">Connected</button><button class="btn btn-primary" onclick="window.openChat('${founderUserId}', '${founderName}', '${profileImg}')">Chat</button>`;
      else if (myIncomingRequest.status === 'pending') actionsHtml = `<button class="btn btn-secondary" disabled>Incoming Request</button><a href="#" onclick="navigateToPage('requests')" class="btn btn-primary">Go to Requests</a>`;
      else actionsHtml = `<button class="btn btn-primary" onclick="openRequestModal('${startupIdStr}')">Send Connection Request</button><button class="btn btn-secondary" onclick="viewFounderProfile('${startupIdStr}')">View Profile</button>`;
  } else {
      actionsHtml = `<button class="btn btn-primary" onclick="openRequestModal('${startupIdStr}')">Send Connection Request</button><button class="btn btn-secondary" onclick="viewFounderProfile('${startupIdStr}')">View Profile</button>`;
  }

  // FIX: Wrap Image and Badge in a container with position: relative
  const imageContainer = `
    <div style="position: relative; width: 48px; height: 48px; flex-shrink: 0;">
        <img src="${profileImg}" alt="${founderName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
        ${getVerifiedBadgeHtml(userRef.state)}
    </div>
  `;

  card.innerHTML = `
    <div class="founder-header">
      <div style="display: flex; align-items: center; gap: 1rem;">
        ${imageContainer}
        <div>
          <div class="founder-name">${founder.startupName || 'Unnamed Startup'}</div>
          <div style="font-size: 0.85rem; color: #666;">Founder: ${founderName}</div>
        </div>
      </div>
    </div>
    <p style="margin: 1rem 0; color: #444;">${founder.thesis || 'No thesis provided.'}</p>
    <div class="founder-details">
      <div class="detail-item"><span class="detail-label">Industry</span><span class="detail-value">${founder.industry || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">Score</span><span class="detail-value" style="font-weight: 700; color: var(--success);">${founder.validationScore ?? 0}%</span></div>
    </div>
    <div class="request-actions">${actionsHtml}</div>`;
  return card;
}


// ==========================================
// 7. REQUESTS PAGE LOGIC
// ==========================================
async function loadRequests() {
  try {
    const requests = await api.getMyRequests();
    const incomingContainer = document.getElementById('incoming-requests-list');
    const sentContainer = document.getElementById('sent-requests-list');
    incomingContainer.innerHTML = '';
    sentContainer.innerHTML = '';

    const incomingReqs = [];
    const sentReqs = [];

    requests.forEach(r => {
      const type = identifyRequestType(r, userId);
      if (type === 'sent') sentReqs.push(r);
      else incomingReqs.push(r);
    });

    document.querySelector('[data-tab="incoming"]').textContent = `Incoming (${incomingReqs.length})`;
    document.querySelector('[data-tab="sent"]').textContent = `Sent (${sentReqs.length})`;

    if (incomingReqs.length === 0) incomingContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No incoming requests.</p>';
    else incomingReqs.forEach(r => incomingContainer.appendChild(createRequestItem(r, 'incoming')));

    if (sentReqs.length === 0) sentContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No sent requests.</p>';
    else sentReqs.forEach(r => sentContainer.appendChild(createRequestItem(r, 'sent')));

  } catch (error) { console.error(error); }
}

function createRequestItem(request, type) {
  const item = document.createElement('div');
  item.className = 'list-item';
  const startupName = request.startupId?.name || 'Startup';
  const founder = request.founderId || {};
  const founderId = founder._id || 'unknown';
  const founderName = founder.name || 'Founder';
  const founderPic = founder.profilePicture || '';
  const displayTitle = request.servicesOffered || 'Connection Request';
  const displayMessage = request.message || 'No message.';

  let actionsHtml = '';
  if (request.status === 'accepted') {
    actionsHtml = `<span class="status-accepted">Accepted</span><button class="btn btn-primary btn-sm" onclick="window.openChat('${founderId}', '${founderName}', '${founderPic}')">Chat</button>`;
  } else if (request.status === 'pending') {
    if (type === 'incoming') actionsHtml = `<button class="btn btn-accept" onclick="updateRequest('${request._id}', 'accepted')">Accept</button><button class="btn btn-reject" onclick="updateRequest('${request._id}', 'rejected')">Reject</button>`;
    else actionsHtml = '<span class="status-pending">Pending</span>';
  } else {
    actionsHtml = '<span class="status-rejected">Rejected</span>';
  }

  item.innerHTML = `
    <div class="list-item-content">
      <div class="list-item-title" style="font-weight: 700;">${type === 'sent' ? 'To: ' + startupName : startupName}</div>
      <div class="list-item-subtitle">${type === 'sent' ? 'Founder: ' + founderName : 'From: ' + founderName}</div>
      <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #444;"><strong>Subject:</strong> ${displayTitle}</div>
      <div style="margin-top: 0.25rem; font-size: 0.85rem; color: #666; font-style: italic;">"${displayMessage}"</div>
    </div>
    <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink: 0;">${actionsHtml}</div>`;
  return item;
}

window.updateRequest = async function(id, status) {
  showConfirm(`${status} this request?`, async () => {
    try {
      await api.updateIntroRequest(id, status);
      showToast(`Request ${status}!`, 'success');
      loadRequests();
      loadDashboard();
    } catch(e) { 
      showToast(e.message, 'error'); 
    }
  });
};

// ==========================================
// 8. CHAT LOGIC
// ==========================================
window.allConversations = [];
let currentChatPartnerId = null;

async function loadConversations() {
  try {
    const convs = await chatApiCall('/conversations');
    window.allConversations = convs || [];
    renderConversations(window.allConversations);
    setupChatSearch();
  } catch(e) {
    console.error("Error loading conversations:", e);
    const list = document.getElementById('conversations-items');
    if(list) list.innerHTML = '<div style="padding:2rem; text-align:center; color:red;">Error loading chats.</div>';
  }
}

function renderConversations(conversations) {
  const list = document.getElementById('conversations-items');
  if (!list) return;
  list.innerHTML = '';

  if (!conversations || conversations.length === 0) {
    const searchInput = document.getElementById('chat-search-input');
    const isSearching = searchInput && searchInput.value.trim() !== '';
    list.innerHTML = isSearching 
      ? '<div style="padding:2rem; text-align:center; color:#999;">No results found.</div>'
      : '<div style="padding:2rem; text-align:center; color:#999;">No conversations yet.</div>';
    return;
  }

  conversations.forEach(c => {
    let partner = null;
    if (c.name && c.lastMessage) partner = c;
    else if (c.participants && Array.isArray(c.participants)) partner = c.participants.find(p => p._id.toString() !== userId);
    else if (c.founderId) partner = c.founderId;
    else if (c.providerId) partner = c.providerId;

    if (!partner) return;

    const partnerId = partner._id;
    const partnerName = partner.name || 'Unknown';
    let partnerPic = partner.profilePicture;
    let avatarUrl = partnerPic ? (partnerPic.startsWith('http') ? partnerPic : `${window.location.origin}${partnerPic}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`;
    const previewText = c.lastMessage?.content || c.lastMessage || 'Start chatting...';

    const div = document.createElement('div');
    div.className = 'conversation-item';
    div.innerHTML = `
      <img src="${avatarUrl}" class="conversation-avatar">
      <div class="conversation-info">
        <div class="conversation-name">${partnerName}</div>
        <div class="conversation-preview">${previewText}</div>
      </div>`;
    div.onclick = () => window.openChat(partnerId, partnerName, partnerPic);
    list.appendChild(div);
  });
}

function setupChatSearch() {
  const searchInput = document.getElementById('chat-search-input');
  if (!searchInput) return;

  const newInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newInput, searchInput);

  newInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) return renderConversations(window.allConversations);

    const filtered = window.allConversations.filter(c => {
      let partnerName = '';
      if (c.name) partnerName = c.name;
      else if (c.participants) {
        const p = c.participants.find(p => p._id.toString() !== userId);
        partnerName = p?.name || '';
      } else if (c.founderId) partnerName = c.founderId.name;
      else if (c.providerId) partnerName = c.providerId.name;
      return partnerName.toLowerCase().includes(term);
    });
    renderConversations(filtered);
  });
}

window.openChat = async function(partnerId, partnerName, partnerPic) {
  if (!partnerId) return;
  document.getElementById('profile-modal')?.classList.remove('active');
  document.getElementById('request-modal')?.classList.remove('active');
  navigateToPage('chat');

  partnerName = partnerName || 'Unknown User';
  let avatarUrl = (partnerPic && partnerPic !== 'undefined') 
    ? (partnerPic.startsWith('http') ? partnerPic : `${window.location.origin}${partnerPic}`) 
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`;

  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-active-view').style.display = 'flex';
  document.getElementById('chat-partner-img').src = avatarUrl;
  document.getElementById('chat-partner-name').textContent = partnerName;
  document.getElementById('chat-page').classList.add('chat-active');

  currentChatPartnerId = partnerId.toString();
  
  try {
    const msgs = await chatApiCall(`/${partnerId}`);
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    if(msgs.length === 0) container.innerHTML = '<p style="text-align:center; color:#999; margin-top:2rem;">No messages yet. Say hello! 👋</p>';
    else {
      msgs.forEach(m => {
        const div = document.createElement('div');
        const isSent = (m.senderId._id || m.senderId).toString() === userId;
        div.className = `message-row ${isSent ? 'sent' : 'received'}`;
        div.innerHTML = `<div class="message-bubble">${m.content}<div class="message-time">${new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>`;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    }
  } catch(e) { console.error(e); }
};

window.closeChatMobile = function() {
    document.getElementById('chat-page').classList.remove('chat-active');
};

window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || !currentChatPartnerId) return;
  
  const container = document.getElementById('messages-container');
  container.querySelector('p')?.remove();
  const div = document.createElement('div');
  div.className = 'message-row sent';
  div.innerHTML = `<div class="message-bubble">${content}<div class="message-time" style="text-align: right;">Just now</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';

  try { await chatApiCall('/send', 'POST', { receiverId: currentChatPartnerId, content }); }
  catch(e) { showToast('Failed to send message', 'error'); }
};

// ==========================================
// 9. MODALS & GLOBAL FUNCTIONS
// ==========================================

window.viewFounderProfile = function(startupId) {
  const profileModal = document.getElementById('profile-modal');
  const target = window.currentFoundersList?.find(f => f._id === startupId);
  if (!target) return;

  profileModal.classList.add('active');
  const user = target.founderId || {};
  const profileImg = user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`;

  document.getElementById('detail-startup-name').innerHTML = `${target.startupName} ${getVerifiedBadgeHtml(user.state)}`;
  document.getElementById('detail-thesis').textContent = target.thesis || 'N/A';
  document.getElementById('detail-industry').textContent = target.industry || 'N/A';
  document.getElementById('detail-score').textContent = (target.validationScore ?? 0) + '%';
  document.getElementById('detail-founder-name').textContent = user.name || 'Unknown';
  document.getElementById('detail-founder-email').textContent = user.email || 'N/A';
  
  const founderNameRow = document.querySelector('#profile-content .founder-details .detail-item:first-child');
  if(founderNameRow) founderNameRow.innerHTML = `<span class="detail-label">Founder</span><span class="detail-value" style="display: flex; align-items: center; gap: 8px;"><img src="${profileImg}" style="width: 24px; height: 24px; border-radius: 50%;">${user.name || 'Unknown'}</span>`;
  
  document.getElementById('profile-content').style.display = 'block';
  document.getElementById('profile-loader').style.display = 'none';
};

let currentStartupId = null;

window.openRequestModal = function(startupId) {
  currentStartupId = startupId;
  document.getElementById('request-message').value = '';
  document.getElementById('services-offered').value = '';
  document.getElementById('request-modal').classList.add('active');
};

window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
};

// Legal Modals
const legalDocs = {
    privacy: { title: "Privacy Policy", content: `<p>Privacy Policy content...</p>` },
    terms: { title: "Terms of Service", content: `<p>Terms content...</p>` }
};

window.openLegalModal = function(type) {
    const doc = legalDocs[type];
    if (!doc) return;
    document.getElementById('legal-modal-title').textContent = doc.title;
    document.getElementById('legal-modal-body').innerHTML = doc.content;
    document.getElementById('legal-modal').classList.add('active');
};

window.closeLegalModal = function() {
    document.getElementById('legal-modal').classList.remove('active');
};

// ==========================================
// 10. EVENT LISTENERS & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  
  // --- FIX: NOTIFICATION LOGIC MOVED INSIDE DOMCONTENTLOADED ---
  const notifBtn = document.getElementById('notification-btn');
  const notifDropdown = document.getElementById('notification-dropdown');
  
  if (notifBtn && notifDropdown) {
      notifDropdown.style.display = 'none'; // Ensure hidden on start

      notifBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const isOpen = notifDropdown.style.display === 'flex';
          notifDropdown.style.display = isOpen ? 'none' : 'flex';
          if (!isOpen) await loadNotificationList();
      });
      
      window.closeNotifDropdown = () => notifDropdown.style.display = 'none';
      
      window.addEventListener('click', (e) => {
          if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
              closeNotifDropdown();
          }
      });
  }
  // ---------------------------------------------------------

  // Set Header Info
  document.getElementById('user-name').textContent = user.name || 'Provider';
  const nameArray = (user.name || 'Provider').split(' ');
  document.querySelector('.user-avatar').textContent = nameArray.map(n => n.charAt(0)).join('');

  // Initial Load
  loadDashboard();
  updateNotificationBadge();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar')?.classList.remove('active');
        document.querySelector('.sidebar-overlay')?.classList.remove('active');
      }
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(`${page}-page`)?.classList.add('active');
      loadPageContent(page);
    });
  });

  // Profile Form
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
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
        showToast('Profile updated!', 'success'); 
        localStorage.setItem('providerProfileCache', JSON.stringify(profileData));
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Send Request Button
  document.getElementById('send-request')?.addEventListener('click', async () => {
    const message = document.getElementById('request-message').value.trim();
    const services = document.getElementById('services-offered').value.trim();
    if (!message || !services) return showToast('Please fill all fields.', 'warning');

    const btn = document.getElementById('send-request');
    btn.disabled = true; btn.textContent = 'Sending...';

    try {
      const result = await api.sendProviderRequest(currentStartupId, message, services);
      if (result.success) {
        showToast('Request sent!', 'success');
        document.getElementById('request-modal').classList.remove('active');
        
        const cardEl = document.getElementById(`founder-card-${currentStartupId}`);
        if (cardEl) cardEl.querySelector('.request-actions').innerHTML = `<button class="btn btn-secondary" disabled>Request Sent (Pending)</button>`;
        
        if (!window.currentSentRequests) window.currentSentRequests = {};
        window.currentSentRequests[currentStartupId] = { status: 'pending' };
        loadDashboard(); 
      } else { showToast(result.message || 'Failed', 'error'); }
    } catch(e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Send Request'; }
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`${tabName}-tab`)?.classList.add('active');
    });
  });
  
  // Close Profile Modal
  document.getElementById('close-profile')?.addEventListener('click', () => {
    document.getElementById('profile-modal').classList.remove('active');
  });

  // SETTINGS: Update Profile Button
  document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
      const nameEl = document.getElementById('settings-full-name');
      const name = nameEl.value.trim();
      if (!name) return showToast('Name is required', 'warning');
      
      try {
        let res = await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name })
        });
        if (res.status === 404) res = await api.updateProfile({ name });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');

        showToast('Profile updated!', 'success');
        user.name = name;
        localStorage.setItem('user', JSON.stringify(user));
        document.getElementById('user-name').textContent = name;
        document.querySelector('.user-avatar').textContent = name.split(' ').map(n => n.charAt(0)).join('');

      } catch (err) { showToast(err.message, 'error'); }
  });

  // SETTINGS: Update Password Button
  document.getElementById('update-password-btn')?.addEventListener('click', async () => {
      const curr = document.getElementById('current-password').value;
      const newP = document.getElementById('new-password').value;
      const conf = document.getElementById('confirm-password').value;

      if(!curr || !newP || !conf) return showToast('Fill all password fields', 'warning');
      if(newP !== conf) return showToast('Passwords do not match', 'error');
      if(newP.length < 8) return showToast('Password must be 8+ characters', 'warning');

      try {
          const res = await fetch(`${API_URL}/auth/password`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ currentPassword: curr, newPassword: newP })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to update');
          showToast('Password Updated!', 'success');
          document.getElementById('current-password').value = ''; 
          document.getElementById('new-password').value = ''; 
          document.getElementById('confirm-password').value = '';
      } catch(e) { showToast(e.message, 'error'); }
  });

  // SETTINGS: Image Upload Logic
  const fileInput = document.getElementById('profile-picture-input');
  const uploadBtn = document.getElementById('upload-picture-btn');
  const previewImg = document.getElementById('settings-profile-preview');

  if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      
      fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          // Validation
          if (file.size > 5000000) return showToast('Max size 5MB.', 'error');
          
          // Preview
          const reader = new FileReader();
          reader.onload = (ev) => { if(previewImg) previewImg.src = ev.target.result; };
          reader.readAsDataURL(file);

          // Upload
          const fd = new FormData();
          fd.append('profilePicture', file);

          uploadBtn.innerHTML = 'Uploading...';
          uploadBtn.disabled = true;

          try {
              const res = await fetch(`${API_URL}/auth/upload-profile-picture`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: fd
              });
              const d = await res.json();
              if (!res.ok) throw new Error(d.message);
              
              showToast('Uploaded!', 'success');
              
              // Update UI & Cache
              const newUrl = d.profilePicture;
              user.profilePicture = newUrl;
              localStorage.setItem('user', JSON.stringify(user));
              
              if(previewImg) previewImg.src = newUrl.startsWith('http') ? newUrl : window.location.origin + newUrl;
              updateProviderHeaderAvatar(newUrl);

              // Update Cache
              const cached = JSON.parse(localStorage.getItem('providerProfileCache') || '{}');
              cached.profilePicture = newUrl;
              localStorage.setItem('providerProfileCache', JSON.stringify(cached));

          } catch(err) { showToast(err.message, 'error'); }
          finally { 
              uploadBtn.innerHTML = 'Upload New Photo';
              uploadBtn.disabled = false;
              fileInput.value = '';
          }
      });
  }

  // SETTINGS: Delete Account Button
  document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
      showConfirm('Delete account permanently?', async () => {
        try {
          await api.deleteAccount();
          localStorage.clear();
          window.location.href = 'login.html';
        } catch(e) { showToast(e.message, 'error'); }
      });
  });
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    showConfirm('Logout?', () => {
      localStorage.clear(); 
      window.location.href = 'login.html';
    });
  });
  
  // Mobile Menu
  document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('active');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
  });
  
  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
     document.querySelector('.sidebar')?.classList.remove('active');
     document.querySelector('.sidebar-overlay')?.classList.remove('active');
  });

  // Socket.io Initialization
  if (typeof io === 'function' && userId) {
    const socket = io("https://dolphin-main-production.up.railway.app", { auth: { token } });
    socket.emit('join', userId);

    socket.on('receiveMessage', (msg) => {
      const senderId = (msg.senderId._id || msg.senderId)?.toString();
      const isCurrentChat = currentChatPartnerId?.toString() === senderId;
      if (isCurrentChat && senderId !== userId) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        div.className = 'message-row received';
        div.innerHTML = `<div class="message-bubble">${msg.content}<div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
      }
    });
  }
});