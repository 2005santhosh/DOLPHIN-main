// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const {
  markAsRead,
  deleteNotification,
} = require('../services/notificationService');

// @route   GET /api/notifications
// @desc    Get all notifications for the current user (latest 50)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read (SINGLE definition — no duplicate)
// @access  Private
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

// @route   PUT /api/notifications/:notificationId/read
// @desc    Mark single notification as read
// @access  Private
router.put('/:notificationId/read', protect, async (req, res) => {
  try {
    await markAsRead(req.params.notificationId, req.user.id);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/notifications/clear
// @desc    Clear all notifications for the current user
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

// @route   DELETE /api/notifications/:notificationId
// @desc    Delete a single notification
// @access  Private
router.delete('/:notificationId', protect, async (req, res) => {
  try {
    await deleteNotification(req.params.notificationId, req.user.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(error.message === 'Notification not found' ? 404 : 500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
