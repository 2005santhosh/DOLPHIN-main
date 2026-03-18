// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const API_URL = 'https://api.dolphinorg.in/api';

let user = {};
let selectedUserIds = [];
let allUsers = [];

// ==========================================
// 2. AUTH CHECK (COOKIE BASED)
// ==========================================
async function checkAuthStatus() {
    try {
        const res = await fetch(`${API_URL}/auth/profile`, { 
            credentials: 'include' // IMPORTANT: Send the HttpOnly cookie
        });

        if (res.status === 401) {
            // Not authenticated
            localStorage.clear();
            window.location.href = 'login.html';
            return false;
        }

        const data = await res.json();
        user = data.profile || data;

        // Check Role
        if (user.role !== 'admin' && user.role !== 'investor') {
            alert('Access Denied.');
            localStorage.clear();
            window.location.href = 'login.html';
            return false;
        }

        // Update UI immediately
        document.getElementById('user-name').textContent = user.name || 'Admin';
        const nameArray = (user.name || 'Admin').split(' ');
        const initials = nameArray.map(n => n.charAt(0).toUpperCase()).join('');
        document.querySelector('.user-avatar').textContent = initials || 'A';

        return true;
    } catch (error) {
        console.error("Auth check failed:", error);
        window.location.href = 'login.html';
        return false;
    }
}

// ==========================================
// 3. API HELPER (FIXED FOR COOKIES)
// ==========================================
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // FIX: Added credentials
    };

    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        
        // Handle unauthorized requests immediately
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ==========================================
// MOBILE SIDEBAR LOGIC
// ==========================================
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function toggleSidebar() {
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
  document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
}

function closeSidebar() {
  sidebar.classList.remove('active');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

hamburgerBtn.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', closeSidebar);

// Close sidebar when window is resized to desktop size
window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) {
    closeSidebar();
  }
});

// ==========================================
// NAVIGATION LOGIC
// ==========================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Close mobile sidebar if open
    closeSidebar();
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    loadPageContent(page);
  });
});

