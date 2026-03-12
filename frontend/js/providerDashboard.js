// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const API_URL = "https://dolphin-main-production.up.railway.app/api";
const API_BASE = `${API_URL}/provider`;
const AUTH_BASE = `${API_URL}/auth`;

const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const userId = (user._id || user.id)?.toString();

if (!token) console.warn("No token found.");

// ==========================================
// 2. API & HELPER FUNCTIONS privacy
// ==========================================

// Generic API Caller
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

// Chat Specific API Caller
async function chatApiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  const response = await fetch(`${API_URL}/chat${endpoint}`, config);
  if (!response.ok) throw new Error('Network Error');
  return response.json();
}

// API Object
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

// Helpers
function getVerifiedBadgeHtml(state) {
  const verifiedStates = ['APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7'];
  if (verifiedStates.includes(state)) return `<span class="verified-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> VERIFIED</span>`;
  return '';
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

function navigateToPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`${pageName}-page`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pageName}"]`);
  if(navItem) navItem.classList.add('active');
  loadPageContent(pageName);
}

// ==========================================
// 3. CORE PAGE LOADERS
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
  try {
    const profile = await api.getProfile();
    if (profile.profilePicture) updateProviderHeaderAvatar(profile.profilePicture);
    else if (profile.userId?.profilePicture) updateProviderHeaderAvatar(profile.userId.profilePicture);
    else document.querySelector('.user-avatar').textContent = (profile.name || 'User').split(' ').map(n => n.charAt(0)).join('');

    document.getElementById('avg-rating').textContent = profile.avgRating || '0.0';

    const requests = await api.getMyRequests();
    const activeEngagements = requests.filter(r => r.status === 'accepted').length;
    document.getElementById('active-engagements').textContent = activeEngagements;

    const acceptedRequests = requests.filter(r => r.status === 'accepted').length;
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length;
    const totalClosed = acceptedRequests + rejectedRequests;
    document.getElementById('response-rate').textContent = totalClosed > 0 ? Math.round((acceptedRequests / totalClosed) * 100) + '%' : '0%';

    const eligible = await api.getEligibleFounders();
    document.getElementById('eligible-founders').textContent = String(eligible?.length || 0);

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
  const nameInput = document.getElementById('settings-full-name');
  const emailInput = document.getElementById('settings-email');
  if(nameInput) nameInput.value = user.name || '';
  if(emailInput) emailInput.value = user.email || '';
  
  // Load profile picture
  const previewImg = document.getElementById('settings-profile-preview');
  if (user.profilePicture && previewImg) {
      const imageUrl = user.profilePicture.startsWith('http') ? user.profilePicture : `${window.location.origin}${user.profilePicture}`;
      previewImg.src = imageUrl;
  } else if (previewImg) {
      previewImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=e2e8f0&color=64748b&size=100`;
  }
}

// ==========================================
// 4. FOUNDERS PAGE LOGIC
// ==========================================
async function loadFounders() {
  const foundersList = document.getElementById('founders-list');
  foundersList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Loading...</p>';

  try {
    const founders = await api.getEligibleFounders();
    const requests = await api.getMyRequests();
    
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
      
      // Attach Filter Listeners
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

  card.innerHTML = `
    <div class="founder-header">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <img src="${profileImg}" alt="${founderName}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
        <div>
          <div class="founder-name">${founder.startupName || 'Unnamed Startup'} ${getVerifiedBadgeHtml(userRef.state)}</div>
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
// 5. REQUESTS PAGE LOGIC
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
  if(!confirm(`${status} this request?`)) return;
  try {
    await api.updateIntroRequest(id, status);
    alert(`Request ${status}!`);
    loadRequests();
    loadDashboard();
  } catch(e) { alert(e.message); }
};

// ==========================================
// 6. CHAT LOGIC (WITH SEARCH)
// ==========================================
window.allConversations = [];

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
  catch(e) { alert('Failed to send message'); }
};

// ==========================================
// 7. MODALS & GLOBAL FUNCTIONS
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
    const icon = document.querySelector(`#${inputId}-toggle-icon`);
    if (input.type === 'password') {
        input.type = 'text';
        if(icon) icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = 'password';
        if(icon) icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
};

