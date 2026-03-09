const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');
const Log = require('../models/Log');

// Get all users
router.get('/users', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
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

// Approve user
router.post('/approve-user', protect, authorize('admin', 'investor'), async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      message: 'userId is required',
      nextSteps: 'Select a user to approve'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        nextSteps: 'Check the user ID and try again'
      });
    }

    // Approval places the user into Stage 1.
    // (We keep a distinct APPROVED state for compatibility, but Stage 1 is the primary “active” state.)
    user.state = 'STAGE_1';
    user.stage = 1;
    await user.save();

    // If this is a founder and a startup exists, keep Startup.currentStage aligned.
    if (user.role === 'founder') {
      await Startup.updateOne({ founderId: user._id }, { $set: { currentStage: 1 } });
    }

    // Log the action
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

// Reject user
router.post('/reject-user', protect, authorize('admin', 'investor'), async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      message: 'userId is required',
      nextSteps: 'Select a user to reject'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        nextSteps: 'Check the user ID and try again'
      });
    }

    user.state = 'BLOCKED';
    await user.save();

    // Log the action
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

// Move user to next stage
router.post('/move-stage', protect, authorize('admin', 'investor'), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      message: 'userId is required',
      nextSteps: 'Select a user to advance'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        nextSteps: 'Check the user ID and try again'
      });
    }

    if (user.state === 'PENDING_APPROVAL') {
      return res.status(400).json({
        message: 'User must be approved to advance stage',
        nextSteps: 'Approve the user first'
      });
    }

    if (user.state === 'BLOCKED') {
      return res.status(400).json({
        message: 'Blocked users cannot be advanced',
        nextSteps: 'Unblock/reset the user first'
      });
    }

    const MAX_STAGE = 5;
    const currentStage = user.stage || 0;

    if (currentStage >= MAX_STAGE) {
      return res.status(400).json({
        message: 'User is already at the maximum stage',
        nextSteps: 'User has completed all stages'
      });
    }

    // For founders, enforce: Stage N cannot be advanced to N+1 unless Stage N milestone is verified.
    if (user.role === 'founder' && currentStage >= 1) {
      const startup = await Startup.findOne({ founderId: user._id });
      if (startup) {
        const milestone = startup.milestones?.find(m => m.order === currentStage);
        if (milestone && !milestone.verified) {
          return res.status(400).json({
            message: 'Cannot advance stage: current stage milestone not verified',
            reason: `Stage ${currentStage} requires admin verification before advancing`,
            nextSteps: 'Approve/verify the current stage milestone tasks, then try again'
          });
        }
      }
    }

    user.stage = Math.max(1, currentStage + 1);
    user.state = `STAGE_${user.stage}`;
    await user.save();

    // Keep Startup.currentStage aligned for founders.
    if (user.role === 'founder') {
      await Startup.updateOne({ founderId: user._id }, { $set: { currentStage: user.stage } });
    }

    // Log the action
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

// Block user
router.post('/block-user', protect, authorize('admin', 'investor'), async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      message: 'userId is required',
      nextSteps: 'Select a user to block'
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        nextSteps: 'Check the user ID and try again'
      });
    }

    user.state = 'BLOCKED';
    await user.save();

    // Log the action
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

