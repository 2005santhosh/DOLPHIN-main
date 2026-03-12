// ==========================================
// CORE INIT & HELPERS
// ==========================================
// const API_URL = "https://dolphin-main-production.up.railway.app/api";
const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const userId = user._id || user.id;
const VALIDATION_STAGES = [
  { key: 'idea', title: 'Idea Validation' },
  { key: 'problem', title: 'Problem Definition' },
  { key: 'solution', title: 'Solution Development' },
  { key: 'market', title: 'Market Validation' },
  { key: 'business', title: 'Business Model Validation' }
];

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    let icon = '';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'info') icon = 'ℹ️';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "toastSlideIn 0.3s ease reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getVerifiedBadge(state) {
  const verifiedStates = ['APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7'];
  if (verifiedStates.includes(state)) {
    return `<span class="verified-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }
  return '';
}

// INIT UI
const userNameEl = document.getElementById('user-name');
userNameEl.textContent = user.name || 'User';
const nameArray = (user.name || 'User').split(' ');
const initials = nameArray.map(n => n.charAt(0).toUpperCase()).join('');
document.querySelector('.user-avatar').textContent = initials || 'U';

if (!token) window.location.href = 'login.html';

document.getElementById('user-menu').addEventListener('click', () => {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById('settings-page').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelector('[data-page="settings"]').classList.add('active');
});

// ==========================================
// MOBILE MENU LOGIC
// ==========================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}
mobileMenuBtn?.addEventListener('click', toggleSidebar);
overlay?.addEventListener('click', toggleSidebar);

// Navigation Logic
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) toggleSidebar();
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        const page = item.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');
        
        loadPageContent(page);
    });
});

function loadPageContent(page) {
  switch(page) {
    case 'dashboard': loadDashboard(); break;
    case 'profile': loadProfile(); break;
    case 'stages': loadStages(); break;
    case 'tasks': loadRoadmapTasks(); break;
    case 'analytics': loadAnalytics(); break;
    case 'investors-providers': loadInvestorsProviders(); break;
    case 'settings': loadSettings(); break;
    case 'requests': loadFounderRequests(); loadSentRequests(); break;
    case 'chat': loadConversations(); break;
  }
}

// ==========================================
// SETTINGS: PASSWORD TOGGLE VISIBILITY
// ==========================================
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    if(isPassword) {
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
}

// ==========================================
// SETTINGS LEGAL TOGGLE
// ==========================================
window.toggleLegalSection = function(element) {
    const content = element.nextElementSibling;
    const isActive = element.classList.contains('active');
    
    document.querySelectorAll('.legal-toggle.active').forEach(el => {
        if (el !== element) {
            el.classList.remove('active');
            el.nextElementSibling.classList.remove('expanded');
        }
    });

    if (isActive) {
        element.classList.remove('active');
        content.classList.remove('expanded');
    } else {
        element.classList.add('active');
        content.classList.add('expanded');
    }
};

// ==========================================
// NOTIFICATION BELL
// ==========================================
const notifBtn = document.getElementById('notification-btn');
const notifDropdown = document.getElementById('notification-dropdown');

if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = notifDropdown.style.display === 'flex';
        notifDropdown.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) loadNotificationList();
    });
}

window.addEventListener('click', (e) => {
    if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.style.display = 'none';
    }
});

function closeNotifDropdown() { notifDropdown.style.display = 'none'; }

async function loadNotificationList() {
    const list = document.getElementById('notif-list');
    list.innerHTML = '<p style="text-align:center; padding: 1rem;">Loading...</p>';
    try {
        const data = await api.getNotifications();
        const notifications = data.notifications || [];
        if (notifications.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding: 1rem;">No notifications yet.</p>';
            return;
        }
        list.innerHTML = notifications.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick('${n._id}')">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-message">${n.message}</div>
            <div class="notif-item-time">${new Date(n.createdAt).toLocaleString()}</div>
          </div>
        `).join('');
    } catch(e) { list.innerHTML = '<p>Failed to load</p>'; }
    updateNotificationBadge(); 
}

async function handleNotifClick(notifId) {
    try {
        closeNotifDropdown();
        await fetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        updateNotificationBadge();
    } catch (err) { console.error('Error handling notification click:', err); }
}

function incrementBadge(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let count = parseInt(el.textContent.trim());
    if (isNaN(count)) count = 0;
    count++;
    el.textContent = count;
    el.style.setProperty('display', 'flex', 'important');
}

function resetBadge(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = '0';
        el.style.display = 'none';
    }
}

async function updateNotificationBadge() {
  try {
    const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const unread = (data.notifications || []).filter(n => !n.read).length;
    const badge = document.getElementById('notif-badge-count');
    if(badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
  } catch(e) { console.error("Error syncing badge", e); }
}

async function markAllRead() {
  try {
    await api.markAllRead();
    document.getElementById('notif-badge-count').style.display = 'none';
    loadNotificationList();
  } catch(e) { showToast('Error marking as read', 'error'); }
}

async function clearNotifications() {
  if(!confirm('Clear all?')) return;
  try {
    await api.clearNotifications();
    loadNotificationList();
    document.getElementById('notif-badge-count').style.display = 'none';
  } catch(e) { showToast('Error clearing', 'error'); }
}

// ==========================================
// SOCKET.IO
// ==========================================
let socket;
const SOCKET_URL = "https://dolphin-main-production.up.railway.app";
if (typeof io === 'function' && userId) {
    socket = io(SOCKET_URL,{ auth: { token: token } });
    socket.emit('join', userId);
    console.log('🔌 Founder Socket connected:', userId);

    socket.on('receiveMessage', (msg) => {
        if (!msg || !msg.senderId) return;
        const senderId = (msg.senderId._id || msg.senderId)?.toString();
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
            incrementBadge('chat-badge');
        }
    });

    socket.on('newRequest', (data) => {
        incrementBadge('requests-badge');
        incrementBadge('notif-badge-count');
    });

    socket.on('requestStatusUpdate', (data) => {
        incrementBadge('notif-badge-count');
        if(document.getElementById('requests-page').classList.contains('active')) loadSentRequests();
    });

    socket.on('newNotification', (notification) => {
        incrementBadge('notif-badge-count');
        if(document.getElementById('notification-dropdown').style.display === 'flex') loadNotificationList();
    });
}

