// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../services/notificationService');

// Get user's notifications
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;
    
    const result = await getUserNotifications(req.user.id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const count = await Notification.getUnreadCount(req.user.id);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', protect, async (req, res) => {
  try {
    await markAsRead(req.params.notificationId, req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

// Mark all notifications as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read'
    });
  }
});

// Delete notification
router.delete('/:notificationId', protect, async (req, res) => {
  try {
    await deleteNotification(req.params.notificationId, req.user.id);

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;