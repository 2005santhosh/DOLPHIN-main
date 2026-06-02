const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Startup = require('../models/Startup');
const User = require('../models/User');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');

// ==========================================
// PROFILE ROUTES
// ==========================================

// @route   GET api/investor/profile
// @desc    Get investor profile
// @access  Private
router.get('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    // OPTIMIZATION: Use .lean() for faster JSON parsing
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Profile Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/investor/profile
// @desc    Update investor profile
// @access  Private
router.put('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    const { name, emailNotifications, interestAreas, stagePreference } = req.body;
    const updateFields = {};
    
    if (name) updateFields.name = name;
    if (typeof emailNotifications !== 'undefined') updateFields.emailNotifications = emailNotifications;
    if (interestAreas) updateFields.interestAreas = interestAreas;
    if (stagePreference) updateFields.stagePreference = stagePreference;

    const user = await User.findByIdAndUpdate(
      req.user.id, 
      { $set: updateFields }, 
      { new: true }
    ).select('-password').lean(); // OPTIMIZATION: .lean()

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// VALIDATED STARTUPS (OPTIMIZED)
// ==========================================

/**
 * Returns true if a user object carries an active payment-based verification.
 * Used for server-side verified-first sort.
 */
function isVerifiedUser(user) {
  if (!user) return false;
  return (
    user.isVerified === true &&
    user.verifiedSource === 'payment' &&
    user.verifiedUntil instanceof Date
      ? user.verifiedUntil > new Date()
      : user.verifiedUntil && new Date(user.verifiedUntil) > new Date()
  );
}

/**
 * Stable verified-first sort.
 * Verified items float to top; within each group the original order is preserved.
 */
function verifiedFirst(arr, getUser) {
  return arr
    .map((item, idx) => ({ item, idx, v: isVerifiedUser(getUser(item)) ? 0 : 1 }))
    .sort((a, b) => a.v - b.v || a.idx - b.idx)
    .map(({ item }) => item);
}

// @route   GET api/investor/validated-startups
// @desc    Get all startups with validationScore >= 70
// @access  Private
router.get('/validated-startups', protect, authorize('investor'), async (req, res) => {
  try {
    // Include verification fields so frontend can render Featured badge
    const startups = await Startup.find({ validationScore: { $gte: 70 } })
      .populate('founderId', 'name email profilePicture state isVerified verifiedSource verifiedUntil')
      .select('name thesis industry validationScore currentStage validationStages founderId')
      .sort({ validationScore: -1, createdAt: -1 })
      .lean();

    const startupList = startups.map(startup => {
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
        completedStages,
        founderId: startup.founderId  // includes isVerified, verifiedSource, verifiedUntil
      };
    });

    // Verified founders float to top; score order preserved within each group
    const sorted = verifiedFirst(startupList, s => s.founderId);

    res.json({ startups: sorted });
  } catch (error) {
    console.error('Fetch Startups Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================================
// WATCHLIST
// ==========================================

// @route   GET api/investor/watchlist
// @desc    Get investor's watchlisted startups
// @access  Private
router.get('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .populate({
        path: 'watchlist',
        select: 'name thesis industry validationScore validationStages currentStage founderId',
        populate: { path: 'founderId', select: 'name email profilePicture state' } // Include state
      }).lean();

    if (!investor.watchlist) return res.json([]);

    // Process for frontend consistency
    const watchlist = investor.watchlist.map(startup => {
      const s = startup;
      const stages = s.validationStages || {};
      return { 
        ...s, 
        completedStages: Object.values(stages).filter(st => st?.completedAt).length 
      };
    });
    
    res.json(watchlist);
  } catch (error) { 
    console.error('Watchlist Error:', error);
    res.status(500).json({ message: 'Server error' }); 
  }
});

// @route   POST api/investor/watchlist
// @desc    Add startup to watchlist
// @access  Private
router.post('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId } = req.body;
    if (!startupId) return res.status(400).json({ message: 'Startup ID required' });

    // Use $addToSet to prevent duplicates
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { watchlist: startupId } });
    res.status(201).json({ message: 'Added to watchlist' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// @route   DELETE api/investor/watchlist/:startupId
// @desc    Remove startup from watchlist
// @access  Private
router.delete('/watchlist/:startupId', protect, authorize('investor'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { watchlist: req.params.startupId } });
    res.json({ message: 'Removed from watchlist' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
});

// ==========================================
// REQUESTS & INTERESTS
// ==========================================

// @route   POST api/investor/express-interest
router.post('/express-interest', protect, authorize('investor'), async (req, res) => {
  const { startupId } = req.body;

  if (!startupId) {
    return res.status(400).json({ message: 'Startup ID is required' });
  }

  try {
    const startup = await Startup.findById(startupId).populate('founderId', 'name email _id');

    if (!startup) {
      return res.status(404).json({ message: 'Startup not found' });
    }

    if (!startup.founderId) {
      return res.status(400).json({ message: 'Startup has no valid founder.' });
    }

    const existingRequest = await IntroRequest.findOne({
      providerId: req.user.id, 
      startupId: startup._id
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Request already sent.' });
    }

    const newRequest = await IntroRequest.create({
      providerId: req.user.id,
      founderId: startup.founderId._id,
      startupId: startup._id,
      status: 'pending',
      initiator: 'investor'
    });

    await Notification.create({
      userId: startup.founderId._id,
      title: 'New Connection Request',
      message: `An investor is interested in ${startup.name}`,
      type: 'request'
    });

    const io = req.app.get('socketio');
    if (io) {
      io.to(startup.founderId._id.toString()).emit('newRequest', newRequest);
    }

    // ✅ SEND EMAIL TO FOUNDER
    const investor = await User.findById(req.user.id);
    if (investor && startup.founderId.email) {
        const emailTemplate = getNewRequestEmail(investor.name, 'Investor Interest');
        sendEmail({
            email: startup.founderId.email,
            subject: emailTemplate.subject,
            message: emailTemplate.html
        }).catch(err => console.error("Investor Interest Email Error:", err));
    }

    res.json({ message: 'Request sent successfully!', request: newRequest });

  } catch (err) {
    console.error('Express Interest Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/investor/my-requests
// @desc    Get all requests involving the investor (Sent & Incoming)
// @access  Private
router.get('/my-requests', protect, authorize('investor'), async (req, res) => {
  try {
    // Fetch requests where the investor is the 'providerId' (standard role for non-founders)
    // OPTIMIZATION: .lean() for speed
    const requests = await IntroRequest.find({ providerId: req.user.id })
      .populate('startupId', 'name industry')
      .populate('founderId', 'name email profilePicture state isVerified verifiedSource verifiedUntil')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests });
  } catch (err) {
    console.error('Get Requests Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;