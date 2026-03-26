const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');
const { getAdminNotificationEmail } = require('../utils/emailTemplates');

// Helper to get Socket.IO instance
const getSocketIO = (req) => req.app.get('socketio');

// @route   GET /api/admin/admin-notifications/users
// @desc    Get all users for selection dropdown
// @access  Admin
router.get('/users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const users = await User.find().select('name email role');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/admin-notifications/send-by-role
// @desc    Send notification to all users of a specific role
// @access  Admin
router.post('/send-by-role', protect, authorize('admin', 'investor'), async (req, res) => {
  const { role, title, message, priority, actionUrl, actionText } = req.body;

  try {
    const users = await User.find({ role });
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'No users found with this role' });
    }

    // 1. Save Notifications to DB
    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      priority,
      actionUrl,
      actionText,
      type: 'system'
    }));
    await Notification.insertMany(notifications);

    // 2. Send Emails (Run in background to avoid delay)
    users.forEach(user => {
      const emailTemplate = getAdminNotificationEmail(title, message);
      sendEmail({
        email: user.email,
        subject: emailTemplate.subject,
        message: emailTemplate.html
      }).catch(err => console.error(`Email failed for ${user.email}:`, err));
    });

    // 3. Real-time Socket emission
    const io = getSocketIO(req);
    if (io) {
      users.forEach(user => {
        io.to(user._id.toString()).emit('new-notification', { title, message, priority });
      });
    }

    res.json({ success: true, message: `Notification sent to ${users.length} ${role}(s)` });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/admin-notifications/send-to-all
// @desc    Broadcast notification to all users
// @access  Admin
router.post('/send-to-all', protect, authorize('admin', 'investor'), async (req, res) => {
  const { title, message, priority, actionUrl, actionText } = req.body;

  try {
    const users = await User.find();
    
    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      priority,
      actionUrl,
      actionText,
      type: 'system'
    }));

    await Notification.insertMany(notifications);

    // Send Emails
    users.forEach(user => {
      const emailTemplate = getAdminNotificationEmail(title, message);
      sendEmail({
        email: user.email,
        subject: emailTemplate.subject,
        message: emailTemplate.html
      }).catch(err => console.error(`Email failed for ${user.email}:`, err));
    });

    // Real-time emission
    const io = getSocketIO(req);
    if (io) {
      io.emit('new-notification', { title, message, priority });
    }

    res.json({ success: true, message: `Broadcast sent to ${users.length} users` });
  } catch (error) {
    console.error('Error broadcasting:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/admin-notifications/send-to-users
// @desc    Send notification to specific users
// @access  Admin
router.post('/send-to-users', protect, authorize('admin', 'investor'), async (req, res) => {
  const { userIds, title, message, priority } = req.body;

  if (!userIds || userIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No users selected' });
  }

  try {
    // Fetch actual users to get their email addresses
    const users = await User.find({ _id: { $in: userIds } });

    const notifications = users.map(user => ({
      userId: user._id,
      title,
      message,
      priority,
      type: 'system'
    }));

    await Notification.insertMany(notifications);

    // Send Emails
    users.forEach(user => {
      const emailTemplate = getAdminNotificationEmail(title, message);
      sendEmail({
        email: user.email,
        subject: emailTemplate.subject,
        message: emailTemplate.html
      }).catch(err => console.error(`Email failed for ${user.email}:`, err));
    });

    // Real-time emission
    const io = getSocketIO(req);
    if (io) {
      userIds.forEach(userId => {
        io.to(userId).emit('new-notification', { title, message, priority });
      });
    }

    res.json({ success: true, message: `Notification sent to ${userIds.length} user(s)` });
  } catch (error) {
    console.error('Error sending to users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;