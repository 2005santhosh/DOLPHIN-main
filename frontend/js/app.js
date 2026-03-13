// Main frontend application logic 
// Handles authentication, role-based redirects, dashboard initialization, and event handlers
const API_URL = 'https://api.dolphinorg.in/api';
function getUser() {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error parsing user data from localStorage:', error);
    localStorage.removeItem('user');
    return null;
  }
}

async function logout() {
  try {
    // Optional: notify server (good hygiene, future-proof for blacklisting)
    const token = localStorage.getItem('token');
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => {
        // Ignore server error - client-side logout must succeed anyway
        console.warn('Server logout failed, proceeding client-side:', err);
      });
    }
  } catch (err) {
    console.error('Logout process error:', err);
  }

  // Clear all client-side auth data
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.clear();

  // Redirect to index.html (home/landing page)
  window.location.href = 'index.html';
}

// ────────────────────────────────────────────────
// Client-side role protection + dynamic back link
// Runs on every page load
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // PHASE 1: STATE-DRIVEN DASHBOARDS - Sync backend state on page load
  if (typeof stateManager !== 'undefined' && window.location.pathname.includes('.html')) {
    try {
      const profile = await stateManager.syncStateWithBackend();
      
      // Store profile for validation
      window.currentUserProfile = profile;
      
      // Apply state-driven UI rendering
      stateManager.renderConditionalUI();
      
      // Display state indicator in page header
      const headerContainer = document.querySelector('.dashboard-header') || document.querySelector('header');
      if (headerContainer) {
        stateManager.displayStateIndicator(headerContainer);
      }
    } catch (err) {
      console.warn('State sync failed (non-critical):', err.message);
      // Continue anyway - user can still use platform
    }
  }

  // Add event listener for logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  const user = getUser();
  const currentPath = window.location.pathname.toLowerCase();
  
  // Extract the current page name without extension and path
  const currentPage = currentPath.split('/').pop().replace('.html', '');

  // If no user is logged in → redirect from protected pages
  if (!user) {
    if (currentPage === 'dashboard' || 
        currentPage === 'investor-dashboard' || 
        currentPage === 'provider-dashboard' || 
        currentPage === 'marketplace') {
      window.location.href = 'index.html';
    }
    return;
  }

  // If logged in → ensure role matches the current page
  if (currentPage === 'dashboard' && user.role !== 'founder') {
    window.location.href = 'index.html';
  }
  if (currentPage === 'investor-dashboard' && user.role !== 'investor') {
    window.location.href = 'index.html';
  }
  if (currentPage === 'provider-dashboard' && user.role !== 'provider') {
    window.location.href = 'index.html';
  }

  // Dynamic "Back to Dashboard" link
  const backLink = document.querySelector('.btn-back');
  if (backLink) {
    let dashboardPath = 'index.html'; // fallback

    switch (user.role) {
      case 'founder':
        dashboardPath = 'dashboard.html';
        break;
      case 'investor':
        dashboardPath = 'investor-dashboard.html';
        break;
      case 'provider':
        dashboardPath = 'provider-dashboard.html';
        break;
    }

    backLink.href = dashboardPath;
  }
});

// ────────────────────────────────────────────────
// Login Form Handler
// ────────────────────────────────────────────────
if (window.location.pathname.includes('login.html')) {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      alert('Email and password are required');
      return;
    }

    try {
      const data = await api.login(email, password);
      if (data && data.token && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        
        // Redirect based on role
        switch (data.user.role) {
          case 'founder':
            window.location.href = 'dashboard.html';
            break;
          case 'provider':
            window.location.href = 'provider-dashboard.html';
            break;
          case 'investor':
            window.location.href = 'investor-dashboard.html';
            break;
          default:
            window.location.href = 'index.html';
        }
      } else {
        alert('Invalid login response');
      }
    } catch (err) {
      alert(`Login Failed: ${err.message}`);
    }
  });
}

