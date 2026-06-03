/**
 * routes/gamification.js
 * Endpoints for streak info, leaderboard, and reward claiming.
 */

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const {
  recordActivity,
  getLeaderboard,
  claimReward,
  STREAK_REWARDS,
} = require('../services/gamificationService');

const claimLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

// ─── GET /api/gamification/me ─────────────────────────────────────────────────
// Returns the current user's streak, rewards, and leaderboard score
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name currentStreak longestStreak lastActivityDate rewardPoints rewards leaderboardScore totalPosts totalConnections totalDaysActive role');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Compute live connection count from both Connection and IntroRequest models
    // This is the source of truth — stale counters on User doc may lag behind
    const Connection   = require('../models/Connection');
    const IntroRequest = require('../models/IntroRequest');
    const userId = user._id;

    const [connResult, introResult] = await Promise.all([
      Connection.aggregate([
        { $match: { status: 'accepted', $or: [{ from: userId }, { to: userId }] } },
        { $count: 'total' },
      ]),
      IntroRequest.aggregate([
        { $match: { status: 'accepted', $or: [{ founderId: userId }, { providerId: userId }] } },
        { $count: 'total' },
      ]),
    ]);

    const liveConnections = (connResult[0]?.total || 0) + (introResult[0]?.total || 0);

    // Compute live post count
    const Post = require('../models/Post');
    const postResult = await Post.countDocuments({ authorId: userId });

    // Determine next reward milestone
    const nextMilestone = STREAK_REWARDS.find(r => r.milestone > (user.currentStreak || 0));

    res.json({
      currentStreak:    user.currentStreak || 0,
      longestStreak:    user.longestStreak || 0,
      lastActivityDate: user.lastActivityDate,
      rewardPoints:     user.rewardPoints || 0,
      leaderboardScore: user.leaderboardScore || 0,
      totalPosts:       postResult,
      totalConnections: liveConnections,
      totalDaysActive:  user.totalDaysActive || 0,
      rewards:          user.rewards || [],
      nextMilestone:    nextMilestone || null,
      streakRewards:    STREAK_REWARDS,
    });
  } catch (err) {
    console.error('Gamification /me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/gamification/profile/:userId ────────────────────────────────────
// Returns full profile details for a leaderboard user.
// Response varies by role: founder gets startup details, provider gets service details.
router.get('/profile/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    // Basic user info
    const user = await User.findById(userId)
      .select('name profilePicture role state createdAt isVerified verifiedSource verifiedUntil currentStreak longestStreak totalDaysActive rewardPoints leaderboardScore interestAreas stagePreference')
      .lean();

    if (!user || user.state === 'BLOCKED') {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const profile = {
      _id:            user._id,
      name:           user.name,
      profilePicture: user.profilePicture || '',
      role:           user.role,
      joinedAt:       user.createdAt,
      currentStreak:  user.currentStreak || 0,
      longestStreak:  user.longestStreak || 0,
      totalDaysActive: user.totalDaysActive || 0,
      rewardPoints:   user.rewardPoints || 0,
      leaderboardScore: user.leaderboardScore || 0,
      isVerified:     !!(user.isVerified && user.verifiedSource === 'payment' && user.verifiedUntil && new Date(user.verifiedUntil) > new Date()),
    };

    // Role-specific extra data
    if (user.role === 'founder') {
      const Startup = require('../models/Startup');
      const startup = await Startup.findOne({ founderId: userId })
        .select('name thesis industry validationScore currentStage validationStages')
        .lean();
      if (startup) {
        const stages = startup.validationStages || {};
        const validatedCount = ['idea','problem','solution','market','business']
          .filter(k => stages[k]?.isValidated).length;
        profile.startup = {
          name:           startup.name,
          thesis:         startup.thesis,
          industry:       startup.industry,
          validationScore: startup.validationScore || 0,
          currentStage:   startup.currentStage || 1,
          stagesValidated: validatedCount,
        };
      }
    }

    if (user.role === 'investor') {
      profile.interestAreas    = user.interestAreas || [];
      profile.stagePreference  = user.stagePreference || [];
    }

    if (user.role === 'provider') {
      const Provider = require('../models/Provider');
      const provider = await Provider.findOne({ userId })
        .select('name category description bio experienceLevel specialties availability')
        .lean();
      if (provider) {
        profile.provider = {
          category:        provider.category || 'General',
          description:     provider.description || provider.bio || '',
          experienceLevel: provider.experienceLevel || '',
          specialties:     provider.specialties || [],
          availability:    provider.availability || '',
        };
      }
    }

    res.json(profile);
  } catch (err) {
    console.error('Gamification profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/gamification/activity ─────────────────────────────────────────
// Record a daily login activity (called on dashboard load)
router.post('/activity', protect, async (req, res) => {
  try {
    const result = await recordActivity(req.user._id, 'login');
    res.json(result || { message: 'Activity recorded' });
  } catch (err) {
    console.error('Activity record error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/gamification/leaderboard/:role ──────────────────────────────────
// Get leaderboard for a specific role
router.get('/leaderboard/:role', protect, async (req, res) => {
  try {
    const { role } = req.params;
    if (!['founder', 'investor', 'provider'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be founder, investor, or provider.' });
    }

    const { topN, myRank, myEntry, totalUsers } = await getLeaderboard(role, 50, req.user._id);

    res.json({
      leaderboard: topN,
      myRank,
      myEntry,   // the current user's own leaderboard entry (even if outside top 50)
      totalUsers,
      role,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/gamification/claim-reward ─────────────────────────────────────
// Claim a streak reward
router.post('/claim-reward', protect, claimLimiter, async (req, res) => {
  try {
    const { milestone, fullName, phone, address } = req.body;

    if (!milestone || !fullName || !phone || !address) {
      return res.status(400).json({ message: 'milestone, fullName, phone, and address are required' });
    }

    if (![30, 60, 90].includes(Number(milestone))) {
      return res.status(400).json({ message: 'Invalid milestone. Must be 30, 60, or 90.' });
    }

    const result = await claimReward(req.user._id, Number(milestone), {
      fullName: fullName.trim(),
      phone:    phone.trim(),
      address:  address.trim(),
    });

    res.json({ success: true, message: 'Reward claimed! We will ship it to you soon.', reward: result.reward });
  } catch (err) {
    console.error('Claim reward error:', err);
    if (err.message === 'Reward already claimed') {
      return res.status(400).json({ message: 'You have already claimed this reward.' });
    }
    if (err.message === 'Reward not unlocked yet') {
      return res.status(400).json({ message: 'This reward has not been unlocked yet.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
