const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
     type: {
    type: String,
    enum: [
      'INFO', 
      'WARNING', 
      'SUCCESS', 
      'ERROR', 
      'INTRODUCTION_REQUEST', 
      'STAGE_UNLOCKED', // ✅ ADD THIS
      'TASK_COMPLETED'  // Optional: add this if you use it elsewhere
    ],
    default: 'INFO'
  }},
  read: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  actionUrl: {
    type: String
  },
  actionText: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
});

// ✅ ADD THIS STATIC METHOD
NotificationSchema.statics.getUnreadCount = async function(userId) {
  const count = await this.countDocuments({ userId, read: false });
  return count;
};

// Optional: Add a method to delete old notifications
NotificationSchema.statics.deleteOldNotifications = async function(daysOld) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  return this.deleteMany({ createdAt: { $lt: cutoff } });
};
NotificationSchema.methods.markAsRead = function() {
  this.read = true;
  return this.save();
};
module.exports = mongoose.model('Notification', NotificationSchema);