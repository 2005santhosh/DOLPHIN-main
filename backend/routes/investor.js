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

// @route   POST api/investor/express-interest
// @desc    Investor expresses interest in a startup
// @access  Private
router.post('/express-interest', auth, async (req, res) => {
  const { startupId } = req.body;

  // 1. Basic Validation
  if (!startupId) {
    return res.status(400).json({ message: 'Startup ID is required' });
  }

  try {
    // 2. Find the Startup and populate the founder
    const startup = await Startup.findById(startupId).populate('founderId', 'name _id');

    // SAFETY CHECK: Ensure startup exists
    if (!startup) {
      return res.status(404).json({ message: 'Startup not found' });
    }

    // SAFETY CHECK: Ensure the startup has a valid founder (prevent crash if founder was deleted)
    if (!startup.founderId) {
      return res.status(400).json({ message: 'This startup does not have a valid founder account.' });
    }

    // 3. Check for Duplicate Request
    const existingRequest = await Request.findOne({
      investorId: req.user.id,
      startupId: startupId
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You have already sent a request for this startup.' });
    }

    // 4. Create the Request
    const newRequest = new Request({
      investorId: req.user.id,
      founderId: startup.founderId._id, // Safe access
      startupId: startup._id,
      status: 'pending',
      initiator: 'investor'
    });

    await newRequest.save();

    // 5. Create Notification for the Founder
    const notification = new Notification({
      userId: startup.founderId._id,
      title: 'New Investor Interest',
      message: `An investor is interested in your startup: ${startup.name}`,
      type: 'request'
    });
    await notification.save();

    // 6. Real-time Socket Notification (Optional)
    const io = req.app.get('io');
    if (io) {
        // Notify the founder specifically
        io.to(startup.founderId._id.toString()).emit('newRequest', newRequest);
        io.to(startup.founderId._id.toString()).emit('newNotification', notification);
    }

    res.json({ message: 'Request sent successfully!', request: newRequest });

  } catch (err) {
    console.error('Express Interest Error:', err.message);
    
    // Handle invalid ID format error
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid Startup ID format' });
    }
    
    res.status(500).send('Server Error');
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