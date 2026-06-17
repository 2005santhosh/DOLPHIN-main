const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');
const Log = require('../models/Log');

// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY routes — accessible by both admin and investor
// ─────────────────────────────────────────────────────────────────────────────

// ─── One-time migration: grant lifetime founder badge to all existing verified users ───
// Run this once after deploying. Safe to run multiple times (idempotent).
router.post('/migrate-founder-badges', protect, authorize('admin'), async (req, res) => {
  try {
    // Find all users who have isVerified=true but isFounderVerified=false
    // These are users verified by admin before the payment system existed
    const result = await User.updateMany(
      { isVerified: true, isFounderVerified: { $ne: true } },
      { $set: { isFounderVerified: true } }
    );
    console.log(`[Migration] Granted lifetime founder badge to ${result.modifiedCount} users`);
    res.json({
      success: true,
      message: `Granted lifetime verified badge to ${result.modifiedCount} existing verified users.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ message: 'Migration failed', error: error.message });
  }
});

// Grant verified badge to a specific user (admin action)
router.post('/grant-verified-badge', protect, authorize('admin'), async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId is required' });
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { isVerified: true, isFounderVerified: true, verifiedAt: new Date() } },
      { new: true }
    ).select('name email isVerified isFounderVerified');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, message: `Lifetime verified badge granted to ${user.name}`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (read-only — investors can view but not modify)
// Paginated to prevent loading thousands of records at once
router.get('/users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('name email role state stage isVerified verifiedSource verifiedUntil createdAt profilePicture rewardPoints leaderboardScore')
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all startups
router.get('/startups', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const startups = await Startup.find()
      .populate('founderId', 'name email state stage')
      .populate('auditLogs');
    res.json(startups);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all providers
router.get('/providers', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const providers = await Provider.find()
      .populate('userId', 'name email state stage');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard stats
router.get('/dashboard', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const pendingUsers = await User.countDocuments({ state: 'PENDING_APPROVAL' });
    const blockedUsers = await User.countDocuments({ state: 'BLOCKED' });
    const activeUsers = totalUsers - pendingUsers - blockedUsers;

    const pendingProviders = await Provider.countDocuments({ verified: false });
    const verifiedProviders = await Provider.countDocuments({ verified: true });

    const totalStartups = await Startup.countDocuments({});
    const validatedStartups = await Startup.countDocuments({ validationScore: { $gte: 70 } });

    const pendingTaskSubmissions = await Startup.aggregate([
      { $unwind: '$milestones' },
      { $unwind: '$milestones.taskSubmissions' },
      { $match: { 'milestones.taskSubmissions.status': 'Submitted' } },
      { $count: 'total' }
    ]);

    const tasksCount = pendingTaskSubmissions.length > 0 ? pendingTaskSubmissions[0].total : 0;

    res.json({
      users: {
        pending: pendingUsers,
        approved: activeUsers,
        blocked: blockedUsers,
        total: totalUsers
      },
      providers: {
        pending: pendingProviders,
        verified: verifiedProviders,
        total: pendingProviders + verifiedProviders
      },
      startups: {
        validated: validatedStartups,
        total: totalStartups,
        percentage: totalStartups > 0 ? ((validatedStartups / totalStartups) * 100).toFixed(1) : 0
      },
      tasks: {
        pendingReview: tasksCount
      }
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending users
router.get('/pending-users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const users = await User.find({ state: 'PENDING_APPROVAL' }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending providers
router.get('/pending-providers', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const providers = await Provider.find({ verified: false })
      .populate('userId', 'name email state stage');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pending task submissions
router.get('/pending-tasks', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const startups = await Startup.find()
      .populate('founderId', 'name email')
      .populate('auditLogs');

    const pendingTasks = [];
    startups.forEach(startup => {
      startup.milestones.forEach((milestone, mIdx) => {
        if (milestone.taskSubmissions) {
          milestone.taskSubmissions.forEach((task) => {
            if (task.status === 'Submitted') {
              pendingTasks.push({
                taskId: task._id,
                startupId: startup._id,
                startupName: startup.name,
                founder: startup.founderId,
                milestoneIndex: mIdx,
                milestoneName: milestone.title,
                taskTitle: task.title,
                taskDescription: task.description,
                submittedAt: task.submittedAt,
                evidence: task.evidence
              });
            }
          });
        }
      });
    });

    res.json(pendingTasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WRITE/MODIFY routes — ADMIN ONLY (investors cannot modify users or data)
// ─────────────────────────────────────────────────────────────────────────────

// Approve user — admin only
router.post('/approve-user', protect, authorize('admin'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.state = 'STAGE_1';
    user.stage = 1;
    await user.save();

    if (user.role === 'founder') {
      await Startup.updateOne({ founderId: user._id }, { $set: { currentStage: 1 } });
    }

    await Log.create({
      userId: req.user.id,
      action: 'user_approved',
      details: { targetUserId: userId }
    });

    res.json({
      message: 'User approved successfully',
      user,
      nextSteps: 'User can now access the platform'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject user — admin only
router.post('/reject-user', protect, authorize('admin'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.state = 'BLOCKED';
    await user.save();

    await Log.create({
      userId: req.user.id,
      action: 'user_rejected',
      details: { targetUserId: userId }
    });

    res.json({
      message: 'User rejected successfully',
      user,
      nextSteps: 'User has been blocked from the platform'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block user — admin only
router.post('/block-user', protect, authorize('admin'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.state = 'BLOCKED';
    await user.save();

    await Log.create({
      userId: req.user.id,
      action: 'user_blocked',
      details: { targetUserId: userId }
    });

    res.json({
      message: 'User blocked successfully',
      user,
      nextSteps: 'User has been blocked from the platform'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Move user to next stage — admin only
router.post('/move-stage', protect, authorize('admin'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.state === 'PENDING_APPROVAL') {
      return res.status(400).json({ message: 'User must be approved to advance stage' });
    }

    if (user.state === 'BLOCKED') {
      return res.status(400).json({ message: 'Blocked users cannot be advanced' });
    }

    const MAX_STAGE = 5;
    const currentStage = user.stage || 0;

    if (currentStage >= MAX_STAGE) {
      return res.status(400).json({ message: 'User is already at the maximum stage' });
    }

    if (user.role === 'founder' && currentStage >= 1) {
      const startup = await Startup.findOne({ founderId: user._id });
      if (startup) {
        const milestone = startup.milestones?.find(m => m.order === currentStage);
        if (milestone && !milestone.verified) {
          return res.status(400).json({
            message: 'Cannot advance stage: current stage milestone not verified',
            nextSteps: `Stage ${currentStage} requires admin verification before advancing`
          });
        }
      }
    }

    user.stage = Math.max(1, currentStage + 1);
    user.state = `STAGE_${user.stage}`;
    await user.save();

    if (user.role === 'founder') {
      await Startup.updateOne({ founderId: user._id }, { $set: { currentStage: user.stage } });
    }

    await Log.create({
      userId: req.user.id,
      action: 'user_moved_stage',
      details: { targetUserId: userId, newStage: user.stage }
    });

    res.json({
      message: 'User moved to next stage successfully',
      user,
      nextSteps: 'User can now access the next stage features'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify provider — admin only
router.post('/verify-provider', protect, authorize('admin'), async (req, res) => {
  const { providerId } = req.body;

  if (!providerId) {
    return res.status(400).json({ message: 'providerId is required' });
  }

  try {
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    provider.verified = true;
    await provider.save();

    await Log.create({
      userId: req.user.id,
      action: 'provider_verified',
      details: { targetProviderId: providerId, providerName: provider.name }
    });

    res.json({
      message: 'Provider verified successfully',
      provider,
      nextSteps: 'Provider can now appear in founder discovery'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject provider — admin only
router.post('/reject-provider', protect, authorize('admin'), async (req, res) => {
  const { providerId } = req.body;

  if (!providerId) {
    return res.status(400).json({ message: 'providerId is required' });
  }

  try {
    const provider = await Provider.findByIdAndDelete(providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    await Log.create({
      userId: req.user.id,
      action: 'provider_rejected',
      details: { targetProviderId: providerId, providerName: provider.name }
    });

    res.json({
      message: 'Provider rejected successfully',
      nextSteps: 'Provider profile has been removed'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve milestone task — admin only
router.post('/approve-task', protect, authorize('admin'), async (req, res) => {
  const { startupId, milestoneIndex, taskId, notes } = req.body;

  if (!startupId || milestoneIndex === undefined || !taskId) {
    return res.status(400).json({ message: 'startupId, milestoneIndex, and taskId are required' });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) return res.status(404).json({ message: 'Startup not found' });

    const milestone = startup.milestones[milestoneIndex];
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const task = milestone.taskSubmissions.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'Approved';
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.reviewNotes = notes || '';

    const allApproved = milestone.taskSubmissions.every(t => t.status === 'Approved');
    if (allApproved) {
      milestone.verified = true;
      milestone.isCompleted = true;
    }

    await startup.save();

    await Log.create({
      userId: req.user.id,
      action: 'task_approved',
      details: { startupId, taskTitle: task.title, milestoneName: milestone.title }
    });

    const completedMilestones = startup.milestones.filter(m => m.verified).length;
    startup.validationScore = Math.round((completedMilestones / startup.milestones.length) * 100);
    await startup.save();

    res.json({
      message: 'Task approved successfully',
      startup,
      validationScore: startup.validationScore,
      nextSteps: allApproved ? 'Milestone completed! Founder can now advance to next stage.' : 'Waiting for other tasks in this milestone'
    });
  } catch (error) {
    console.error('Error approving task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject milestone task — admin only
router.post('/reject-task', protect, authorize('admin'), async (req, res) => {
  const { startupId, milestoneIndex, taskId, notes } = req.body;

  if (!startupId || milestoneIndex === undefined || !taskId || !notes) {
    return res.status(400).json({ message: 'startupId, milestoneIndex, taskId, and notes are required' });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) return res.status(404).json({ message: 'Startup not found' });

    const milestone = startup.milestones[milestoneIndex];
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    const task = milestone.taskSubmissions.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.status = 'Rejected';
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.reviewNotes = notes;

    await startup.save();

    await Log.create({
      userId: req.user.id,
      action: 'task_rejected',
      details: { startupId, taskTitle: task.title, reason: notes }
    });

    res.json({
      message: 'Task rejected successfully',
      startup,
      nextSteps: 'Founder has been notified and can resubmit with corrections'
    });
  } catch (error) {
    console.error('Error rejecting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Advance founder to next stage — admin only
router.post('/advance-founder-stage', protect, authorize('admin'), async (req, res) => {
  const { startupId } = req.body;

  if (!startupId) {
    return res.status(400).json({ message: 'startupId is required' });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) return res.status(404).json({ message: 'Startup not found' });

    const currentStage = startup.currentStage;
    const currentMilestones = startup.milestones.filter(m => m.order === currentStage);
    const allVerified = currentMilestones.length > 0 && currentMilestones.every(m => m.verified);

    if (!allVerified) {
      return res.status(400).json({
        message: 'Not all milestones in current stage have been verified',
        nextSteps: 'Ensure all current stage milestones are approved first'
      });
    }

    const MAX_STAGE = 5;
    if (startup.currentStage >= MAX_STAGE) {
      return res.status(400).json({ message: `Startup is already at the maximum stage (${MAX_STAGE})` });
    }

    startup.currentStage += 1;
    await startup.save();

    await Log.create({
      userId: req.user.id,
      action: 'founder_advanced_stage',
      details: { startupId, newStage: startup.currentStage }
    });

    res.json({
      message: 'Founder advanced to next stage successfully',
      startup,
      newStage: startup.currentStage,
      nextSteps: 'Founder can now submit tasks for the next validation stage'
    });
  } catch (error) {
    console.error('Error advancing stage:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent registrations (newest users regardless of state) — unique route
router.get('/recent-users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