// ==========================================
// DASHBOARD & PROFILE
// ==========================================
async function loadDashboard() {
  let startup = null;
  try {
    startup = await api.getStartup();
    const userRes = await fetch(`${API_URL}/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!userRes.ok) throw new Error("Could not fetch profile data");
    const userData = await userRes.json();
    const profile = userData.profile || userData;
    const currentPoints = profile.rewardPoints ?? 0;

    document.getElementById('header-points').textContent = currentPoints;
    document.getElementById('reward-points').textContent = currentPoints;
    
    if (profile.profilePicture) updateHeaderAvatar(profile.profilePicture);

    if (startup) {
      const validationStages = startup.validationStages || {};
      let validatedCount = 0;
      VALIDATION_STAGES.forEach(({ key }) => { if (validationStages[key]?.isValidated) validatedCount++; });

      const totalStages = VALIDATION_STAGES.length;
      const completionPercent = Math.round((validatedCount / totalStages) * 100);
      const completedAttempts = VALIDATION_STAGES.filter(({ key }) => validationStages[key]?.completedAt).length;
      const allCompleted = completedAttempts === totalStages;

      document.getElementById('startup-name-display').textContent = startup.name;
      document.getElementById('progress-text').textContent = `${completionPercent}% Complete (${validatedCount}/${totalStages} stages validated)`;
      document.getElementById('progress-badge').textContent = allCompleted ? `${startup.validationScore}% Overall` : `Overall: Pending`;
      document.getElementById('progress-fill').style.width = `${completionPercent}%`;
      document.getElementById('stages-completed').textContent = `${validatedCount}/${totalStages}`;

      const roadmapTasks = startup.roadmapTasks || [];
      const completedTasks = roadmapTasks.filter(t => t.status === 'completed').length;
      const totalTasks = roadmapTasks.length || 10;
      document.getElementById('tasks-completed').textContent = `${completedTasks}/${totalTasks}`;

      populateStagesList(startup);
    } else {
      document.getElementById('startup-name-display').textContent = 'No Startup Found';
      document.getElementById('progress-text').textContent = 'Create a startup to get started';
      populateStagesList(null);
    }
    if (startup) renderStartupData(startup);
  } catch (error) { 
     console.log("Startup fetch failed:", error.message);
     if (error.message.includes('No startup found') || error.message.includes('404')) {
         showCreateStartupForm();
     } else {
         const container = document.getElementById('startup-data-container');
         if(container) container.innerHTML = `<p style="color:red; text-align:center;">Error loading data. Please refresh.</p>`;
     }
     return; 
  }
  if (startup) {
      renderStartupData(startup);
  } else {
      showCreateStartupForm();
  }
}

function showCreateStartupForm() {
    const formContainer = document.getElementById('startup-form-container');
    const dataContainer = document.getElementById('startup-data-container');
    if (formContainer) formContainer.style.display = 'block';
    if (dataContainer) dataContainer.style.display = 'none';
}

function renderStartupData(startup) {
    if (!startup) { showCreateStartupForm(); return; }
    const formContainer = document.getElementById('startup-form-container');
    const dataContainer = document.getElementById('startup-data-container');
    if (formContainer) formContainer.style.display = 'none';
    if (dataContainer) dataContainer.style.display = 'block';
    const nameEl = document.getElementById('startup-name-display');
    if (nameEl) nameEl.textContent = startup.name || 'My Startup';
}

function updateHeaderAvatar(imageUrl) {
  const avatarEl = document.querySelector('.user-avatar');
  if (avatarEl && imageUrl) {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`;
    avatarEl.innerHTML = `<img src="${fullUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  }
}

function populateStagesList(startup) {
  const stagesList = document.getElementById('stages-list');
  stagesList.innerHTML = '';
  if (!startup) return;

  const validationStages = startup.validationStages || {};

  VALIDATION_STAGES.forEach(({ key, title }, idx) => {
    const stageElement = document.createElement('div');
    stageElement.className = 'list-item';
    const rec = validationStages[key];
    const hasCompleted = !!rec?.completedAt;
    const passed = !!rec?.isValidated;

    let locked = idx > 0;
    if (idx === 0) locked = false;
    if (idx > 0) {
      const prevKey = VALIDATION_STAGES[idx - 1].key;
      locked = !validationStages?.[prevKey]?.isValidated;
    }

    const scoreText = hasCompleted ? `${rec.score}%` : '--';
    const statusText = locked ? 'Locked' : !hasCompleted ? 'Not Started' : passed ? 'Validated' : 'Needs Improvement';
    const statusClass = locked ? 'status-pending' : !hasCompleted ? 'status-pending' : passed ? 'status-approved' : 'status-submitted';

    stageElement.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${title}</div>
        <div class="list-item-subtitle">Score: ${scoreText}</div>
      </div>
      <span class="list-item-status ${statusClass}">${statusText}</span>
    `;
    stagesList.appendChild(stageElement);
  });
}

async function loadProfile() {
  try {
    const startup = await api.getStartup();
    if (startup) {
      document.getElementById('startup-name').value = startup.name;
      document.getElementById('problem-statement').value = startup.thesis || '';
      document.getElementById('target-users').value = startup.targetUsers || '';
      document.getElementById('industry').value = startup.industry || '';
    }
  } catch (error) { console.error('Error loading profile:', error); }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const startupData = {
    name: document.getElementById('startup-name').value,
    thesis: document.getElementById('problem-statement').value,
    industry: document.getElementById('industry').value,
    targetUsers: document.getElementById('target-users').value
  };
  try {
    const existingStartup = await api.getStartup();
    if (existingStartup) { await api.updateStartup(startupData); showToast('Profile updated successfully!', 'success'); } 
    else { await api.createStartup(startupData); showToast('Startup created successfully!', 'success'); }
    loadDashboard(); loadProfile();
  } catch (error) { showToast(`Failed to save profile: ${error.message}`, 'error'); }
});

// ==========================================
// STAGES VALIDATION LOGIC
// ==========================================
async function loadStages() {
  try {
    const startup = await api.getStartup();
    const msg = document.getElementById('validation-roadmap-message');

    if (!startup) {
      if (msg) { msg.style.display = 'block'; msg.textContent = 'Create a startup first to access validation stages.'; }
      document.getElementById('overall-validation-summary').style.display = 'none';
      VALIDATION_STAGES.forEach(({ key }) => {
         const statusEl = document.getElementById(`stage-status-${key}`);
         if(statusEl) { statusEl.textContent = 'Create Startup'; statusEl.className = 'list-item-status status-pending'; }
         const startBtn = document.getElementById(`stage-start-${key}`);
         if(startBtn) { startBtn.disabled = true; startBtn.textContent = 'Locked'; }
      });
      return;
    }
    if (msg) msg.style.display = 'none';
    renderValidationRoadmap(startup);
  } catch (error) { console.error('Error loading stages:', error); }
}