// Load page content
function loadPageContent(page) {
  switch(page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'startups':
      loadStartups();
      break;
    case 'providers':
      loadProviders();
      break;
    case 'notifications':
      loadNotificationPage();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

async function loadDashboard() {
  try {
    const data = await apiCall('/admin/dashboard');

    // Check if data exists before updating DOM
    if (data && data.users) {
      document.getElementById('total-users').textContent = data.users.total;
      document.getElementById('pending-approvals').textContent = data.users.pending;
      document.getElementById('validated-startups').textContent = data.startups.validated;
      document.getElementById('active-providers').textContent = data.providers.verified;
    }
    
    // Load recent activity
    await loadRecentActivity();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    const container = document.getElementById('recent-activity');
    if (container) {
        container.innerHTML = '<p style="text-align: center; color: var(--danger);">Failed to load dashboard. You may have been logged out.</p>';
    }
  }
}

// Load Recent Activity
async function loadRecentActivity() {
  const container = document.getElementById('recent-activity');
  
  try {
    // Get recent users
    const users = await apiCall('/admin/pending-users');
    
    container.innerHTML = '';
    
    if (!users || users.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No recent activity</p>';
      return;
    }
    
    users.slice(0, 5).forEach(user => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-icon" style="background: #dbeafe; color: #3b82f6;">
          👤
        </div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${user.name}</strong> registered as ${user.role}
          </div>
          <div class="activity-time">${formatTime(user.createdAt)}</div>
        </div>
      `;
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading activity:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--danger);">Failed to load activity</p>';
  }
}

// Load Users
async function loadUsers() {
  try {
    allUsers = await apiCall('/admin/users');
    displayUsers(allUsers);
    
    // Setup filters
    document.getElementById('user-role-filter').addEventListener('change', filterUsers);
    document.getElementById('user-status-filter').addEventListener('change', filterUsers);
    document.getElementById('user-search').addEventListener('input', filterUsers);
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('users-table-body').innerHTML = 
      '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load users</td></tr>';
  }
}

function displayUsers(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No users found</td></tr>';
    return;
  }
  
  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar-small">${getUserInitials(user.name)}</div>
          <div class="user-info">
            <div class="user-name">${user.name}</div>
          </div>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="role-badge ${user.role}">${user.role}</span></td>
      <td><span class="status-badge ${getStatusClass(user.state)}">${formatStatus(user.state)}</span></td>
      <td>Stage ${user.stage || 0}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <div class="action-buttons">
          ${user.state === 'PENDING_APPROVAL' ? `
            <button class="btn-icon success" onclick="approveUser('${user._id}')" title="Approve">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
            </button>
            <button class="btn-icon danger" onclick="rejectUser('${user._id}')" title="Reject">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          ` : ''}
          ${user.state !== 'BLOCKED' && user.state !== 'PENDING_APPROVAL' ? `
            <button class="btn-icon" onclick="moveUserStage('${user._id}')" title="Advance Stage">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"></path>
              </svg>
            </button>
          ` : ''}
          <button class="btn-icon" onclick="viewUserDetails('${user._id}')" title="View Details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          ${user.state !== 'BLOCKED' ? `
            <button class="btn-icon danger" onclick="blockUser('${user._id}')" title="Block">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterUsers() {
  const role = document.getElementById('user-role-filter').value;
  const status = document.getElementById('user-status-filter').value;
  const search = document.getElementById('user-search').value.toLowerCase();
  
  let filtered = allUsers;
  
  if (role !== 'all') {
    filtered = filtered.filter(u => u.role === role);
  }
  
  if (status !== 'all') {
    filtered = filtered.filter(u => u.state === status);
  }
  
  if (search) {
    filtered = filtered.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }
  
  displayUsers(filtered);
}

// Load Startups
async function loadStartups() {
  try {
    const startups = await apiCall('/admin/startups');
    const tbody = document.getElementById('startups-table-body');
    tbody.innerHTML = '';
    
    if (!startups || startups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No startups found</td></tr>';
      return;
    }
    
    startups.forEach(startup => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${startup.name}</strong></td>
        <td>${startup.founderId?.name || 'N/A'}</td>
        <td>${startup.industry || 'N/A'}</td>
        <td>Stage ${startup.currentStage}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 100px; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
              <div style="width: ${startup.validationScore}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent));"></div>
            </div>
            <span style="font-weight: 600;">${startup.validationScore}%</span>
          </div>
        </td>
        <td><span class="status-badge ${startup.validationScore >= 70 ? 'verified' : 'pending'}">${startup.validationScore >= 70 ? 'Validated' : 'In Progress'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="viewStartupDetails('${startup._id}')" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading startups:', error);
  }
}

// Load Providers
async function loadProviders() {
  try {
    const providers = await apiCall('/admin/providers');
    const tbody = document.getElementById('providers-table-body');
    tbody.innerHTML = '';
    
    if (!providers || providers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No providers found</td></tr>';
      return;
    }
    
    providers.forEach(provider => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${provider.name || provider.userId?.name}</strong></td>
        <td>${provider.userId?.email || 'N/A'}</td>
        <td>${provider.category || 'N/A'}</td>
        <td>${provider.experienceLevel || 'N/A'}</td>
        <td><span class="status-badge ${provider.verified ? 'verified' : 'pending'}">${provider.verified ? 'Verified' : 'Pending'}</span></td>
        <td>${provider.rating ? '⭐ ' + provider.rating.toFixed(1) : 'N/A'}</td>
        <td>
          <div class="action-buttons">
            ${!provider.verified ? `
              <button class="btn-icon success" onclick="verifyProvider('${provider._id}')" title="Verify">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
              </button>
              <button class="btn-icon danger" onclick="rejectProvider('${provider._id}')" title="Reject">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            ` : ''}
            <button class="btn-icon" onclick="viewProviderDetails('${provider._id}')" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading providers:', error);
  }
}

// Load Notification Page
async function loadNotificationPage() {
  // Load all users for selection
  try {
    const data = await apiCall('/admin/admin-notifications/users');
    if (data.success) {
      allUsers = data.users;
      displayUserSelection(allUsers);
    }
  } catch (error) {
    console.error('Error loading users for notification:', error);
  }
  
  // Setup user search
  const searchInput = document.getElementById('user-search-input');
  // Clone node to remove old listeners if any
  const newSearchInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newSearchInput, searchInput);
  
  newSearchInput.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
    displayUserSelection(filtered);
  });
}

function displayUserSelection(users) {
  const list = document.getElementById('user-selection-list');
  list.innerHTML = '';
  
  users.forEach(user => {
    const item = document.createElement('div');
    item.className = `user-item ${selectedUserIds.includes(user._id) ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="user-avatar-small">${getUserInitials(user.name)}</div>
      <div class="user-info">
        <div class="user-name">${user.name}</div>
        <div class="user-email">${user.email}</div>
      </div>
      <span class="role-badge ${user.role}">${user.role}</span>
    `;
    
    item.addEventListener('click', () => toggleUserSelection(user._id));
    list.appendChild(item);
  });
}

function toggleUserSelection(userId) {
  const index = selectedUserIds.indexOf(userId);
  
  if (index === -1) {
    selectedUserIds.push(userId);
  } else {
    selectedUserIds.splice(index, 1);
  }
  
  updateSelectedUsers();
  // Refresh the list to show selected state, keeping current search filter
  const searchVal = document.getElementById('user-search-input').value;
  const filtered = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchVal.toLowerCase()) || 
    u.email.toLowerCase().includes(searchVal.toLowerCase())
  );
  displayUserSelection(filtered);
}

function updateSelectedUsers() {
  const container = document.getElementById('selected-users');
  container.innerHTML = '';
  
  if (selectedUserIds.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No users selected</p>';
    return;
  }
  
  selectedUserIds.forEach(userId => {
    const user = allUsers.find(u => u._id === userId);
    if (user) {
      const tag = document.createElement('div');
      tag.className = 'selected-user-tag';
      tag.innerHTML = `
        <span>${user.name}</span>
        <button class="remove-user" onclick="toggleUserSelection('${userId}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      `;
      container.appendChild(tag);
    }
  });
}

// Form Submissions

// Send by role
document.getElementById('role-notification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    role: document.getElementById('role-target').value,
    title: document.getElementById('role-title').value,
    message: document.getElementById('role-message').value,
    priority: document.getElementById('role-priority').value,
    actionUrl: document.getElementById('role-action-url').value || null,
    actionText: document.getElementById('role-action-text').value || null
  };
  
  try {
    const data = await apiCall('/admin/admin-notifications/send-by-role', 'POST', payload);
    
    if (data.success) {
      alert(`✅ ${data.message}`);
      e.target.reset();
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (error) {
    alert('Failed to send notification');
    console.error(error);
  }
});

// Broadcast to all
document.getElementById('broadcast-notification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    title: document.getElementById('broadcast-title').value,
    message: document.getElementById('broadcast-message').value,
    priority: document.getElementById('broadcast-priority').value,
    actionUrl: document.getElementById('broadcast-action-url').value || null,
    actionText: document.getElementById('broadcast-action-text').value || null
  };
  
  if (!confirm('Are you sure you want to send this notification to ALL users?')) {
    return;
  }
  
  try {
    const data = await apiCall('/admin/admin-notifications/send-to-all', 'POST', payload);
    
    if (data.success) {
      alert(`✅ ${data.message}`);
      e.target.reset();
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (error) {
    alert('Failed to send notification');
    console.error(error);
  }
});

// Send to specific users
document.getElementById('users-notification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (selectedUserIds.length === 0) {
    alert('Please select at least one user');
    return;
  }
  
  const payload = {
    userIds: selectedUserIds,
    title: document.getElementById('users-title').value,
    message: document.getElementById('users-message').value,
    priority: document.getElementById('users-priority').value
  };
  
  try {
    const data = await apiCall('/admin/admin-notifications/send-to-users', 'POST', payload);
    
    if (data.success) {
      alert(`✅ ${data.message}`);
      e.target.reset();
      selectedUserIds = [];
      updateSelectedUsers();
      displayUserSelection(allUsers); // Reset selection UI
    } else {
      alert(`❌ ${data.message}`);
    }
  } catch (error) {
    alert('Failed to send notification');
    console.error(error);
  }
});

// User Actions
async function approveUser(userId) {
  if (!confirm('Approve this user?')) return;
  
  try {
    const data = await apiCall('/admin/approve-user', 'POST', { userId });
    alert(data.message);
    loadUsers();
    loadDashboard();
  } catch (error) {
    alert('Failed to approve user');
  }
}

async function rejectUser(userId) {
  if (!confirm('Reject this user?')) return;
  
  try {
    const data = await apiCall('/admin/reject-user', 'POST', { userId });
    alert(data.message);
    loadUsers();
    loadDashboard();
  } catch (error) {
    alert('Failed to reject user');
  }
}

async function blockUser(userId) {
  if (!confirm('Block this user?')) return;
  
  try {
    const data = await apiCall('/admin/block-user', 'POST', { userId });
    alert(data.message);
    loadUsers();
  } catch (error) {
    alert('Failed to block user');
  }
}

async function moveUserStage(userId) {
  if (!confirm('Move this user to the next stage?')) return;
  
  try {
    const data = await apiCall('/admin/move-stage', 'POST', { userId });
    alert(data.message);
    loadUsers();
  } catch (error) {
    alert('Failed to move user stage');
  }
}

async function verifyProvider(providerId) {
  if (!confirm('Verify this provider?')) return;
  
  try {
    const data = await apiCall('/admin/verify-provider', 'POST', { providerId });
    alert(data.message);
    loadProviders();
    loadDashboard();
  } catch (error) {
    alert('Failed to verify provider');
  }
}

async function rejectProvider(providerId) {
  if (!confirm('Reject this provider?')) return;
  
  try {
    const data = await apiCall('/admin/reject-provider', 'POST', { providerId });
    alert(data.message);
    loadProviders();
  } catch (error) {
    alert('Failed to reject provider');
  }
}

// View Details Functions
function viewUserDetails(userId) {
  const user = allUsers.find(u => u._id === userId);
  if (!user) return;
  
  const modal = document.getElementById('user-modal');
  const body = document.getElementById('user-modal-body');
  
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <div>
        <strong>Name:</strong> ${user.name}
      </div>
      <div>
        <strong>Email:</strong> ${user.email}
      </div>
      <div>
        <strong>Role:</strong> <span class="role-badge ${user.role}">${user.role}</span>
      </div>
      <div>
        <strong>Status:</strong> <span class="status-badge ${getStatusClass(user.state)}">${formatStatus(user.state)}</span>
      </div>
      <div>
        <strong>Stage:</strong> ${user.stage || 0}
      </div>
      <div>
        <strong>Joined:</strong> ${formatDate(user.createdAt)}
      </div>
    </div>
  `;
  
  modal.classList.add('active');
}

function viewStartupDetails(startupId) {
  alert('Startup details feature coming soon');
}

function viewProviderDetails(providerId) {
  alert('Provider details feature coming soon');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('active');
}

// Utility Functions
function getUserInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n.charAt(0).toUpperCase()).join('').slice(0, 2);
}

function getStatusClass(state) {
  if (state === 'PENDING_APPROVAL') return 'pending';
  if (state === 'BLOCKED') return 'blocked';
  return 'active';
}

function formatStatus(state) {
  if (state === 'PENDING_APPROVAL') return 'Pending';
  if (state === 'BLOCKED') return 'Blocked';
  if (state.startsWith('STAGE_')) return 'Active';
  return state;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Settings
function loadSettings() {
  document.getElementById('full-name').value = user.name || '';
  document.getElementById('email').value = user.email || '';
}

document.getElementById('update-profile-btn').addEventListener('click', () => {
  alert('Profile update feature coming soon');
});

// FIX: Logout now calls backend to clear cookie
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to logout?')) {
    try {
        await fetch(`${API_URL}/auth/logout`, { 
            method: 'POST', 
            credentials: 'include' 
        });
    } catch(e) {
        console.warn("Backend logout failed", e);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthed = await checkAuthStatus();
  if(isAuthed) {
      loadDashboard();
  }
});

// Close modal on outside click
document.getElementById('user-modal').addEventListener('click', (e) => {
  if (e.target.id === 'user-modal') {
    closeUserModal();
  }
});