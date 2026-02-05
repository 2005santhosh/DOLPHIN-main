// Get user from localStorage
const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');

// Update user name in header
document.getElementById('user-name').textContent = user.name || 'User';

// Update user avatar with initials
const nameArray = (user.name || 'User').split(' ');
const initials = nameArray.map(n => n.charAt(0).toUpperCase()).join('');
document.querySelector('.user-avatar').textContent = initials || 'U';

// Check if user is authenticated
if (!token) {
  window.location.href = 'login.html';
}

// Mobile menu toggle
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebar-close');
const mainContent = document.querySelector('.main-content');

menuToggle.addEventListener('click', () => {
  sidebar.classList.add('active');
});

sidebarClose.addEventListener('click', () => {
  sidebar.classList.remove('active');
});

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && 
      sidebar.classList.contains('active') && 
      !sidebar.contains(e.target) && 
      !menuToggle.contains(e.target)) {
    sidebar.classList.remove('active');
  }
});

// User menu click handler
document.getElementById('user-menu').addEventListener('click', () => {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById('settings-page').classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelector('[data-page="settings"]').classList.add('active');
});

// Navigation functionality
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('active');
    }
    
    loadPageContent(page);
  });
});

// Load page content
function loadPageContent(page) {
  switch(page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'stages':
      loadStages();
      break;
    case 'resources':
      loadResources();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// Dashboard functionality
async function loadDashboard() {
  try {
    const startup = await api.getStartup();
    const progressCard = document.querySelector('.progress-card');
    const existingCreateBtn = document.getElementById('create-startup-btn');

    if (startup) {
      if (existingCreateBtn) existingCreateBtn.remove();
      if (progressCard) {
        progressCard.querySelectorAll('button').forEach(btn => {
          if ((btn.textContent || '').trim().toLowerCase() === 'create startup') {
            btn.remove();
          }
        });
      }

      const validatedStages = (startup.validationStages && Object.keys(startup.validationStages).length > 0)
        ? VALIDATION_STAGES
            .map(s => startup.validationStages?.[s.key])
            .filter(v => v && v.isValidated)
            .length
        : startup.milestones.filter(m => m.verified).length;

      const totalStages = VALIDATION_STAGES.length;
      const completionPercent = Math.round((validatedStages / totalStages) * 100);

      const completedCount = VALIDATION_STAGES
        .map(s => startup.validationStages?.[s.key])
        .filter(v => v && v.completedAt)
        .length;
      const allCompleted = completedCount === VALIDATION_STAGES.length;

      document.getElementById('startup-name-display').textContent = startup.name;
      document.getElementById('progress-text').textContent = `${completionPercent}% Complete (${validatedStages}/${totalStages} stages validated)`;
      document.getElementById('progress-badge').textContent = allCompleted
        ? `${startup.validationScore}% Overall`
        : `Overall: Pending`;
      document.getElementById('progress-fill').style.width = `${completionPercent}%`;

      document.getElementById('stages-completed').textContent = `${validatedStages}/${totalStages}`;

      const completedTasks = startup.milestones.filter(m => m.isCompleted).length;
      const totalTasks = startup.milestones.length;
      document.getElementById('tasks-completed').textContent = `${completedTasks}/${totalTasks}`;

      populateStagesList(startup);
    } else {
      document.getElementById('startup-name-display').textContent = 'No Startup Found';
      document.getElementById('progress-text').textContent = 'Create a startup to get started';
      document.getElementById('progress-badge').textContent = 'Overall: Pending';
      document.getElementById('progress-fill').style.width = '0%';
      document.getElementById('stages-completed').textContent = '0/5';
      document.getElementById('tasks-completed').textContent = '0/15';

      if (!existingCreateBtn && progressCard) {
        const createButton = document.createElement('button');
        createButton.id = 'create-startup-btn';
        createButton.textContent = 'Create Startup';
        createButton.className = 'btn btn-primary';
        createButton.style.marginTop = '1rem';
        createButton.onclick = () => {
          document.querySelector('[data-page="profile"]').click();
        };
        progressCard.appendChild(createButton);
      }

      populateStagesList(null);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    document.getElementById('startup-name-display').textContent = 'Error';
    document.getElementById('progress-text').textContent = 'Failed to load data';
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
    const statusText = locked
      ? 'Locked'
      : !hasCompleted
        ? 'Not Started'
        : passed
          ? 'Validated'
          : 'Needs Improvement';

    const statusClass = locked
      ? 'status-pending'
      : !hasCompleted
        ? 'status-pending'
        : passed
          ? 'status-approved'
          : 'status-submitted';

    stageElement.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${title}</div>
        <div class="list-item-subtitle">Score: ${scoreText}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="font-size: 12px; color: var(--text-secondary);">${scoreText}</span>
        <span class="list-item-status ${statusClass}">${statusText}</span>
      </div>
    `;

    stagesList.appendChild(stageElement);
  });
}

// Profile functionality
async function loadProfile() {
  try {
    const startup = await api.getStartup();
    
    if (startup) {
      document.getElementById('startup-name').value = startup.name;
      document.getElementById('problem-statement').value = startup.thesis || '';
      document.getElementById('target-users').value = 'Your target users';
      document.getElementById('industry').value = startup.industry || '';
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
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
    await api.createStartup(startupData);
    alert('Profile updated successfully!');
    loadDashboard();
  } catch (error) {
    alert(`Failed to update profile: ${error.message}`);
  }
});

// Stages functionality
async function loadStages() {
  try {
    const startup = await api.getStartup();
    const msg = document.getElementById('validation-roadmap-message');

    if (!startup) {
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = 'Create a startup first to access validation stages.';
      }

      const summaryCard = document.getElementById('overall-validation-summary');
      if (summaryCard) summaryCard.style.display = 'none';

      VALIDATION_STAGES.forEach(({ key }) => {
        const statusEl = document.getElementById(`stage-status-${key}`);
        const startBtn = document.getElementById(`stage-start-${key}`);
        const resultsBtn = document.getElementById(`stage-results-${key}`);
        const summaryEl = document.getElementById(`stage-summary-${key}`);
        const lockEl = document.getElementById(`stage-lock-${key}`);

        if (statusEl) setBadge(statusEl, 'Create Startup', 'default');
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.textContent = 'Locked';
        }
        if (resultsBtn) resultsBtn.style.display = 'none';
        if (summaryEl) summaryEl.style.display = 'none';
        if (lockEl) lockEl.style.display = 'inline';
      });

      return;
    }

    if (msg) msg.style.display = 'none';
    renderValidationRoadmap(startup);
  } catch (error) {
    console.error('Error loading stages:', error);
    const msg = document.getElementById('validation-roadmap-message');
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = 'red';
      msg.textContent = 'Failed to load validation stages.';
    }
  }
}

// Resources functionality
function loadResources() {
  const resourcesList = document.getElementById('resources-list');
  resourcesList.innerHTML = '';
  
  const resources = [
    { id: 1, title: 'Market Research Guide', description: 'How to conduct effective market research', type: 'guide' },
    { id: 2, title: 'Competitor Analysis Template', description: 'Template for analyzing competitors', type: 'template' },
    { id: 3, title: 'Idea Validation Checklist', description: 'Checklist for validating your idea', type: 'checklist' }
  ];
  
  resources.forEach(resource => {
    const resourceElement = document.createElement('div');
    resourceElement.className = 'resource-item';
    resourceElement.innerHTML = `
      <div class="resource-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${getResourceIcon(resource.type)}
        </svg>
      </div>
      <div class="resource-content">
        <div class="resource-title">${resource.title}</div>
        <div class="resource-description">${resource.description}</div>
      </div>
    `;
    
    resourceElement.addEventListener('click', () => {
      alert(`Opening ${resource.title}...`);
    });
    
    resourcesList.appendChild(resourceElement);
  });
}

function getResourceIcon(type) {
  switch (type) {
    case 'guide': return '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 0 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>';
    case 'template': return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>';
    case 'checklist': return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line>';
    default: return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>';
  }
}

// ============= ENHANCED ANALYTICS =============
function loadAnalytics() {
  const analyticsGrid = document.getElementById('analytics-grid');
  
  // Clear existing content
  analyticsGrid.innerHTML = `
    <!-- Filter Bar -->
    <div class="filter-bar" style="grid-column: 1 / -1;">
      <button class="filter-btn active" onclick="setAnalyticsPeriod('7d')">Last 7 Days</button>
      <button class="filter-btn" onclick="setAnalyticsPeriod('30d')">Last 30 Days</button>
      <button class="filter-btn" onclick="setAnalyticsPeriod('90d')">Last 90 Days</button>
      <button class="filter-btn" onclick="setAnalyticsPeriod('all')">All Time</button>
    </div>

    <!-- Stats Overview -->
    <div class="stats-overview" style="grid-column: 1 / -1;">
      <div class="stat-box">
        <div class="stat-value">1/5</div>
        <div class="stat-label">Stages Completed</div>
        <div class="stat-change">↑ 20% vs last week</div>
      </div>
      <div class="stat-box green">
        <div class="stat-value">68%</div>
        <div class="stat-label">Avg. Validation Score</div>
        <div class="stat-change">↑ 12% improvement</div>
      </div>
      <div class="stat-box orange">
        <div class="stat-value">3/15</div>
        <div class="stat-label">Tasks Completed</div>
        <div class="stat-change">↑ 3 this week</div>
      </div>
      <div class="stat-box blue">
        <div class="stat-value">5</div>
        <div class="stat-label">Resources Viewed</div>
        <div class="stat-change">↑ 2 new views</div>
      </div>
    </div>

    <!-- Progress Over Time -->
    <div class="chart-card" style="grid-column: 1 / -1;">
      <h3>📈 Validation Progress Over Time</h3>
      <div class="chart-container">
        <canvas id="progressChart"></canvas>
      </div>
      <div class="insight-card">
        <h4>💡 Key Insight</h4>
        <p>Your validation progress has accelerated by 35% in the last two weeks. Keep up the momentum by completing at least 2 tasks per week.</p>
      </div>
    </div>

    <!-- Stage Performance -->
    <div class="chart-card">
      <h3>🎯 Stage Performance Breakdown</h3>
      <div class="chart-container">
        <canvas id="stagePerformanceChart"></canvas>
      </div>
      <div class="insight-card">
        <h4>💡 Next Steps</h4>
        <p>Focus on Problem Definition and Market Validation to unlock the next stages.</p>
      </div>
    </div>

    <!-- Time Distribution -->
    <div class="chart-card">
      <h3>⏱️ Time Spent by Activity</h3>
      <div class="chart-container">
        <canvas id="timeDistributionChart"></canvas>
      </div>
    </div>

    <!-- Task Completion Rate -->
    <div class="chart-card" style="grid-column: 1 / -1;">
      <h3>✅ Weekly Task Completion Rate</h3>
      <div class="chart-container small">
        <canvas id="taskCompletionChart"></canvas>
      </div>
    </div>

    <!-- Resource Engagement -->
    <div class="chart-card">
      <h3>📚 Resource Engagement</h3>
      <div class="chart-container small">
        <canvas id="resourceChart"></canvas>
      </div>
    </div>

    <!-- Validation Scores -->
    <div class="chart-card">
      <h3>🏆 Validation Score Trends</h3>
      <div class="chart-container small">
        <canvas id="validationScoreChart"></canvas>
      </div>
    </div>
  `;

  // Initialize all charts
  setTimeout(() => {
    initializeProgressChart();
    initializeStagePerformanceChart();
    initializeTimeDistributionChart();
    initializeTaskCompletionChart();
    initializeResourceChart();
    initializeValidationScoreChart();
  }, 100);
}

function initializeProgressChart() {
  const ctx = document.getElementById('progressChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
      datasets: [{
        label: 'Overall Progress (%)',
        data: [5, 12, 18, 25, 32, 45, 58, 68],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7
      }, {
        label: 'Tasks Completed',
        data: [1, 2, 3, 5, 7, 10, 12, 15],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function initializeStagePerformanceChart() {
  const ctx = document.getElementById('stagePerformanceChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Idea Validation', 'Problem Definition', 'Solution Dev', 'Market Validation', 'Business Model'],
      datasets: [{
        label: 'Your Score',
        data: [85, 72, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6'
      }, {
        label: 'Average User Score',
        data: [78, 75, 68, 65, 62],
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: '#10b981',
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#10b981'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        }
      }
    }
  });
}

function initializeTimeDistributionChart() {
  const ctx = document.getElementById('timeDistributionChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Validation Stages', 'Reading Resources', 'Profile Setup', 'Research', 'Planning'],
      datasets: [{
        data: [45, 25, 10, 15, 5],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed + '%';
            }
          }
        }
      }
    }
  });
}

function initializeTaskCompletionChart() {
  const ctx = document.getElementById('taskCompletionChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Completed',
        data: [3, 5, 4, 3],
        backgroundColor: '#10b981',
      }, {
        label: 'In Progress',
        data: [2, 1, 2, 4],
        backgroundColor: '#f59e0b',
      }, {
        label: 'Pending',
        data: [5, 4, 4, 3],
        backgroundColor: '#e5e7eb',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        }
      }
    }
  });
}

function initializeResourceChart() {
  const ctx = document.getElementById('resourceChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Guides', 'Templates', 'Videos', 'Articles', 'Tools'],
      datasets: [{
        label: 'Resources Viewed',
        data: [12, 8, 5, 15, 6],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6'
        ],
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        y: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function initializeValidationScoreChart() {
  const ctx = document.getElementById('validationScoreChart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'],
      datasets: [{
        label: 'First Attempt',
        data: [65, 58, null, null, null],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        borderDash: [5, 5]
      }, {
        label: 'Best Score',
        data: [85, 72, null, null, null],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function setAnalyticsPeriod(period) {
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // In a real app, you would fetch new data based on the period
  console.log('Analytics period changed to:', period);
  
  // Show a subtle notification
  const notification = document.createElement('div');
  notification.textContent = `Showing data for: ${period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : period === '90d' ? 'Last 90 Days' : 'All Time'}`;
  notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 20px; border-radius: 8px; z-index: 1000; animation: slideIn 0.3s ease;';
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Settings functionality
function loadSettings() {
  document.getElementById('full-name').value = user.name || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('role').value = 'Founder';
  
  const emailNotifications = localStorage.getItem('emailNotifications') !== 'false';
  const autoSave = localStorage.getItem('autoSave') !== 'false';
  
  document.getElementById('email-notifications').checked = emailNotifications;
  document.getElementById('auto-save').checked = autoSave;
}

// Settings button handlers
document.getElementById('update-profile-btn')?.addEventListener('click', () => {
  const name = document.getElementById('full-name').value.trim();
  const email = document.getElementById('email').value.trim();
  
  if (!name || !email) {
    alert('Please fill in all fields');
    return;
  }
  
  alert('Profile updated successfully!');
});

document.getElementById('update-password-btn')?.addEventListener('click', () => {
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Please fill in all password fields');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  if (newPassword.length < 8) {
    alert('Password must be at least 8 characters long');
    return;
  }
  
  alert('Password updated successfully!');
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
});

document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
  if (!confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) return;
  if (!confirm('This will permanently delete your account and all associated data. Are you really sure?')) return;
  try {
    await api.deleteAccount();
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.clear();
    window.location.href = 'login.html';
  } catch (err) {
    alert(err.message || 'Failed to delete account. Try again.');
  }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.clear();
    window.location.href = 'login.html';
  }
});

document.getElementById('email-notifications')?.addEventListener('change', (e) => {
  localStorage.setItem('emailNotifications', e.target.checked);
});

document.getElementById('auto-save')?.addEventListener('change', (e) => {
  localStorage.setItem('autoSave', e.target.checked);
});

// ============= VALIDATION STAGES (NO MANUAL SCORING) =============

const VALIDATION_STAGES = [
  { key: 'idea', title: 'Idea Validation' },
  { key: 'problem', title: 'Problem Definition' },
  { key: 'solution', title: 'Solution Development' },
  { key: 'market', title: 'Market Validation' },
  { key: 'business', title: 'Business Model Validation' }
];

const stageOrder = (key) => VALIDATION_STAGES.findIndex(s => s.key === key) + 1;

function setBadge(el, text, variant) {
  el.textContent = text;
  if (variant === 'success') {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
  } else if (variant === 'danger') {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
  } else {
    el.style.background = '#fef3c7';
    el.style.color = '#92400e';
  }
}

function renderValidationRoadmap(startup) {
  const validationStages = startup.validationStages || {};
  const currentStage = startup.currentStage || 1;

  const summaryCard = document.getElementById('overall-validation-summary');
  const summaryText = document.getElementById('overall-validation-summary-text');
  if (summaryCard && summaryText) {
    const completedCount = VALIDATION_STAGES
      .map(s => validationStages?.[s.key])
      .filter(v => v && v.completedAt)
      .length;
    const allCompleted = completedCount === VALIDATION_STAGES.length;

    summaryCard.style.display = 'block';
    summaryText.textContent = allCompleted
      ? `${startup.validationScore}% (final score across all 5 stages)`
      : `Pending (${completedCount}/${VALIDATION_STAGES.length} stages completed)`;
  }

  VALIDATION_STAGES.forEach(({ key, title }) => {
    const order = stageOrder(key);
    const statusEl = document.getElementById(`stage-status-${key}`);
    const summaryEl = document.getElementById(`stage-summary-${key}`);
    const scoreEl = document.getElementById(`stage-score-${key}`);
    const badgeEl = document.getElementById(`stage-badge-${key}`);
    const dateEl = document.getElementById(`stage-date-${key}`);
    const startBtn = document.getElementById(`stage-start-${key}`);
    const resultsBtn = document.getElementById(`stage-results-${key}`);
    const lockEl = document.getElementById(`stage-lock-${key}`);

    const rec = validationStages[key];
    const hasCompleted = !!rec?.completedAt;
    const passed = !!rec?.isValidated;

    let locked = order > currentStage;
    if (order > 1) {
      const prevKey = VALIDATION_STAGES[order - 2].key;
      const prev = validationStages[prevKey];
      if (!prev?.isValidated) locked = true;
    }

    if (lockEl) lockEl.style.display = locked ? 'inline' : 'none';
    if (startBtn) startBtn.disabled = locked;

    if (!hasCompleted) {
      setBadge(statusEl, locked ? 'Locked' : 'Not Started', 'default');
      summaryEl.style.display = 'none';
      resultsBtn.style.display = 'none';
      startBtn.textContent = locked ? 'Locked' : 'Start';
      badgeEl.textContent = '--';
    } else {
      summaryEl.style.display = 'block';
      scoreEl.textContent = `${rec.score}%`;
      badgeEl.textContent = `${rec.score}%`;
      dateEl.textContent = new Date(rec.completedAt).toLocaleDateString();

      if (passed) {
        setBadge(statusEl, '✓ Validated', 'success');
      } else {
        setBadge(statusEl, 'Needs Improvement', 'danger');
      }

      resultsBtn.style.display = 'block';
      startBtn.textContent = 'Retake';
    }
  });
}

// Open validation modal (NO SLIDERS - TEXT ONLY)
async function openStageValidationModal(stageKey) {
  const modal = document.getElementById('idea-validation-modal');
  const container = document.getElementById('validation-questions-container');
  const titleEl = document.getElementById('stage-validation-modal-title');

  modal.dataset.stageKey = stageKey;
  titleEl.textContent = `Validate: ${VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey}`;

  try {
    const response = await fetch(`/api/founder/validate-stage/${stageKey}/questions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.success) {
      alert(data.message || 'Failed to load questions');
      return;
    }

    const questions = data.questions || [];
    container.innerHTML = '';

    questions.forEach((q) => {
      const questionDiv = document.createElement('div');
      questionDiv.style.marginBottom = '2rem';
      questionDiv.innerHTML = `
        <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
          <label class="form-label" style="margin-bottom: 0.5rem;">
            <strong>Q${q.id}:</strong> ${q.question}
          </label>
          <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem;">💡 ${q.hint}</p>
          
          <textarea 
            class="form-textarea validation-answer" 
            data-question-id="${q.id}" 
            data-category="${q.category}"
            data-weight="${q.weight}"
            placeholder="Your answer..." 
            style="margin-bottom: 0; resize: vertical; min-height: 100px;"
            oninput="updateAnswerProgress()"
          ></textarea>
        </div>
      `;
      container.appendChild(questionDiv);
    });

    document.getElementById('validation-progress').style.display = 'block';
    document.getElementById('idea-validation-form').onsubmit = submitStageValidation;

    document.getElementById('validation-progress-text').textContent = '0/10 questions answered';
    document.getElementById('validation-progress-fill').style.width = '0%';

    modal.classList.add('active');
  } catch (error) {
    console.error('Error loading questions:', error);
    alert('Failed to load validation questions');
  }
}

function updateAnswerProgress() {
  const allAnswers = document.querySelectorAll('.validation-answer');
  const answeredCount = Array.from(allAnswers).filter(a => a.value.trim() !== '').length;
  const totalQuestions = allAnswers.length || 10;

  const percent = Math.round((answeredCount / totalQuestions) * 100);
  const progressText = document.getElementById('validation-progress-text');
  const progressFill = document.getElementById('validation-progress-fill');

  if (progressText) progressText.textContent = `${answeredCount}/${totalQuestions} questions answered`;
  if (progressFill) progressFill.style.width = `${percent}%`;
}

async function submitStageValidation(e) {
  e.preventDefault();

  const modal = document.getElementById('idea-validation-modal');
  const stageKey = modal.dataset.stageKey;
  const formEl = document.getElementById('idea-validation-form');
  const loadingEl = document.getElementById('validation-loading');

  const answers = [];
  const answerElements = document.querySelectorAll('.validation-answer');

  for (let elem of answerElements) {
    if (elem.value.trim() === '') {
      alert('Please answer all questions before submitting');
      return;
    }
  }

  answerElements.forEach(elem => {
    const questionId = parseInt(elem.dataset.questionId);
    answers.push({
      id: questionId,
      answer: elem.value.trim(),
      category: elem.dataset.category
    });
  });

  // Show loading state
  formEl.style.display = 'none';
  loadingEl.style.display = 'block';

  try {
    const response = await fetch(`/api/founder/validate-stage/${stageKey}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers })
    });

    const result = await response.json();

    // Hide loading
    formEl.style.display = 'block';
    loadingEl.style.display = 'none';

    if (result.success) {
      closeIdeaValidationModal();

      let overallLine = `Overall Validation Score: Pending`;
      try {
        const startup = await api.getStartup();
        const completedCount = VALIDATION_STAGES
          .map(s => startup?.validationStages?.[s.key])
          .filter(v => v && v.completedAt)
          .length;
        const allCompleted = completedCount === VALIDATION_STAGES.length;

        overallLine = allCompleted
          ? `Overall Validation Score: ${startup.validationScore}%`
          : `Overall Validation Score: Pending (${completedCount}/${VALIDATION_STAGES.length} stages completed)`;
      } catch (_) {}

      const message = result.isValidated
        ? `✓ Stage Validated (${result.validationScore}%)\n\n${overallLine}`
        : `Stage Score: ${result.validationScore}% (need 70%)\n\n${overallLine}`;

      alert(message);

      loadStages();
      loadDashboard();
    } else {
      alert(`Error: ${result.message || 'Validation failed'}`);
    }
  } catch (error) {
    formEl.style.display = 'block';
    loadingEl.style.display = 'none';
    console.error('Error submitting validation:', error);
    alert('Failed to submit validation');
  }
}

function closeIdeaValidationModal() {
  document.getElementById('idea-validation-modal').classList.remove('active');
}

async function showStageValidationResults(stageKey) {
  try {
    const startup = await api.getStartup();
    const rec = startup?.validationStages?.[stageKey];

    if (!rec || !rec.completedAt) {
      alert('No results yet for this stage.');
      return;
    }

    const lines = [];
    lines.push(`${VALIDATION_STAGES.find(s => s.key === stageKey)?.title || stageKey}`);
    lines.push(`Stage Score: ${rec.score}%`);
    lines.push(`Completed: ${new Date(rec.completedAt).toLocaleDateString()}`);

    const completedCount = VALIDATION_STAGES
      .map(s => startup?.validationStages?.[s.key])
      .filter(v => v && v.completedAt)
      .length;
    const allCompleted = completedCount === VALIDATION_STAGES.length;

    lines.push(allCompleted
      ? `Overall Validation Score: ${startup.validationScore}%`
      : `Overall Validation Score: Pending (${completedCount}/${VALIDATION_STAGES.length} stages completed)`);

    lines.push('');

    (rec.answers || []).forEach((a, idx) => {
      const short = (a.answer || '').replace(/\s+/g, ' ').slice(0, 120);
      lines.push(`Q${idx + 1} (${a.score}%): ${short}${(a.answer || '').length > 120 ? '...' : ''}`);
    });

    alert(lines.join('\n'));
  } catch (error) {
    console.error('Failed to load results:', error);
    alert('Failed to load results');
  }
}

// ============= END VALIDATION =============

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('idea-validation-modal').classList.contains('active')) {
    closeIdeaValidationModal();
  }
});

// Close modal on outside click
document.getElementById('idea-validation-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('idea-validation-modal')) {
    closeIdeaValidationModal();
  }
});