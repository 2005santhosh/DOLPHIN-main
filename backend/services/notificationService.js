// backend/services/notificationService.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotificationToUser, sendNotificationToRole, broadcastNotification } = require('./socketService');

/**
 * Create and send a notification
 */
async function createNotification({
  userId,
  type,
  title,
  message,
  data = {},
  priority = 'medium',
  actionUrl = null,
  actionText = null,
  expiresAt = null,
  sendRealtime = true,
  sentBy = null,
  targetRole = null
}) {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      expiresAt,
      sentBy,
      targetRole
    });

    // Send real-time notification if enabled
    if (sendRealtime) {
      sendNotificationToUser(userId, {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        createdAt: notification.createdAt,
        read: false
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Send notification to multiple users by role
 */
async function sendNotificationByRole({
  role,
  type,
  title,
  message,
  data = {},
  priority = 'medium',
  actionUrl = null,
  actionText = null,
  sentBy = null
}) {
  try {
    // Get all users with this role
    const users = await User.find({ role }).select('_id');
    const userIds = users.map(u => u._id);

    if (userIds.length === 0) {
      return { count: 0, message: 'No users found with this role' };
    }

    // Create notifications for all users
    const notifications = await Notification.createBulkNotifications(userIds, {
      type,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      sentBy,
      targetRole: role
    });

    // Send real-time notifications to all users with this role
    sendNotificationToRole(role, {
      type,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      createdAt: new Date(),
      read: false
    });

    return {
      count: notifications.length,
      message: `Notification sent to ${notifications.length} ${role}s`
    };
  } catch (error) {
    console.error('Error sending notification by role:', error);
    throw error;
  }
}

/**
 * Send notification to all users
 */
async function sendNotificationToAll({
  type,
  title,
  message,
  data = {},
  priority = 'medium',
  actionUrl = null,
  actionText = null,
  sentBy = null
}) {
  try {
    const users = await User.find().select('_id');
    const userIds = users.map(u => u._id);

    if (userIds.length === 0) {
      return { count: 0, message: 'No users found' };
    }

    const notifications = await Notification.createBulkNotifications(userIds, {
      type,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      sentBy,
      targetRole: 'all'
    });

    // Broadcast to all connected users
    broadcastNotification({
      type,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      createdAt: new Date(),
      read: false
    });

    return {
      count: notifications.length,
      message: `Notification sent to all ${notifications.length} users`
    };
  } catch (error) {
    console.error('Error sending notification to all:', error);
    throw error;
  }
}

/**
 * Send custom admin message to specific users
 */
async function sendAdminMessage({
  userIds,
  title,
  message,
  priority = 'high',
  actionUrl = null,
  actionText = null,
  sentBy
}) {
  try {
    const notifications = [];

    for (const userId of userIds) {
      const notification = await createNotification({
        userId,
        type: 'CUSTOM_ADMIN_MESSAGE',
        title: `📢 ${title}`,
        message,
        priority,
        actionUrl,
        actionText,
        sentBy
      });
      notifications.push(notification);
    }

    return {
      count: notifications.length,
      message: `Admin message sent to ${notifications.length} user(s)`
    };
  } catch (error) {
    console.error('Error sending admin message:', error);
    throw error;
  }
}

/**
 * Send validation completion notification
 */
async function notifyValidationComplete(userId, stageKey, score, isValidated, startupId) {
  const stageNames = {
    idea: 'Idea Validation',
    problem: 'Problem Definition',
    solution: 'Solution Development',
    market: 'Market Validation',
    business: 'Business Model Validation'
  };

  const stageName = stageNames[stageKey] || stageKey;

  return createNotification({
    userId,
    type: 'VALIDATION_COMPLETE',
    title: isValidated ? `✅ ${stageName} Validated!` : `📊 ${stageName} Completed`,
    message: isValidated 
      ? `Congratulations! You scored ${score}% on ${stageName}. You can now proceed to the next stage.`
      : `You scored ${score}% on ${stageName}. You need 70% to pass. Review your answers and try again.`,
    data: {
      stageKey,
      stageName,
      score,
      isValidated,
      startupId
    },
    priority: isValidated ? 'high' : 'medium',
    actionUrl: '/stages',
    actionText: isValidated ? 'Continue to Next Stage' : 'Review & Retry'
  });
}

/**
 * Send stage unlocked notification
 */
async function notifyStageUnlocked(userId, stageKey, startupId) {
  const stageNames = {
    problem: 'Problem Definition',
    solution: 'Solution Development',
    market: 'Market Validation',
    business: 'Business Model Validation'
  };

  const stageName = stageNames[stageKey];
  if (!stageName) return;

  return createNotification({
    userId,
    type: 'STAGE_UNLOCKED',
    title: `🔓 New Stage Unlocked!`,
    message: `You can now start ${stageName}. Complete this stage to continue your validation journey.`,
    data: {
      stageKey,
      stageName,
      startupId
    },
    priority: 'high',
    actionUrl: '/stages',
    actionText: 'Start Stage'
  });
}

/**
 * Send task approval notification
 */
async function notifyTaskApproved(userId, taskTitle, milestoneTitle, startupId) {
  return createNotification({
    userId,
    type: 'TASK_APPROVED',
    title: '✅ Task Approved',
    message: `Your task "${taskTitle}" for milestone "${milestoneTitle}" has been approved by admin.`,
    data: {
      taskTitle,
      milestoneTitle,
      startupId
    },
    priority: 'medium',
    actionUrl: '/dashboard',
    actionText: 'View Dashboard'
  });
}

/**
 * Send task rejection notification
 */
async function notifyTaskRejected(userId, taskTitle, reason, startupId) {
  return createNotification({
    userId,
    type: 'TASK_REJECTED',
    title: '❌ Task Needs Revision',
    message: `Your task "${taskTitle}" needs revision. Reason: ${reason}`,
    data: {
      taskTitle,
      reason,
      startupId
    },
    priority: 'high',
    actionUrl: '/dashboard',
    actionText: 'Revise Task'
  });
}

/**
 * Send milestone verified notification
 */
async function notifyMilestoneVerified(userId, milestoneTitle, startupId) {
  return createNotification({
    userId,
    type: 'MILESTONE_VERIFIED',
    title: '🎉 Milestone Verified!',
    message: `Your milestone "${milestoneTitle}" has been verified. Great progress!`,
    data: {
      milestoneTitle,
      startupId
    },
    priority: 'high',
    actionUrl: '/dashboard',
    actionText: 'View Progress'
  });
}

/**
 * Get user's notifications
 */
async function getUserNotifications(userId, { limit = 50, skip = 0, unreadOnly = false } = {}) {
  const query = { userId };
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('sentBy', 'name email role')
    .lean();

  // FIX: Use standard Mongoose countDocuments instead of custom static method
  const unreadCount = await Notification.countDocuments({ userId, read: false });

  return {
    notifications,
    unreadCount,
    hasMore: notifications.length === limit
  };
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  // FIX: Manually set property and save (standard Mongoose)
  // This avoids the "method not found" error
  notification.read = true;
  await notification.save();
  
  return notification;
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId) {
  // FIX: Use standard updateMany instead of custom static method
  const result = await Notification.updateMany(
    { userId, read: false }, 
    { $set: { read: true } }
  );

  return { success: true, modifiedCount: result.modifiedCount };
}
/**
 * Delete notification
 */
async function deleteNotification(notificationId, userId) {
  const result = await Notification.deleteOne({
    _id: notificationId,
    userId
  });

  if (result.deletedCount === 0) {
    throw new Error('Notification not found');
  }

  return { success: true };
}

module.exports = {
  createNotification,
  sendNotificationByRole,
  sendNotificationToAll,
  sendAdminMessage,
  notifyValidationComplete,
  notifyStageUnlocked,
  notifyTaskApproved,
  notifyTaskRejected,
  notifyMilestoneVerified,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};