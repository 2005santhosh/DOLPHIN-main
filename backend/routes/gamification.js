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

    // Determine next reward milestone
    const claimedMilestones = (user.rewards || []).map(r => r.milestone);
    const nextReward = STREAK_REWARDS.find(r => !claimedMilestones.includes(r.milestone) || !(user.rewards.find(ur => ur.milestone === r.milestone)?.claimed));
    const nextMilestone = STREAK_REWARDS.find(r => r.milestone > (user.currentStreak || 0));

    res.json({
      currentStreak:    user.currentStreak || 0,
      longestStreak:    user.longestStreak || 0,
      lastActivityDate: user.lastActivityDate,
      rewardPoints:     user.rewardPoints || 0,
      leaderboardScore: user.leaderboardScore || 0,
      totalPosts:       user.totalPosts || 0,
      totalConnections: user.totalConnections || 0,
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

    const leaderboard = await getLeaderboard(role, 20);

    // Find current user's rank
    const myRank = leaderboard.findIndex(u => u._id.toString() === req.user._id.toString()) + 1;

    res.json({
      leaderboard,
      myRank: myRank > 0 ? myRank : null,
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
