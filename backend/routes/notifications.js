// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../services/notificationService');

// @route   GET /api/notifications
// @desc    Get all notifications for the current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ 
      success: true, 
      notifications 
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// backend/routes/notifications.js
router.get('/unread-count', protect, async (req, res) => {
  try {
    // This now matches the static method we added to the model
    const count = await Notification.getUnreadCount(req.user.id);
    
    res.json({ 
      success: true, 
      count 
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all read:', error);
    res.status(500).json({ message: 'Server error' });
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
// @access  Private
router.delete('/clear', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });

    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Server error' });
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