function renderValidationRoadmap(startup) {
  const validationStages = startup.validationStages || {};
  const currentStage = startup.currentStage || 1;

  const summaryCard = document.getElementById('overall-validation-summary');
  const summaryText = document.getElementById('overall-validation-summary-text');
  if (summaryCard && summaryText) {
    const completedCount = VALIDATION_STAGES.map(s => validationStages?.[s.key]).filter(v => v && v.completedAt).length;
    const allCompleted = completedCount === VALIDATION_STAGES.length;
    summaryCard.style.display = 'block';
    summaryText.textContent = allCompleted ? `${startup.validationScore}% (final score)` : `Pending (${completedCount}/${VALIDATION_STAGES.length} stages)`;
  }

  VALIDATION_STAGES.forEach(({ key, title }, idx) => {
    const order = idx + 1;
    const statusEl = document.getElementById(`stage-status-${key}`);
    const startBtn = document.getElementById(`stage-start-${key}`);
    const resultsBtn = document.getElementById(`stage-results-${key}`);

    const rec = validationStages[key];
    const hasCompleted = !!rec?.completedAt;
    const passed = !!rec?.isValidated;
    let locked = order > currentStage;
    if (order > 1) {
      const prevKey = VALIDATION_STAGES[order - 2].key;
      const prev = validationStages[prevKey];
      if (!prev?.isValidated) locked = true;
    }

    if (startBtn) startBtn.disabled = locked;

    if (!hasCompleted) {
      if(statusEl) { statusEl.textContent = locked ? 'Locked' : 'Not Started'; statusEl.className = 'list-item-status status-pending'; }
      if(resultsBtn) resultsBtn.style.display = 'none';
      if(startBtn) startBtn.textContent = locked ? 'Locked' : 'Start';
    } else {
      if(statusEl) { statusEl.textContent = passed ? '✓ Validated' : 'Needs Improvement'; statusEl.className = passed ? 'list-item-status status-approved' : 'list-item-status status-submitted'; }
      if(resultsBtn) resultsBtn.style.display = 'block';
      if(startBtn) startBtn.textContent = 'Retake';
    }
  });
}

