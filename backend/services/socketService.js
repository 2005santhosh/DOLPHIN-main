// backend/services/socketService.js
// Real-time notification service using Socket.io

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); // userId -> Set of socket IDs

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 */
function initializeSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

            // Add fallback secret 'your-secret-key'
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
      
      // Support both 'id' (correct) and fallback just in case
      socket.userId = decoded.id || decoded.userId; 
      socket.userRole = decoded.role;
      
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.id})`);

    // Track user's socket connections
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Join role-specific room
    socket.join(`role:${socket.userRole}`);

    // Handle custom events
    socket.on('subscribe:startup', (startupId) => {
      socket.join(`startup:${startupId}`);
      console.log(`User ${socket.userId} subscribed to startup ${startupId}`);
    });

    socket.on('unsubscribe:startup', (startupId) => {
      socket.leave(`startup:${startupId}`);
      console.log(`User ${socket.userId} unsubscribed from startup ${startupId}`);
    });

    socket.on('mark_notification_read', async ({ notificationId }) => {
      try {
        // Update notification in database
        const Notification = require('../models/Notification');
        await Notification.findByIdAndUpdate(notificationId, { read: true });
        
        // Emit confirmation
        socket.emit('notification_marked_read', { notificationId });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId} (${socket.id})`);
      
      const sockets = userSockets.get(socket.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);
        }
      }
    });
  });

  return io;
}

/**
 * Send notification to specific user
 * @param {String} userId - User ID
 * @param {Object} notification - Notification data
 */
function sendNotificationToUser(userId, notification) {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  io.to(`user:${userId}`).emit('notification', notification);
  console.log(`Sent notification to user ${userId}:`, notification.title);
}

/**
 * Send notification to all users with specific role
 * @param {String} role - User role (founder, admin, provider, investor)
 * @param {Object} notification - Notification data
 */
function sendNotificationToRole(role, notification) {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  io.to(`role:${role}`).emit('notification', notification);
  console.log(`Sent notification to role ${role}:`, notification.title);
}

/**
 * Send notification about startup to all subscribers
 * @param {String} startupId - Startup ID
 * @param {Object} notification - Notification data
 */
function sendNotificationToStartup(startupId, notification) {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  io.to(`startup:${startupId}`).emit('notification', notification);
  console.log(`Sent notification to startup ${startupId}:`, notification.title);
}

/**
 * Broadcast notification to all connected users
 * @param {Object} notification - Notification data
 */
function broadcastNotification(notification) {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }

  io.emit('notification', notification);
  console.log('Broadcasted notification:', notification.title);
}

/**
 * Check if user is currently online
 * @param {String} userId - User ID
 * @returns {Boolean}
 */
function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Get count of online users
 * @returns {Number}
 */
function getOnlineUsersCount() {
  return userSockets.size;
}

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToRole,
  sendNotificationToStartup,
  broadcastNotification,
  isUserOnline,
  getOnlineUsersCount
};