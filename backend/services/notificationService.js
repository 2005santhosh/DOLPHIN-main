// backend/services/notificationService.js
const Notification = require('../models/Notification');
const { sendNotificationToUser, sendNotificationToRole } = require('./socketService');

/**
 * Create and send a notification
 * @param {Object} params - Notification parameters
 * @returns {Promise<Object>} Created notification
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
  sendRealtime = true
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
      expiresAt
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
 * Send admin message notification
 */
async function notifyAdminMessage(userId, title, message, actionUrl = null) {
  return createNotification({
    userId,
    type: 'ADMIN_MESSAGE',
    title: `📢 ${title}`,
    message,
    data: {},
    priority: 'high',
    actionUrl,
    actionText: actionUrl ? 'View Details' : null
  });
}

/**
 * Send system update notification
 */
async function notifySystemUpdate(title, message) {
  // This should be sent to all users
  // In practice, you'd query all user IDs and send to each
  return {
    type: 'SYSTEM_UPDATE',
    title,
    message,
    priority: 'medium'
  };
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
    .lean();

  const unreadCount = await Notification.getUnreadCount(userId);

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

  return notification.markAsRead();
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId) {
  return Notification.markAllAsRead(userId);
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
  notifyValidationComplete,
  notifyStageUnlocked,
  notifyTaskApproved,
  notifyTaskRejected,
  notifyMilestoneVerified,
  notifyAdminMessage,
  notifySystemUpdate,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};