async function openStageValidationModal(stageKey) {
  const modal = document.getElementById('idea-validation-modal');
  const container = document.getElementById('validation-questions-container');
  modal.dataset.stageKey = stageKey;
  document.getElementById('stage-validation-modal-title').textContent = `Validate: ${VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey}`;

  try {
    const response = await fetch(`${API_URL}/founder/validate-stage/${stageKey}/questions`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await response.json();
    if (!data.success) { showToast(data.message || 'Failed to load questions', 'error'); return; }

    const questions = data.questions || [];
    container.innerHTML = '';

    questions.forEach((q) => {
      const questionDiv = document.createElement('div');
      questionDiv.style.marginBottom = '2rem';
      questionDiv.innerHTML = `
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
          <label class="form-label" style="margin-bottom: 0.5rem;"><strong>Q${q.id}:</strong> ${q.question}</label>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem;">💡 ${q.hint}</p>
          <textarea class="form-textarea validation-answer" data-question-id="${q.id}" data-category="${q.category}" data-weight="${q.weight}" placeholder="Your answer..." style="margin-bottom: 0; min-height: 100px;"></textarea>
        </div>
      `;
      container.appendChild(questionDiv);
    });

    document.getElementById('idea-validation-form').onsubmit = submitStageValidation;
    document.getElementById('validation-loading').style.display = 'none';
    document.getElementById('idea-validation-form').style.display = 'block';
    modal.classList.add('active');
  } catch (error) { showToast('Failed to load validation questions', 'error'); }
}

async function submitStageValidation(e) {
  e.preventDefault();
  const modal = document.getElementById('idea-validation-modal');
  const stageKey = modal.dataset.stageKey;
  const formEl = document.getElementById('idea-validation-form');
  const loadingEl = document.getElementById('validation-loading');

  const answers = [];
  const answerElements = document.querySelectorAll('.validation-answer');
  for (let elem of answerElements) { if (elem.value.trim() === '') { showToast('Please answer all questions', 'error'); return; } }
  answerElements.forEach(elem => {
    answers.push({ id: parseInt(elem.dataset.questionId), answer: elem.value.trim(), category: elem.dataset.category });
  });

  formEl.style.display = 'none';
  loadingEl.style.display = 'block';

  try {
    const response = await fetch(`${API_URL}/founder/validate-stage/${stageKey}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    const result = await response.json();
    formEl.style.display = 'block';
    loadingEl.style.display = 'none';

    if (result.success) {
      closeIdeaValidationModal();
      showToast(result.isValidated ? `✓ Stage Validated (${result.validationScore}%)` : `Stage Score: ${result.validationScore}% (need 70%)`, result.isValidated ? 'success' : 'info');
      loadStages(); loadDashboard();
    } else { showToast(`Error: ${result.message || 'Validation failed'}`, 'error'); }
  } catch (error) { formEl.style.display = 'block'; loadingEl.style.display = 'none'; showToast('Failed to submit validation', 'error'); }
}

function closeIdeaValidationModal() { document.getElementById('idea-validation-modal').classList.remove('active'); }

async function showStageValidationResults(stageKey) {
  try {
    const startup = await api.getStartup();
    const rec = startup?.validationStages?.[stageKey];
    if (!rec || !rec.completedAt) { showToast('No results yet.', 'info'); return; }
    const stageTitle = VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey;
    
    let scoreColor = '#ef4444'; let statusText = 'Needs Improvement';
    if (rec.score >= 70) { scoreColor = '#10b981'; statusText = 'Validated'; }
    else if (rec.score >= 50) { scoreColor = '#f59e0b'; statusText = 'Almost There'; }

    let answersHtml = (rec.answers || []).map((a, idx) => `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span style="font-weight: 600; color: #374151;">Question ${idx + 1}</span>
            <span style="font-weight: 700; color: ${a.score >= 7 ? '#10b981' : '#ef4444'};">${a.score}/10</span>
          </div>
          <p style="font-size: 0.9rem; color: #4b5563; margin: 0; line-height: 1.5;">${(a.answer || '').substring(0, 150)}...</p>
        </div>
      `).join('');

    const contentHtml = `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="font-size: 3.5rem; font-weight: 800; color: ${scoreColor}; line-height: 1;">${rec.score}%</div>
        <div style="display: inline-block; margin-top: 0.5rem; padding: 4px 12px; background: ${scoreColor}20; color: ${scoreColor}; border-radius: 9999px; font-weight: 600; font-size: 0.9rem;">${statusText}</div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
        <h4 style="margin-bottom: 1rem; font-size: 1rem; color: #111827;">Answer Breakdown</h4>
        ${answersHtml || '<p style="color: #6b7280;">No detailed answers recorded.</p>'}
      </div>
    `;

    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-title').textContent = stageTitle;
    document.getElementById('detail-modal-body').innerHTML = contentHtml;
    modal.classList.add('active');
    modal.style.display = 'flex';

  } catch (error) { showToast('Failed to load results', 'error'); }
}

// ==========================================
// TASKS & RESOURCES
// ==========================================
async function loadRoadmapTasks() {
    const container = document.getElementById('tasks-container');
    const lockedMsg = document.getElementById('tasks-locked-message');
    container.innerHTML = '<p style="text-align:center;">Loading...</p>';
    try {
        const res = await api.getRoadmap();
        if (!res.unlocked) { lockedMsg.style.display = 'block'; container.innerHTML = ''; return; }
        lockedMsg.style.display = 'none';
        if (!res.tasks || res.tasks.length === 0) { container.innerHTML = '<p>No tasks available.</p>'; return; }

        container.innerHTML = res.tasks.map(task => {
            let statusClass = task.status;
            let btnHtml = '';
            if (statusClass === 'locked') btnHtml = `<span style="color:#9ca3af; font-weight:600;">🔒 Locked</span>`;
            else if (statusClass === 'completed') btnHtml = `<span style="color:#10b981; font-weight:600;">✓ Done +${task.points} Pts</span>`;
            else btnHtml = `<button class="btn btn-primary btn-sm" onclick="completeTask('${task.key}')">Mark Complete</button>`;

            return `
            <div class="roadmap-item ${statusClass}">
                <div style="flex:1;">
                    <div style="font-size:0.8rem; color:#6b7280; text-transform:uppercase; margin-bottom:0.25rem;">${task.phase}</div>
                    <h4>${task.title}</h4>
                    <p style="font-size:0.9rem; color:var(--text-secondary);">${task.description}</p>
                </div>
                <div style="min-width: 120px; text-align: right;">${btnHtml}</div>
            </div>`;
        }).join('');
    } catch (err) { container.innerHTML = '<p style="color:red;">Failed to load tasks.</p>'; }
}

async function completeTask(taskKey) {
    if (!confirm('Mark this task as complete?')) return;
    try {
        const res = await api.completeRoadmapTask(taskKey);
        showToast(res.message, 'success');
        document.getElementById('header-points').textContent = res.totalPoints;
        document.getElementById('reward-points').textContent = res.totalPoints;
        loadRoadmapTasks(); loadDashboard();
    } catch (err) { showToast(err.message || 'Failed to complete task', 'error'); }
}

// ==========================================
// ANALYTICS
// ==========================================
async function loadAnalytics() {
  const grid = document.getElementById('analytics-grid');
  grid.innerHTML = '<p style="text-align: center;">Loading...</p>';
  try {
    const result = await api.getAnalytics();
    const data = result.analytics;
    const tasksData = data.growthTasks || { completed: 0, total: 0, pending: 0 };
    const stageData = data.stagePerformance || { labels: [], scores: [] };

    grid.innerHTML = `
      <div class="grid" style="grid-column: 1 / -1;">
        <div class="stat-card"><div class="stat-value">${data.validationScore || 0}%</div><div class="stat-label">Overall Score</div></div>
        <div class="stat-card"><div class="stat-value">${data.overallProgress || 0}%</div><div class="stat-label">Journey Progress</div></div>
        <div class="stat-card"><div class="stat-value">${tasksData.completed}/${tasksData.total}</div><div class="stat-label">Growth Tasks</div></div>
      </div>
      <div class="card"><h3>Stage Performance</h3><div class="chart-container"><canvas id="stagePerformanceChart"></canvas></div></div>
      <div class="card"><h3>Task Completion</h3><div class="chart-container"><canvas id="taskCompletionChart"></canvas></div></div>
    `;
    setTimeout(() => { initCharts(stageData, tasksData); }, 200);
  } catch(e) { grid.innerHTML = '<p style="text-align: center; color: var(--error);">Failed to load analytics.</p>'; }
}

function initCharts(perf, tasks) {
  const ctx1 = document.getElementById('stagePerformanceChart');
  if(ctx1) new Chart(ctx1, { type: 'radar', data: { labels: perf.labels, datasets: [{ label: 'Score', data: perf.scores, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100 } } } });
  const ctx2 = document.getElementById('taskCompletionChart');
  if(ctx2) new Chart(ctx2, { type: 'doughnut', data: { labels: ['Completed', 'Pending'], datasets: [{ data: [tasks.completed, tasks.pending], backgroundColor: ['#10b981', '#e5e7eb'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

// ==========================================
// INVESTORS & PROVIDERS
// ==========================================
async function loadInvestorsProviders() {
  const gateEl = document.getElementById('investors-providers-gate-message');
  const contentEl = document.getElementById('investors-providers-content');
  try {
    const startup = await api.getStartup();
    if ((startup?.validationScore ?? 0) < 70) { gateEl.style.display = 'block'; contentEl.style.display = 'none'; return; }
    contentEl.style.display = 'block';
    const investors = await api.request('/founder/investors');
    const providers = await api.request('/founder/providers');
    
    contentEl.innerHTML = `
       <div class="card"><div class="card-header"><h3 class="card-title">Investors</h3></div><div class="profile-grid">${investors.map(inv => `<div class="profile-card" onclick="openDetailModal('investor', '${inv._id}')"><div class="profile-card-image"><img src="${inv.profilePicture || `https://ui-avatars.com/api/?name=${inv.name}`}"></div><div class="profile-card-body"><div><h4>${inv.name} ${getVerifiedBadge(inv.state)}</h4><p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${(inv.interestAreas || []).slice(0, 2).join(', ') || 'General'}</p></div></div></div>`).join('')}</div></div>
       <div class="card" style="margin-top:1.5rem;"><div class="card-header"><h3 class="card-title">Providers</h3></div><div class="profile-grid">${providers.map(prov => `<div class="profile-card" onclick="openDetailModal('provider', '${prov._id}')"><div class="profile-card-image"><img src="${prov.profilePicture || `https://ui-avatars.com/api/?name=${prov.name}`}"></div><div class="profile-card-body"><div><h4>${prov.name} ${getVerifiedBadge(prov.state)}</h4><p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${prov.category || 'Provider'}</p></div></div></div>`).join('')}</div></div>
    `;
  } catch(e) { console.error(e); }
}

async function loadInvestors() {
  const list = document.getElementById('founder-investors-list');
  list.innerHTML = '<p style="text-align:center;">Loading...</p>';
  const search = document.getElementById('investor-search').value;
  try {
    let endpoint = `/founder/investors?`; if(search) endpoint += `search=${encodeURIComponent(search)}&`;
    const investors = await api.request(endpoint);
    renderInvestorList(investors);
  } catch(e) { list.innerHTML = '<p style="color:red; text-align:center;">Failed to load</p>'; }
}

async function loadProviders() {
  const list = document.getElementById('founder-providers-list');
  list.innerHTML = '<p style="text-align:center;">Loading...</p>';
  const search = document.getElementById('provider-search').value;
  const category = document.getElementById('provider-category').value;
  try {
    let endpoint = `/founder/providers?`; if(search) endpoint += `search=${encodeURIComponent(search)}&`; if(category && category !== 'all') endpoint += `category=${encodeURIComponent(category)}`;
    const providers = await api.request(endpoint);
    renderProviderList(providers);
  } catch(e) { list.innerHTML = '<p style="color:red; text-align:center;">Failed to load</p>'; }
}

document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
  const name = document.getElementById('settings-full-name').value.trim();
  if (!name) return showToast('Name cannot be empty', 'error');
  try {
    const res = await fetch(`${API_URL}/auth/profile`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ name }) 
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    showToast('Profile updated successfully!', 'success');

    const updatedUser = { ...user, name: data.user.name };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    document.getElementById('user-name').textContent = data.user.name;
    document.querySelector('.user-avatar').textContent = data.user.name.split(' ').map(n => n[0]).join('');

  } catch (err) { showToast(err.message, 'error'); }
});

function renderInvestorList(investors) {
  const list = document.getElementById('founder-investors-list');
  list.innerHTML = '';
  if (!investors || investors.length === 0) { list.innerHTML = '<p style="text-align:center;">No investors found.</p>'; return; }
  list.innerHTML = `<div class="profile-grid">${investors.map(inv => {
      const imgUrl = inv.profilePicture ? (inv.profilePicture.startsWith('http') ? inv.profilePicture : `${window.location.origin}${inv.profilePicture}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(inv.name || 'User')}&background=6366f1&color=fff&size=128`;
      return `<div class="profile-card" onclick="openDetailModal('investor', '${inv._id}')">
        <div class="profile-card-image"><img src="${imgUrl}" alt="${inv.name}"></div>
        <div class="profile-card-body"><div><h4>${inv.name || 'Unknown'} ${getVerifiedBadge(inv.state)}</h4><p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Investor</p></div></div>
      </div>`;
  }).join('')}</div>`;
}

function renderProviderList(providers) {
  const list = document.getElementById('founder-providers-list');
  list.innerHTML = '';
  if (!providers || providers.length === 0) { list.innerHTML = '<p style="text-align:center;">No providers found.</p>'; return; }
  list.innerHTML = `<div class="profile-grid">${providers.map(prov => {
      const imgUrl = prov.profilePicture ? (prov.profilePicture.startsWith('http') ? prov.profilePicture : `${window.location.origin}${prov.profilePicture}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(prov.name || 'Service')}&background=10b981&color=fff&size=128`;
      let actionBtn = '';
      const status = prov.requestStatus;
      if (status === 'accepted') actionBtn = `<button class="btn btn-success btn-sm" disabled>Connected</button>`;
      else if (status === 'pending') actionBtn = `<button class="btn btn-secondary btn-sm" disabled>Pending</button>`;
      else actionBtn = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); sendFounderRequest('${prov.userId}', '${prov.name}')">Request</button>`;
      
      return `<div class="profile-card" onclick="openDetailModal('provider', '${prov._id}')">
        <div class="profile-card-image"><img src="${imgUrl}" alt="${prov.name}"></div>
        <div class="profile-card-body"><div><h4>${prov.name || 'Unknown'} ${getVerifiedBadge(prov.state)}</h4><p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">${prov.category || 'Provider'}</p></div>${actionBtn}</div>
      </div>`;
  }).join('')}</div>`;
}

window.searchInvestors = loadInvestors;
window.searchProviders = loadProviders;
document.getElementById('investor-search')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') loadInvestors(); });
document.getElementById('provider-search')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') loadProviders(); });

let currentRequestId = null;
window.sendFounderRequest = function(providerId, providerName) {
    currentRequestId = providerId;
    document.getElementById('founder-request-message').value = '';
    document.getElementById('founder-request-modal-title').textContent = `Connect with ${providerName}`;
    document.getElementById('founder-request-modal').classList.add('active');
}

document.getElementById('submit-founder-request')?.addEventListener('click', async () => {
    const message = document.getElementById('founder-request-message').value.trim();
    if (!message) return showToast('Please enter a message.', 'error');
    const btn = document.getElementById('submit-founder-request');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
        const res = await fetch(`${API_URL}/founder/send-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ providerId: currentRequestId, message })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showToast('✅ ' + data.message, 'success');
        document.getElementById('founder-request-modal').classList.remove('active');
        loadInvestors(); loadProviders(); loadSentRequests();
    } catch(e) { showToast('❌ ' + e.message, 'error'); btn.disabled = false; btn.textContent = 'Send Request'; }
});

// ==========================================
// DETAIL MODAL & RATING
// ==========================================
window.navigateToChat = function(partnerId, partnerName, partnerPic) {
    closeDetailModal(); 

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('chat-page').classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelector('[data-page="chat"]').classList.add('active');
    
    openChat(partnerId?.toString(), partnerName, partnerPic);
};

async function openDetailModal(type, id) {
  const modal = document.getElementById('detail-modal');
  const title = document.getElementById('detail-modal-title');
  const body = document.getElementById('detail-modal-body');
  title.textContent = type === 'investor' ? 'Investor Profile' : 'Provider Profile';
  body.innerHTML = '<p>Loading...</p>';
  modal.classList.add('active');
  modal.style.display = 'flex';
  
  try {
    const data = type === 'investor' ? await api.getFounderInvestorDetail(id) : await api.getFounderProviderDetail(id);
    const isVerified = data.state === 'APPROVED';
    const verifiedHtml = isVerified ? '<span class="verified-badge"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>' : '';
    const imgUrl = data.profilePicture ? (data.profilePicture.startsWith('http') ? data.profilePicture : `${window.location.origin}${data.profilePicture}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'User')}&background=${type === 'investor' ? '6366f1' : '10b981'}&color=fff`;

    let detailsHtml = `<div style="margin-bottom: 8px; color: #555; line-height: 1.5;">${data.description || data.bio || 'No description provided.'}</div>`;
    detailsHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 1rem 0; padding: 1rem; background: #f9fafb; border-radius: 8px; font-size: 0.9rem;">`;
    
    if (type === 'investor') {
        detailsHtml += `
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Interest Areas</strong>${(data.interestAreas || []).join(', ') || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Stage Preference</strong>${(data.stagePreference || []).join(', ') || 'Any'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Rating</strong><span id="rating-display-value">⭐ ${data.rating || '0.0'}</span></div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Joined</strong>${data.joinedAt ? new Date(data.joinedAt).toLocaleDateString() : 'N/A'}</div>
        `;
    } else {
        detailsHtml += `
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Category</strong>${data.category || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Experience</strong>${data.experienceLevel || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Specialties</strong>${(data.specialties || []).join(', ') || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Availability</strong>${data.availability || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Contact Method</strong>${data.contactMethod || 'N/A'}</div>
          <div><strong style="font-size:0.8rem; color:#888; display:block; margin-bottom:4px;">Rating</strong><span id="rating-display-value">⭐ ${data.rating || '0.0'}</span></div>
        `;
    }
    detailsHtml += `</div>`;

    const requestTargetId = type === 'investor' ? id : data.userId;
    let actionBtnHtml = '';
    const status = data.requestStatus;

    if (status === 'accepted') actionBtnHtml = `<button class="btn btn-success" style="width: 100%;" onclick="navigateToChat('${data.userId}', '${data.name}', '${data.profilePicture || ''}')">Chat Now</button>`;
    else if (status === 'pending') actionBtnHtml = `<button class="btn btn-secondary" style="width: 100%;" disabled>Request Pending</button>`;
    else actionBtnHtml = `<button class="btn btn-primary" style="width: 100%;" onclick="sendFounderRequest('${requestTargetId}', '${data.name}')">Connect</button>`;

    const ratingSectionHtml = `
      <div style="margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
        <h4 style="font-size: 1rem; margin-bottom: 1rem; text-align: center;">Leave a Review</h4>
        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 1rem;" id="star-container">
          <span class="star" data-value="1" style="font-size: 2rem; cursor: pointer; color: #d1d5db;">★</span>
          <span class="star" data-value="2" style="font-size: 2rem; cursor: pointer; color: #d1d5db;">★</span>
          <span class="star" data-value="3" style="font-size: 2rem; cursor: pointer; color: #d1d5db;">★</span>
          <span class="star" data-value="4" style="font-size: 2rem; cursor: pointer; color: #d1d5db;">★</span>
          <span class="star" data-value="5" style="font-size: 2rem; cursor: pointer; color: #d1d5db;">★</span>
        </div>
        <textarea id="rating-comment" class="form-textarea" rows="2" placeholder="Write your feedback (optional)..."></textarea>
        <button class="btn btn-secondary" style="width: 100%; margin-top: 0.5rem;" onclick="submitRating('${requestTargetId}')">Submit Rating</button>
      </div>
    `;

    body.innerHTML = `
      <div style="text-align:center; margin-bottom: 1.5rem;">
        <img src="${imgUrl}" style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--border-color);">
        <h2 style="margin: 0.5rem 0 0.25rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">${data.name} ${verifiedHtml}</h2>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">${type === 'investor' ? 'Investor' : 'Service Provider'}</div>
      </div>
      ${detailsHtml}
      <div style="margin-top: 1.5rem;">${actionBtnHtml}</div>
      ${ratingSectionHtml}
    `;

    setupStarListeners();

  } catch (err) { body.innerHTML = '<p style="color: var(--error);">Failed to load details.</p>'; }
}

let selectedRating = 0;
function setupStarListeners() {
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = this.dataset.value;
      updateStarDisplay(selectedRating);
    });
    star.addEventListener('mouseover', function() {
      updateStarDisplay(this.dataset.value);
    });
    star.addEventListener('mouseout', function() {
      updateStarDisplay(selectedRating);
    });
  });
}

function updateStarDisplay(rating) {
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    star.style.color = star.dataset.value <= rating ? '#fbbf24' : '#d1d5db'; 
  });
}