// Legal Modals
const legalDocs = {
    privacy: { title: "Privacy Policy", content: `<p><strong>Effective Date:</strong> March, 2026</p>
                <p>This privacy policy describes how Dolphin collects, uses, and shares your personal information.</p>
                <h4 style="margin-top:1rem;">Information We Collect</h4>
                <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include your name, email address, phone number, and profile information.</p>
                <h4 style="margin-top:1rem;">How We Use Information</h4>
                <p>We use the information we collect to provide, maintain, and improve our services, to process transactions and send you related information, to respond to your comments and questions, and to provide customer service.</p>
                <h4 style="margin-top:1rem;">Data Security</h4>
                <p>We take reasonable measures to help protect your personal information from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>
            ` },
    terms: { title: "Terms of Service", content: `
                <p><strong>Effective Date:</strong> March, 2026</p>
                <p>Welcome to Dolphin. These Terms of Service govern your use of our website located at dolphin.com and our services.</p>
                <h4 style="margin-top:1rem;">Acceptance of Terms</h4>
                <p>By accessing and using our services, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
                <h4 style="margin-top:1rem;">User Responsibilities</h4>
                <p>You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur under your account or password.</p>
                <h4 style="margin-top:1rem;">Limitation of Liability</h4>
                <p>In no event shall Dolphin, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
            ` }
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
// 8. EVENT LISTENERS & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Set Header Info
  document.getElementById('user-name').textContent = user.name || 'Provider';
  const nameArray = (user.name || 'Provider').split(' ');
  document.querySelector('.user-avatar').textContent = nameArray.map(n => n.charAt(0)).join('');

  // Initial Load
  loadDashboard();

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
    try { await api.updateProfile(profileData); alert('Profile updated!'); } 
    catch (e) { alert(e.message); }
  });

  // Send Request Button
  document.getElementById('send-request')?.addEventListener('click', async () => {
    const message = document.getElementById('request-message').value.trim();
    const services = document.getElementById('services-offered').value.trim();
    if (!message || !services) return alert('Please fill all fields.');

    const btn = document.getElementById('send-request');
    btn.disabled = true; btn.textContent = 'Sending...';

    try {
      const result = await api.sendProviderRequest(currentStartupId, message, services);
      if (result.success) {
        alert('Request sent!');
        document.getElementById('request-modal').classList.remove('active');
        
        const cardEl = document.getElementById(`founder-card-${currentStartupId}`);
        if (cardEl) cardEl.querySelector('.request-actions').innerHTML = `<button class="btn btn-secondary" disabled>Request Sent (Pending)</button>`;
        
        if (!window.currentSentRequests) window.currentSentRequests = {};
        window.currentSentRequests[currentStartupId] = { status: 'pending' };
        loadDashboard(); 
      } else { alert(result.message || 'Failed'); }
    } catch(e) { alert(e.message); }
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
  
  // SETTINGS: Update Profile Button
  document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
      const nameEl = document.getElementById('settings-full-name');
      const name = nameEl.value.trim();
      if (!name) return alert('Name is required');
      
      try {
        let res = await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name })
        });
        if (res.status === 404) res = await api.updateProfile({ name });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');

        alert('Profile updated!');
        user.name = name;
        localStorage.setItem('user', JSON.stringify(user));
        document.getElementById('user-name').textContent = name;
        document.querySelector('.user-avatar').textContent = name.split(' ').map(n => n.charAt(0)).join('');

      } catch (err) { alert(err.message); }
  });

  // SETTINGS: Update Password Button
  document.getElementById('update-password-btn')?.addEventListener('click', async () => {
      const curr = document.getElementById('current-password').value;
      const newP = document.getElementById('new-password').value;
      const conf = document.getElementById('confirm-password').value;

      if(!curr || !newP || !conf) return alert('Fill all password fields');
      if(newP !== conf) return alert('Passwords do not match');
      if(newP.length < 8) return alert('Password must be 8+ characters');

      try {
          const res = await fetch(`${API_URL}/auth/password`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ currentPassword: curr, newPassword: newP })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to update');
          alert('Password Updated!');
          document.getElementById('current-password').value = '';
          document.getElementById('new-password').value = '';
          document.getElementById('confirm-password').value = '';
      } catch(e) { alert(e.message); }
  });

  // SETTINGS: Upload Picture Button
  document.getElementById('upload-picture-btn')?.addEventListener('click', async () => {
      const fileInput = document.getElementById('profile-picture-input');
      if (!fileInput?.files?.length) return alert('Select an image first');

      const btn = document.getElementById('upload-picture-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Uploading...';
      btn.disabled = true;

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
        const previewImg = document.getElementById('settings-profile-preview');
        if(previewImg) {
             const fullUrl = data.profilePicture.startsWith('http') ? data.profilePicture : `${window.location.origin}${data.profilePicture}`;
             previewImg.src = fullUrl;
        }

      } catch (err) { alert(err.message); }
      finally { btn.innerHTML = originalText; btn.disabled = false; fileInput.value = ''; }
  });

  // SETTINGS: Delete Account Button
  document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
      if (!confirm('Delete account permanently?')) return;
      try {
        await api.deleteAccount();
        localStorage.clear();
        window.location.href = 'login.html';
      } catch(e) { alert(e.message); }
  });
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if(confirm('Logout?')) { localStorage.clear(); window.location.href = 'login.html'; }
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