const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Startup = require('../models/Startup');
const User = require('../models/User');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

// ==========================================
// PROFILE
// ==========================================

// Get Profile
router.get('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    // ✅ FIX: Only send response once
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Profile
router.put('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    const { name, emailNotifications } = req.body;
    const updateFields = {};
    if (name) updateFields.name = name;
    if (typeof emailNotifications !== 'undefined') updateFields.emailNotifications = emailNotifications;

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updateFields }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// VALIDATED STARTUPS
// ==========================================

router.get('/validated-startups', protect, authorize('investor'), async (req, res) => {
  try {
    const startups = await Startup.find({ validationScore: { $gte: 70 } })
      .populate('founderId', 'name email profilePicture')
      .select('name thesis industry validationScore currentStage validationStages');

    const startupList = startups.map(startup => {
      let bestStageScore = startup.validationScore || 0;
      let completedStages = 0;
      const stages = startup.validationStages || {};
      Object.values(stages).forEach(s => { if (s && s.completedAt) completedStages++; });

      return {
        _id: startup._id,
        name: startup.name,
        thesis: startup.thesis,
        industry: startup.industry,
        validationScore: startup.validationScore,
        currentStage: startup.currentStage,
        bestStageScore: bestStageScore,
        completedStages: completedStages,
        founderId: startup.founderId
      };
    });

    res.json({ startups: startupList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// WATCHLIST
// ==========================================

router.get('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .populate({
        path: 'watchlist',
        select: 'name thesis industry validationScore validationStages currentStage founderId',
        populate: { path: 'founderId', select: 'name email profilePicture' }
      });

    if (!investor.watchlist) return res.json([]);

    const watchlist = investor.watchlist.map(startup => {
      const s = startup.toObject();
      const stages = s.validationStages || {};
      let bestScore = 0;
      Object.values(stages).forEach(st => { if (st && st.score > bestScore) bestScore = st.score; });
      return { ...s, bestStageScore: bestScore, completedStages: Object.values(stages).filter(st => st?.completedAt).length };
    });
    res.json(watchlist);
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId } = req.body;
    const investor = await User.findById(req.user.id);
    if (!investor.watchlist) investor.watchlist = [];
    if (!investor.watchlist.includes(startupId)) {
      investor.watchlist.push(startupId);
      await investor.save();
    }
    res.status(201).json({ message: 'Added' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});

router.delete('/watchlist/:startupId', protect, authorize('investor'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { watchlist: req.params.startupId } });
    res.json({ message: 'Removed' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// ==========================================
// REQUESTS & INTERESTS
// ==========================================

router.post('/express-interest', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId, message } = req.body;
    const startup = await Startup.findById(startupId).populate('founderId');
    if (!startup) return res.status(404).json({ message: 'Startup not found' });

    const existing = await IntroRequest.findOne({
      providerId: req.user.id,
      startupId: startupId,
      requestType: 'investor_interest'
    });

    if (existing) return res.status(400).json({ message: 'Request already sent' });

    const request = await IntroRequest.create({
      providerId: req.user.id,
      founderId: startup.founderId._id,
      startupId: startup._id,
      status: 'pending',
      requestType: 'investor_interest',
      message: message || 'Investor is interested!'
    });

    // Notify Founder
    await Notification.create({
      userId: startup.founderId._id,
      type: 'investor_interest',
      title: 'New Investor Request!',
      message: `An investor is interested in ${startup.name}.`,
      relatedId: request._id
    });

    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${startup.founderId._id}`).emit('newNotification', {
        title: 'New Investor Request!',
        message: `Investor request for ${startup.name}`
      });
    }

    res.status(201).json({ success: true, message: 'Request sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my-requests', protect, authorize('investor'), async (req, res) => {
  try {
    const requests = await IntroRequest.find({ providerId: req.user.id })
      .populate('startupId', 'name industry')
      .populate('founderId', 'name email profilePicture')
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;