async function submitRating(targetUserId) {
  const comment = document.getElementById('rating-comment').value.trim();
  if (!selectedRating) return showToast('Please select a star rating.', 'error');
  try {
    const res = await fetch(`${API_URL}/founder/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ targetUserId, score: parseInt(selectedRating), comment })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Rating submitted successfully!', 'success');
    const ratingEl = document.getElementById('rating-display-value');
    if(ratingEl) ratingEl.textContent = `⭐ ${data.averageRating || selectedRating}.0`;
  } catch (err) { showToast(err.message, 'error'); }
}

function closeDetailModal() { const modal = document.getElementById('detail-modal'); if(modal) { modal.classList.remove('active'); modal.style.display = 'none'; selectedRating = 0; } }
window.closeDetailModal = closeDetailModal;

async function loadFounderRequests() {
    const list = document.getElementById('founder-requests-list');
    list.innerHTML = '<p style="text-align:center;">Loading...</p>';
    try {
        const res = await fetch(`${API_URL}/founder/requests`, { headers: { 'Authorization': `Bearer ${token}` } });
        const reqs = await res.json();
        list.innerHTML = '';
        if (!reqs || reqs.length === 0) {
            list.innerHTML = '<p style="padding:2rem; text-align:center;">No requests yet.</p>';
            document.getElementById('requests-badge').style.display = 'none';
            return;
        }

        reqs.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const provider = r.providerId || {};
            const providerId = (provider._id || provider)?._id || provider._id || provider;
            const providerIdStr = providerId?.toString();
            const providerName = provider.name || 'Provider';
            const providerPic = provider.profilePicture ? (provider.profilePicture.startsWith('http') ? provider.profilePicture : `${window.location.origin}${provider.profilePicture}`) : null;
            
            let avatarHtml = providerPic ? `<img src="${providerPic}" class="chat-avatar" alt="${providerName}">` : `<div class="chat-avatar">${providerName.charAt(0)}</div>`;
            let actions = '';
            let statusBadge = '';
            
            if (r.status === 'pending') {
                actions = `<button class="btn btn-success btn-sm" onclick="handleRequest('${r._id}', 'accepted')">Accept</button><button class="btn btn-danger btn-sm" onclick="handleRequest('${r._id}', 'rejected')">Reject</button>`;
                statusBadge = '<span style="color:orange; font-weight:bold;">Pending</span>';
            } else if (r.status === 'accepted') {
                actions = `<button class="btn btn-primary btn-sm" onclick="navigateToChat('${providerIdStr}', '${providerName}', '${providerPic || ''}')">Chat</button>`;
                statusBadge = '<span style="color:green; font-weight:bold;">Accepted</span>';
            } else {
                statusBadge = '<span style="color:red; font-weight:bold;">Rejected</span>';
            }

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">${avatarHtml}<div class="list-item-content"><div class="list-item-title">${providerName}</div><div class="list-item-subtitle">${r.message || 'Wants to connect'}</div></div></div>
                <div style="display:flex; align-items:center; gap:10px;">${statusBadge}${actions}</div>
            `;
            list.appendChild(div);
        });
        updateRequestsBadge(reqs);
    } catch(e) { console.error(e); }
}

