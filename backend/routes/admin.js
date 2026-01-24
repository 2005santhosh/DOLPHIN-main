const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');
const Log = require('../models/Log');

// Get all users
router.get('/users', protect, authorize('investor'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all startups
router.get('/startups', protect, authorize('investor'), async (req, res) => {
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
router.get('/providers', protect, authorize('investor'), async (req, res) => {
  try {
    const providers = await Provider.find()
      .populate('userId', 'name email state stage');
    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve user
router.post('/approve-user', protect, authorize('investor'), async (req, res) => {
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

    user.state = 'APPROVED';
    user.stage = 1;
    await user.save();

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
router.post('/reject-user', protect, authorize('investor'), async (req, res) => {
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
router.post('/move-stage', protect, authorize('investor'), async (req, res) => {
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

    if (user.state !== 'APPROVED') {
      return res.status(400).json({ 
        message: 'User must be approved to advance stage',
        nextSteps: 'Approve the user first'
      });
    }

    if (user.stage >= 3) {
      return res.status(400).json({ 
        message: 'User is already at the maximum stage',
        nextSteps: 'User has completed all stages'
      });
    }

    user.stage += 1;
    user.state = `STAGE_${user.stage}`;
    await user.save();

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
router.post('/block-user', protect, authorize('investor'), async (req, res) => {
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

module.exports = router;