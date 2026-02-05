// backend/routes/admin-notifications.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  sendNotificationByRole,
  sendNotificationToAll,
  sendAdminMessage
} = require('../services/notificationService');
const User = require('../models/User');

// Send notification to specific role
router.post('/send-by-role', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const { role, title, message, priority, actionUrl, actionText } = req.body;

    if (!role || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Role, title, and message are required'
      });
    }

    const validRoles = ['founder', 'investor', 'provider', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const result = await sendNotificationByRole({
      role,
      type: 'ADMIN_MESSAGE',
      title,
      message,
      priority: priority || 'high',
      actionUrl,
      actionText,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error sending notification by role:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification'
    });
  }
});

// Send notification to all users
router.post('/send-to-all', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const { title, message, priority, actionUrl, actionText } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const result = await sendNotificationToAll({
      type: 'SYSTEM_UPDATE',
      title,
      message,
      priority: priority || 'medium',
      actionUrl,
      actionText,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error sending notification to all:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification'
    });
  }
});

// Send notification to specific users
router.post('/send-to-users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const { userIds, title, message, priority, actionUrl, actionText } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds must be a non-empty array'
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const result = await sendAdminMessage({
      userIds,
      title,
      message,
      priority: priority || 'high',
      actionUrl,
      actionText,
      sentBy: req.user.id
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error sending notification to users:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification'
    });
  }
});

// Get all users for notification targeting
router.get('/users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const { role } = req.query;
    
    const query = role ? { role } : {};
    const users = await User.find(query)
      .select('_id name email role state')
      .sort({ name: 1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

module.exports = router;