async function loadSentRequests() {
    const list = document.getElementById('founder-sent-requests-list');
    list.innerHTML = '<p style="text-align:center;">Loading...</p>';
    try {
        const res = await fetch(`${API_URL}/founder/requests/sent`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!res.ok) throw new Error(`Server Error: ${res.status}`);
        const reqs = await res.json();
        list.innerHTML = '';
        if (!reqs || reqs.length === 0) {
            list.innerHTML = '<p style="text-align:center;">No sent requests yet.</p>';
            return;
        }
        
        reqs.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const provider = r.providerId || {};
            const providerId = (provider._id || provider)?._id || provider._id || provider;
            const providerIdStr = providerId?.toString();
            const providerName = provider.name || 'Provider';
            const providerPic = provider.profilePicture ? (provider.profilePicture.startsWith('http') ? provider.profilePicture : `${window.location.origin}${provider.profilePicture}`) : null;
            
            let statusBadge = r.status === 'pending' ? '<span style="color:orange; font-weight:bold;">Pending</span>' : 
                              r.status === 'accepted' ? '<span style="color:green; font-weight:bold;">Accepted</span>' : 
                              '<span style="color:red; font-weight:bold;">Rejected</span>';
            
            let chatBtn = '';
            if (r.status === 'accepted') {
                chatBtn = `<button class="btn btn-primary btn-sm" style="margin-left:10px;" onclick="navigateToChat('${providerIdStr}', '${providerName}', '${providerPic || ''}')">Chat</button>`;
            }

            div.innerHTML = `
                <div class="list-item-content"><div class="list-item-title">${providerName}</div><div class="list-item-subtitle">${new Date(r.createdAt).toLocaleDateString()}</div></div>
                <div>${statusBadge}${chatBtn}</div>
            `;
            list.appendChild(div);
        });
    } catch(e) {
        console.error(e);
        list.innerHTML = '<p style="color:red;">Failed to load.</p>';
    }
}

