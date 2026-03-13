// frontend/js/socket-client.js
// Real-time notification client using Socket.io

let socket = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
// const API_URL = "https://dolphin-main-production.up.railway.app/api";
/**
 * Initialize Socket.io connection
 */
function initializeSocket() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.warn('No auth token found, skipping socket connection');
    return;
  }

  // Connect to Socket.io server
  const serverUrl = "https://api.dolphinorg.in";
  
  socket = io(serverUrl, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✓ Socket.io connected');
    isConnected = true;
    reconnectAttempts = 0;
    updateConnectionStatus(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('✗ Socket.io disconnected:', reason);
    isConnected = false;
    updateConnectionStatus(false);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error.message);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      socket.close();
    }
  });

  // Notification events
  socket.on('notification', (notification) => {
    console.log('📬 Received notification:', notification);
    handleNotification(notification);
  });

  socket.on('notification_marked_read', ({ notificationId }) => {
    console.log('✓ Notification marked as read:', notificationId);
    updateNotificationUI(notificationId, true);
  });

  return socket;
}

/**
 * Handle incoming notification
 */
function handleNotification(notification) {
  // Update notification badge
  updateNotificationBadge();
  
  // Show toast notification
  showToastNotification(notification);
  
  // Add to notification list if on notifications page
  addNotificationToList(notification);
  
  // Play notification sound (optional)
  playNotificationSound();
}

/**
 * Show toast notification
 */
function showToastNotification(notification) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `notification-toast notification-${notification.priority || 'medium'}`;
  toast.innerHTML = `
    <div class="notification-toast-icon">
      ${getNotificationIcon(notification.type)}
    </div>
    <div class="notification-toast-content">
      <div class="notification-toast-title">${notification.title}</div>
      <div class="notification-toast-message">${notification.message}</div>
    </div>
    <button class="notification-toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  // Add click handler
  if (notification.actionUrl) {
    toast.style.cursor = 'pointer';
    toast.onclick = (e) => {
      if (!e.target.classList.contains('notification-toast-close')) {
        window.location.href = notification.actionUrl;
        toast.remove();
      }
    };
  }

  // Add to DOM
  let container = document.getElementById('notification-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-toast-container';
    container.className = 'notification-toast-container';
    document.body.appendChild(container);
  }
  
  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('notification-toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type) {
  const icons = {
    'VALIDATION_COMPLETE': '✅',
    'STAGE_UNLOCKED': '🔓',
    'TASK_APPROVED': '✅',
    'TASK_REJECTED': '❌',
    'MILESTONE_VERIFIED': '🎉',
    'ADMIN_MESSAGE': '📢',
    'SYSTEM_UPDATE': 'ℹ️',
    'PROVIDER_MATCHED': '🤝',
    'INVESTOR_INTEREST': '💰',
    'FEEDBACK_RECEIVED': '💬'
  };
  
  return icons[type] || '🔔';
}

/**
 * Update notification badge count
 */
async function updateNotificationBadge() {
  try {
    const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const badge = document.querySelector('.notification-badge');
      if (badge) {
        badge.textContent = data.count;
        badge.style.display = data.count > 0 ? 'flex' : 'none';
      }
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

/**
 * Add notification to list (if on notifications page)
 */
function addNotificationToList(notification) {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;

  const notificationElement = createNotificationElement(notification);
  notificationsList.insertBefore(notificationElement, notificationsList.firstChild);
}

/**
 * Create notification element
 */
function createNotificationElement(notification) {
  const div = document.createElement('div');
  div.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
  div.dataset.notificationId = notification.id;
  
  div.innerHTML = `
    <div class="notification-icon">${getNotificationIcon(notification.type)}</div>
    <div class="notification-content">
      <div class="notification-title">${notification.title}</div>
      <div class="notification-message">${notification.message}</div>
      <div class="notification-time">${formatTimestamp(notification.createdAt)}</div>
    </div>
    ${notification.actionUrl ? `
      <button class="notification-action" onclick="window.location.href='${notification.actionUrl}'">
        ${notification.actionText || 'View'}
      </button>
    ` : ''}
    <button class="notification-mark-read" onclick="markNotificationAsRead('${notification.id}')">
      ${notification.read ? '✓' : '○'}
    </button>
  `;
  
  return div;
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
  try {
    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateNotificationUI(notificationId, true);
      updateNotificationBadge();
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

/**
 * Update notification UI
 */
function updateNotificationUI(notificationId, read) {
  const element = document.querySelector(`[data-notification-id="${notificationId}"]`);
  if (element) {
    if (read) {
      element.classList.remove('unread');
      element.classList.add('read');
      const markReadBtn = element.querySelector('.notification-mark-read');
      if (markReadBtn) markReadBtn.textContent = '✓';
    } else {
      element.classList.remove('read');
      element.classList.add('unread');
      const markReadBtn = element.querySelector('.notification-mark-read');
      if (markReadBtn) markReadBtn.textContent = '○';
    }
  }
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  // Check if user has sound enabled in settings
  const soundEnabled = localStorage.getItem('notificationSound') !== 'false';
  
  if (soundEnabled) {
    const audio = new Audio('data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YW4AAAAAAAAAAgACAAIAAgA=');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore if autoplay is blocked
    });
  }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  const indicator = document.getElementById('socket-status');
  if (indicator) {
    indicator.className = connected ? 'socket-connected' : 'socket-disconnected';
    indicator.title = connected ? 'Real-time notifications active' : 'Reconnecting...';
  }
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Older
  return date.toLocaleDateString();
}

/**
 * Subscribe to startup notifications
 */
function subscribeToStartup(startupId) {
  if (socket && isConnected) {
    socket.emit('subscribe:startup', startupId);
  }
}

/**
 * Unsubscribe from startup notifications
 */
function unsubscribeFromStartup(startupId) {
  if (socket && isConnected) {
    socket.emit('unsubscribe:startup', startupId);
  }
}

/**
 * Disconnect socket
 */
function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    initializeSocket();
    updateNotificationBadge();
  }
});

// Cleanup on logout
window.addEventListener('beforeunload', () => {
  if (socket) {
    socket.disconnect();
  }
});