// Get pending approvals dashboard
router.get('/dashboard', protect, authorize('admin', 'investor'), async (req, res) => {
  try {
    const pendingUsers = await User.find({ state: 'PENDING_APPROVAL' }).countDocuments();
    const approvedUsers = await User.find({ state: 'APPROVED' }).countDocuments();
    const blockedUsers = await User.find({ state: 'BLOCKED' }).countDocuments();
    
    const pendingProviders = await Provider.find({ verified: false }).countDocuments();
    const verifiedProviders = await Provider.find({ verified: true }).countDocuments();
    
    const startups = await Startup.find();
    const validatedStartups = startups.filter(s => s.validationScore >= 70).length;
    const totalStartups = startups.length;

    const pendingTaskSubmissions = startups.reduce((acc, startup) => {
      startup.milestones.forEach(milestone => {
        if (milestone.taskSubmissions) {
          acc += milestone.taskSubmissions.filter(t => t.status === 'Submitted').length;
        }
      });
      return acc;
    }, 0);

    res.json({
      users: {
        pending: pendingUsers,
        approved: approvedUsers,
        blocked: blockedUsers,
        total: pendingUsers + approvedUsers + blockedUsers
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
        pendingReview: pendingTaskSubmissions
      }
    });
  } catch (error) {
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

// Verify provider
router.post('/verify-provider', protect, authorize('admin', 'investor'), async (req, res) => {
  const { providerId } = req.body;
  
  if (!providerId) {
    return res.status(400).json({ 
      message: 'providerId is required',
      nextSteps: 'Select a provider to verify'
    });
  }

  try {
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found',
        nextSteps: 'Check the provider ID and try again'
      });
    }

    provider.verified = true;
    await provider.save();

    // Log the action
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

// Reject provider
router.post('/reject-provider', protect, authorize('admin', 'investor'), async (req, res) => {
  const { providerId } = req.body;
  
  if (!providerId) {
    return res.status(400).json({ 
      message: 'providerId is required',
      nextSteps: 'Select a provider to reject'
    });
  }

  try {
    const provider = await Provider.findByIdAndDelete(providerId);
    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider not found',
        nextSteps: 'Check the provider ID and try again'
      });
    }

    // Log the action
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
          milestone.taskSubmissions.forEach((task, tIdx) => {
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

// Approve milestone task
router.post('/approve-task', protect, authorize('admin', 'investor'), async (req, res) => {
  const { startupId, milestoneIndex, taskId, notes } = req.body;
  
  if (!startupId || milestoneIndex === undefined || !taskId) {
    return res.status(400).json({ 
      message: 'startupId, milestoneIndex, and taskId are required',
      nextSteps: 'Select a task to approve'
    });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Check the startup ID'
      });
    }

    const milestone = startup.milestones[milestoneIndex];
    if (!milestone) {
      return res.status(404).json({ 
        message: 'Milestone not found',
        nextSteps: 'Check the milestone index'
      });
    }

    const task = milestone.taskSubmissions.id(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        nextSteps: 'Check the task ID'
      });
    }

    task.status = 'Approved';
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.reviewNotes = notes || '';

    // Mark milestone as verified if all tasks approved
    const allApproved = milestone.taskSubmissions.every(t => t.status === 'Approved');
    if (allApproved) {
      milestone.verified = true;
      milestone.isCompleted = true;
    }

    await startup.save();

    // Create audit log
    await Log.create({
      userId: req.user.id,
      action: 'task_approved',
      details: { startupId, taskTitle: task.title, milestoneName: milestone.title }
    });

    // Calculate new validation score
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

// Reject milestone task
router.post('/reject-task', protect, authorize('admin', 'investor'), async (req, res) => {
  const { startupId, milestoneIndex, taskId, notes } = req.body;
  
  if (!startupId || milestoneIndex === undefined || !taskId || !notes) {
    return res.status(400).json({ 
      message: 'startupId, milestoneIndex, taskId, and notes are required',
      nextSteps: 'Provide rejection reason for the founder'
    });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Check the startup ID'
      });
    }

    const milestone = startup.milestones[milestoneIndex];
    if (!milestone) {
      return res.status(404).json({ 
        message: 'Milestone not found',
        nextSteps: 'Check the milestone index'
      });
    }

    const task = milestone.taskSubmissions.id(taskId);
    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        nextSteps: 'Check the task ID'
      });
    }

    task.status = 'Rejected';
    task.reviewedAt = new Date();
    task.reviewedBy = req.user.id;
    task.reviewNotes = notes;

    await startup.save();

    // Create audit log
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

// Advance founder to next stage
router.post('/advance-founder-stage', protect, authorize('admin', 'investor'), async (req, res) => {
  const { startupId } = req.body;
  
  if (!startupId) {
    return res.status(400).json({ 
      message: 'startupId is required',
      nextSteps: 'Select a startup to advance'
    });
  }

  try {
    const startup = await Startup.findById(startupId);
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Check the startup ID'
      });
    }

    // Check if all milestones at current stage are verified
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
      return res.status(400).json({ 
        message: `Startup is already at the maximum stage (${MAX_STAGE})`,
        nextSteps: 'Startup has completed all validation stages'
      });
    }

    startup.currentStage += 1;
    await startup.save();

    // Create audit log
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

module.exports = router;