async function handleRequest(id, status) {
  try {
    const res = await fetch(`${API_URL}/founder/requests/${id}/${status === 'accepted' ? 'accept' : 'reject'}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error("Failed");
    showToast(`Request ${status}`, 'success');
    loadFounderRequests();
  } catch(e) { showToast('Failed to update request: ' + e.message, 'error'); }
}

function updateRequestsBadge(requests) {
    const badge = document.getElementById('requests-badge');
    if (!badge) return;
    const pendingCount = (requests || []).filter(r => r.status === 'pending').length;
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'flex' : 'none';
}

// ==========================================
// CHAT UI LOGIC (UPDATED)
// ==========================================
let currentChatPartnerId = null;
let allConversations = []; 

window.openChat = async function(partnerId, partnerName, partnerPic) {
    currentChatPartnerId = partnerId?.toString();
    resetBadge('chat-badge');

    const chatWindow = document.getElementById('chat-window');
    const chatList = document.getElementById('conversations-list');
    const chatHeader = document.getElementById('chat-header');
    const chatInputArea = document.getElementById('chat-input-area');
    
    let headerAvatarHtml = partnerPic ? `<img src="${partnerPic}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : partnerName.charAt(0);
    chatHeader.innerHTML = `<div class="chat-avatar">${headerAvatarHtml}</div> <span style="color:white; font-weight:600;">${partnerName}</span>`;
    
    if (window.innerWidth <= 768) {
        chatList.style.display = 'none';
        chatWindow.classList.add('active'); 
        chatWindow.style.display = 'flex';
        
        let backBtn = document.getElementById('chat-back-btn');
        if (!backBtn) {
            backBtn = document.createElement('button'); 
            backBtn.id = 'chat-back-btn'; 
            backBtn.className = 'chat-back-btn';
            backBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
            backBtn.onclick = () => { 
                chatWindow.classList.remove('active'); 
                chatWindow.style.display = 'none'; 
                chatList.style.display = 'flex'; 
            };
            chatHeader.prepend(backBtn);
        }
    } else {
        chatHeader.style.display = 'flex';
    }

    chatInputArea.style.display = 'flex';

    try {
        const msgs = await chatApiCall(`/${partnerId}`);
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        
        if(msgs.length === 0) { 
            container.innerHTML = '<p style="text-align:center; margin-top:2rem; color:#888;">No messages yet. Say Hi!</p>'; 
        } else {
            msgs.forEach(m => {
                const senderId = (m.senderId?._id || m.senderId)?.toString();
                const isSent = senderId === userId;
                const div = document.createElement('div');
                div.className = `message-row ${isSent ? 'sent' : 'received'}`;
                const time = new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                div.innerHTML = `<div class="message-bubble">${m.content}<div class="message-time">${time}</div></div>`;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) { 
        console.error(e); 
        showToast('Failed to load messages', 'error'); 
    }
}

async function loadConversations() {
    const listContainer = document.getElementById('conversations-container');
    const searchInput = document.getElementById('chat-search-input');
    
    if (searchInput && !searchInput.dataset.listenerAdded) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value);
        });
        searchInput.dataset.listenerAdded = 'true';
    }

    listContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading...</p>';
    
    try {
        const convs = await chatApiCall('/conversations');
        allConversations = convs || []; 
        renderConversationList(allConversations);

    } catch(e) { 
        console.error(e);
        listContainer.innerHTML = `
          <div class="chat-error-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>Failed to load chats.</p>
            <button class="btn btn-secondary btn-sm" onclick="loadConversations()">Retry</button>
          </div>`;
    }
}

function filterConversations(searchTerm) {
    const term = searchTerm.toLowerCase();
    const filtered = allConversations.filter(c => 
        (c.name || '').toLowerCase().includes(term) || 
        (c.lastMessage || '').toLowerCase().includes(term)
    );
    renderConversationList(filtered);
}

function renderConversationList(convs) {
    const listContainer = document.getElementById('conversations-container');
    listContainer.innerHTML = '';

    if (!convs || convs.length === 0) { 
        listContainer.innerHTML = '<p style="padding:1rem; text-align:center; color:#666;">No conversations found.</p>'; 
        return; 
    }

    convs.forEach(c => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        const partnerName = c.name || 'Unknown User';
        
        let avatarHtml = c.profilePicture 
            ? `<img src="${c.profilePicture.startsWith('http') ? c.profilePicture : window.location.origin + c.profilePicture}" class="chat-avatar" alt="${partnerName}">` 
            : `<div class="chat-avatar">${partnerName.charAt(0)}</div>`;
        
        div.innerHTML = `${avatarHtml}<div class="chat-info"><div class="chat-name">${partnerName}</div><div class="chat-preview">${c.lastMessage || 'Start chatting...'}</div></div>`;
        
        // Pass Partner ID
        div.onclick = () => openChat(c._id, partnerName, c.profilePicture);
        
        listContainer.appendChild(div);
    });
}