// ────────────────────────────────────────────────
// Register Form Handler
// ────────────────────────────────────────────────
if (window.location.pathname.includes('register.html')) {
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.querySelector('input[name="role"]:checked')?.value;

    if (!name || !email || !password || !role) {
      alert('All fields are required');
      return;
    }

    try {
      const data = await api.register(name, email, password, role);
      if (data && data.token && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        alert('Account created successfully!');

        // Redirect based on role
        switch (data.user.role) {
          case 'founder':
            window.location.href = 'dashboard.html';
            break;
          case 'provider':
            window.location.href = 'provider-dashboard.html';
            break;
          case 'investor':
            window.location.href = 'investor-dashboard.html';
            break;
          default:
            window.location.href = 'index.html';
        }
      } else {
        alert('Invalid registration response');
      }
    } catch (err) {
      alert(`Registration Failed: ${err.message}`);
    }
  });
}

// ────────────────────────────────────────────────
// Founder Dashboard Logic
// ────────────────────────────────────────────────
if (window.location.pathname.includes('dashboard.html')) {
  const user = getUser();
  if (!user || user.role !== 'founder') {
    window.location.href = 'index.html';
  }

  const initDashboard = async () => {
    let startup = await api.getStartup();
    if (!startup) {
      document.getElementById('create-startup-section').style.display = 'block';
      document.getElementById('dashboard-section').style.display = 'none';

      document.getElementById('create-startup-btn').addEventListener('click', async () => {
        const name = document.getElementById('s-name').value.trim();
        const thesis = document.getElementById('s-thesis').value.trim();
        if (!name || !thesis) return alert('Please fill all fields');

        try {
          startup = await api.createStartup({ name, thesis, industry: 'Tech' });
          renderDashboard(startup);
        } catch (err) {
          alert(`Failed to create startup: ${err.message}`);
        }
      });
    } else {
      renderDashboard(startup);
    }
  };

  window.toggleMilestone = async (startupId, milestoneId) => {
    const checkbox = document.getElementById(`check-${milestoneId}`);
    try {
      const updatedStartup = await api.updateMilestone(milestoneId, checkbox.checked);
      renderDashboard(updatedStartup);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      alert(err.message);
    }
  };

  function renderDashboard(startup) {
    document.getElementById('create-startup-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'grid';

    document.getElementById('startup-name').textContent = startup.name;
    document.getElementById('progress-fill').style.width = `${startup.validationScore}%`;
    document.getElementById('score-text').textContent = `${startup.validationScore}% Validated`;

    const list = document.getElementById('milestone-list');
    list.innerHTML = '';
    startup.milestones.sort((a, b) => a.order - b.order).forEach(m => {
      const div = document.createElement('div');
      div.className = `milestone-item ${m.isCompleted ? 'completed' : ''} ${m.verified ? 'verified' : ''}`;
      const isDisabled = m.order > 1 && !startup.milestones.find(prev => prev.order === m.order - 1)?.verified;
      div.innerHTML = `
        <div>
          <strong>${m.title}</strong>
          <p style="font-size:0.8rem; color:#94a3b8; margin:0;">${m.description}</p>
          ${m.verified ? '<span style="color:green;">(Verified)</span>' : (m.isCompleted ? '<span style="color:orange;">(Pending Verification)</span>' : '')}
        </div>
        <input type="checkbox" id="check-${m._id}"
          ${m.isCompleted ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}
          onchange="toggleMilestone('${startup._id}', '${m._id}')">
      `;
      list.appendChild(div);
    });

    const auditList = document.getElementById('audit-list');
    auditList.innerHTML = '';
    startup.auditLogs.forEach(log => {
      const li = document.createElement('li');
      li.textContent = `${log.action} at ${new Date(log.timestamp).toLocaleString()}: ${JSON.stringify(log.details)}`;
      auditList.appendChild(li);
    });

    const analytics = document.getElementById('analytics-section');
    const incomplete = startup.milestones.filter(m => !m.verified).length;
    analytics.innerHTML = `<p>Struggle Areas: ${incomplete} unverified milestones. Focus on next: ${startup.milestones.find(m => !m.verified)?.title || 'All verified!'}</p>`;
  }

  initDashboard();
}

// ────────────────────────────────────────────────
// Investor Dashboard Logic
// ────────────────────────────────────────────────
if (window.location.pathname.includes('investor-dashboard.html')) {
  const user = getUser();
  if (!user || user.role !== 'investor') {
    window.location.href = 'index.html';
  }

  async function loadInvestorDashboard() {
    try {
      const startups = await api.getValidatedStartups();

      const container = document.getElementById('validated-startups');
      if (!container) return;

      container.innerHTML = '';

      if (!startups || startups.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No validated startups available yet.</p>';
        return;
      }

      startups.forEach(s => {
        const card = document.createElement('div');
        card.className = 'startup-card';
        const scoreClass = s.validationScore >= 85 ? 'score-high' : s.validationScore >= 70 ? 'score-medium' : 'score-low';

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.1rem;">${s.name}</strong>
            <span class="${scoreClass}">${s.validationScore}%</span>
          </div>
          <p style="margin:0.5rem 0; color:var(--text-secondary);">
            ${s.thesis?.substring(0, 120)}${s.thesis?.length > 120 ? '...' : ''}
          </p>
          <small style="color:var(--text-secondary);">Industry: ${s.industry || 'Not specified'}</small>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load validated startups:', err);
      const container = document.getElementById('validated-startups');
      if (container) {
        container.innerHTML = '<p style="color:red;">Failed to load startups.</p>';
      }
    }
  }

  // Search filter
  document.getElementById('search-startup')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.startup-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? '' : 'none';
    });
  });

  loadInvestorDashboard();
}