window.sendMessage = async function() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content || !currentChatPartnerId) return;
    const container = document.getElementById('messages-container');
    const emptyMsg = container.querySelector('p');
    if(emptyMsg) emptyMsg.remove();
    const div = document.createElement('div');
    div.className = 'message-row sent';
    div.innerHTML = `<div class="message-bubble">${content}<div class="message-time" style="text-align: right;">Just now</div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    input.value = '';
    try { await chatApiCall('/send', 'POST', { receiverId: currentChatPartnerId, content }); } catch(e) { showToast('Failed to send message', 'error'); }
};

async function chatApiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  const response = await fetch(`${API_URL}/chat${endpoint}`, config);
  
  // Try to parse error message from backend
  if (!response.ok) {
      let errorMsg = `Server Error: ${response.status}`;
      try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
      } catch(e) {
          // Could not parse JSON
      }
      throw new Error(errorMsg);
  }
  
  return response.json();
}

// ==========================================
// SETTINGS LOADERS
// ==========================================
function loadSettings() {
  document.getElementById('settings-full-name').value = user.name || '';
  document.getElementById('settings-email').value = user.email || '';
  
  fetch(`${API_URL}/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => {
       const profile = data.profile || data;
       document.getElementById('header-points').textContent = profile.rewardPoints || 0;
       const previewImg = document.getElementById('settings-profile-preview');
       if (previewImg) {
         if (profile.profilePicture) {
           const imageUrl = profile.profilePicture.startsWith('http') ? profile.profilePicture : `${window.location.origin}${profile.profilePicture}`;
           previewImg.src = imageUrl;
           updateHeaderAvatar(imageUrl);
         } else {
           previewImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&background=e2e8f0&color=64748b&size=100`;
         }
       }
    }).catch(err => console.error(err));
}

// Profile Update button listener
document.getElementById('update-profile-btn')?.addEventListener('click', async () => {
  const name = document.getElementById('settings-full-name').value.trim();
  if (!name) return showToast('Name cannot be empty', 'error');
  try {
    const res = await fetch(`${API_URL}/auth/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast('Profile updated successfully!', 'success');
    document.getElementById('user-name').textContent = data.user.name;
    document.querySelector('.user-avatar').textContent = data.user.name.split(' ').map(n => n[0]).join('');
  } catch (err) { showToast(err.message, 'error'); }
});

// ==========================================
// SETTINGS: PROFILE PICTURE UPLOAD
// ==========================================
const uploadPicBtn = document.getElementById('upload-picture-btn');
const fileInput = document.getElementById('profile-picture-input');

if (uploadPicBtn && fileInput) {
    uploadPicBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) return showToast('Please select a JPG or PNG image.', 'error');
        if (file.size > 5 * 1024 * 1024) return showToast('File size exceeds 5MB limit.', 'error');

        const formData = new FormData();
        formData.append('profilePicture', file);

        const originalText = uploadPicBtn.textContent;
        uploadPicBtn.textContent = 'Uploading...';
        uploadPicBtn.disabled = true;

        try {
            const res = await fetch(`${API_URL}/auth/upload-profile-picture`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Failed to upload image');

            const newImageUrl = data.profilePicture;
            const fullUrl = newImageUrl.startsWith('http') ? newImageUrl : `${window.location.origin}${newImageUrl}`;

            const previewEl = document.getElementById('settings-profile-preview');
            if (previewEl) previewEl.src = fullUrl;

            updateHeaderAvatar(fullUrl);

            const updatedUser = { ...user, profilePicture: newImageUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            showToast('✅ Profile picture updated successfully!', 'success');

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            uploadPicBtn.textContent = originalText;
            uploadPicBtn.disabled = false;
            fileInput.value = '';
        }
    });
}

document.getElementById('update-password-btn')?.addEventListener('click', async () => {
    const curr = document.getElementById('current-password').value;
    const newP = document.getElementById('new-password').value;
    const conf = document.getElementById('confirm-password').value;
    if(!curr || !newP || !conf) return showToast('Fill all password fields', 'error');
    if(newP !== conf) return showToast('Passwords do not match', 'error');
    if(newP.length < 8) return showToast('Password must be 8+ characters', 'error');
    try {
        const res = await fetch(`${API_URL}/auth/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ currentPassword: curr, newPassword: newP }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        showToast('Password Updated!', 'success');
    } catch(e) { showToast(e.message, 'error'); }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  if (confirm('Logout?')) { localStorage.clear(); window.location.href = 'login.html'; }
});

// ==========================================
// DELETE ACCOUNT MODAL LOGIC
// ==========================================
function openDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if(modal) modal.classList.add('active');
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-confirm-modal');
    if(modal) {
        modal.classList.remove('active');
        const input = document.getElementById('delete-confirm-input');
        if(input) input.value = '';
    }
}
window.closeDeleteModal = closeDeleteModal;

document.getElementById('confirm-delete-action')?.addEventListener('click', async () => {
    const inputVal = document.getElementById('delete-confirm-input').value;
    if (inputVal !== 'DELETE') {
        showToast("Please type 'DELETE' to confirm.", 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to delete account');

        showToast('✅ Your account has been deleted successfully.', 'success');
        localStorage.clear();
        window.location.href = 'index.html';

    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadFounderRequests();
  updateNotificationBadge(); 
  
  const deleteBtn = document.getElementById('delete-account-btn');
  if (deleteBtn) {
      deleteBtn.addEventListener('click', openDeleteModal);
  }
});