// ────────────────────────────────────────────────
// Provider Dashboard Logic
// ────────────────────────────────────────────────
if (window.location.pathname.includes('provider-dashboard.html')) {
  const user = getUser();
  if (!user || user.role !== 'provider') {
    window.location.href = 'index.html';
  }

  async function loadProviderDashboard() {
    try {
      const requests = await api.getMyRequests();

      const pendingEl = document.getElementById('requests-pending');
      const acceptedEl = document.getElementById('requests-accepted');

      pendingEl.innerHTML = '';
      acceptedEl.innerHTML = '';

      if (!requests || requests.length === 0) {
        pendingEl.innerHTML = '<p style="color:var(--text-secondary);">No requests at the moment.</p>';
        return;
      }

      requests.forEach(r => {
        const item = document.createElement('div');
        item.className = 'request-item';
        item.innerHTML = `
          <div>
            <strong>${r.startupId?.name || 'Unnamed Startup'}</strong><br>
            <small style="color:var(--text-secondary);">
              Validation: ${r.startupId?.validationScore || '?'}% • 
              ${new Date(r.createdAt).toLocaleDateString()}
            </small>
          </div>
          <div>
            <span class="status-${r.status}">${r.status.toUpperCase()}</span>
            ${r.status === 'pending' ? `
              <button class="btn btn-accept" onclick="updateRequest('${r._id}', 'accepted')">Accept</button>
              <button class="btn btn-reject"  onclick="updateRequest('${r._id}', 'rejected')">Reject</button>
            ` : ''}
          </div>
        `;

        if (r.status === 'pending') {
          pendingEl.appendChild(item);
        } else {
          acceptedEl.appendChild(item);
        }
      });
    } catch (err) {
      console.error(err);
      document.querySelector('.card').innerHTML += '<p style="color:red;">Failed to load requests.</p>';
    }
  }

  // Placeholder for accept/reject
  window.updateRequest = async function(requestId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this request?`)) return;
    try {
      await api.updateIntroRequest(requestId, newStatus);
      alert(`Request marked as ${newStatus}!`);
      loadProviderDashboard(); // refresh
    } catch (err) {
      alert('Failed to update request: ' + err.message);
    }
  };

  loadProviderDashboard();
}