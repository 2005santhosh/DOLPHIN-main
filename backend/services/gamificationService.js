/**
 * gamificationService.js
 * Central service for all streak, reward, leaderboard, and points logic.
 */

const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { createNotification } = require('./notificationService');

// ─── Constants ────────────────────────────────────────────────────────────────

const STREAK_REWARDS = [
  { milestone: 30, name: 'Dolphin Cap',    description: 'Exclusive Dolphin branded cap' },
  { milestone: 60, name: 'Dolphin Bottle', description: 'Premium Dolphin water bottle' },
  { milestone: 90, name: 'Dolphin Bag',    description: 'Stylish Dolphin backpack' },
];

const POINTS = {
  POST_CREATED:        10,
  CONNECTION_ACCEPTED: 15,
  DAILY_LOGIN:          5,
  STREAK_BONUS_30:    100,
  STREAK_BONUS_60:    250,
  STREAK_BONUS_90:    500,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if two dates are on the same calendar day (UTC) */
function isSameDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth()    === b.getUTCMonth()    &&
    a.getUTCDate()     === b.getUTCDate()
  );
}

/** Returns true if d2 is exactly one calendar day after d1 (UTC) */
function isConsecutiveDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  // Normalise to midnight UTC
  a.setUTCHours(0, 0, 0, 0);
  b.setUTCHours(0, 0, 0, 0);
  const diffMs = b - a;
  return diffMs === 86400000; // exactly 1 day
}

// ─── Core: Record Activity & Update Streak ────────────────────────────────────

/**
 * Called whenever a user does a meaningful action (post, connection, login).
 * Updates streak, awards points, checks milestones.
 *
 * @param {string} userId
 * @param {'post'|'connection'|'login'} activityType
 * @returns {object} { streakUpdated, newStreak, pointsAwarded, rewardUnlocked }
 */
async function recordActivity(userId, activityType) {
  const user = await User.findById(userId);
  if (!user) return null;

  const now = new Date();
  const last = user.lastActivityDate;
  let streakUpdated = false;
  let pointsAwarded = 0;
  let rewardUnlocked = null;

  // ── Streak logic ────────────────────────────────────────────────────────────
  if (!last) {
    // First ever activity
    user.currentStreak = 1;
    user.totalDaysActive = 1;
    streakUpdated = true;
  } else if (isSameDay(last, now)) {
    // Already active today — no streak change, but still award action points
    streakUpdated = false;
  } else if (isConsecutiveDay(last, now)) {
    // Consecutive day — extend streak
    user.currentStreak += 1;
    user.totalDaysActive += 1;
    streakUpdated = true;
  } else {
    // Missed at least one day — streak broken (handled by cron, but catch here too)
    user.currentStreak = 1;
    user.totalDaysActive += 1;
    streakUpdated = true;
  }

  // Update longest streak
  if (user.currentStreak > user.longestStreak) {
    user.longestStreak = user.currentStreak;
  }

  user.lastActivityDate = now;

  // ── Points for this action ───────────────────────────────────────────────────
  if (activityType === 'post') {
    pointsAwarded += POINTS.POST_CREATED;
    user.totalPosts = (user.totalPosts || 0) + 1;
  } else if (activityType === 'connection') {
    pointsAwarded += POINTS.CONNECTION_ACCEPTED;
    user.totalConnections = (user.totalConnections || 0) + 1;
  } else if (activityType === 'login') {
    if (streakUpdated) {
      pointsAwarded += POINTS.DAILY_LOGIN;
    }
  }

  user.rewardPoints = (user.rewardPoints || 0) + pointsAwarded;

  // ── Check streak milestones ──────────────────────────────────────────────────
  for (const reward of STREAK_REWARDS) {
    if (user.currentStreak >= reward.milestone) {
      const alreadyUnlocked = (user.rewards || []).some(r => r.milestone === reward.milestone);
      if (!alreadyUnlocked) {
        // Unlock reward
        user.rewards = user.rewards || [];
        user.rewards.push({
          milestone:  reward.milestone,
          name:       reward.name,
          unlockedAt: now,
          claimed:    false,
        });

        // Bonus points
        const bonusKey = `STREAK_BONUS_${reward.milestone}`;
        const bonus = POINTS[bonusKey] || 0;
        user.rewardPoints += bonus;
        pointsAwarded += bonus;

        rewardUnlocked = reward;

        // In-app notification
        await createNotification({
          userId,
          type: 'REWARD_UNLOCKED',
          title: `Reward Unlocked: ${reward.name}!`,
          message: `You reached a ${reward.milestone}-day streak! Your ${reward.name} reward is ready to claim.`,
          priority: 'high',
          actionUrl: '#gamification',
          actionText: 'Claim Reward',
        });

        // Email notification
        await sendStreakMilestoneEmail(user, reward);
      }
    }
  }

  // ── Streak milestone notification (no reward, just milestone) ───────────────
  const notifyMilestones = [7, 14, 21, 30, 60, 90];
  if (streakUpdated && notifyMilestones.includes(user.currentStreak)) {
    const hasReward = STREAK_REWARDS.some(r => r.milestone === user.currentStreak);
    if (!hasReward) {
      await createNotification({
        userId,
        type: 'STREAK_MILESTONE',
        title: `${user.currentStreak}-Day Streak!`,
        message: `Amazing! You've maintained a ${user.currentStreak}-day streak. Keep it up!`,
        priority: 'medium',
        actionUrl: '#gamification',
        actionText: 'View Streak',
      });
    }
  }

  // ── Update leaderboard score ─────────────────────────────────────────────────
  user.leaderboardScore = computeLeaderboardScore(user);

  await user.save();

  return {
    streakUpdated,
    newStreak: user.currentStreak,
    pointsAwarded,
    rewardUnlocked,
    totalPoints: user.rewardPoints,
  };
}

// ─── Leaderboard Score ────────────────────────────────────────────────────────

function computeLeaderboardScore(user) {
  const connections = (user.totalConnections || 0) * 15;
  const posts       = (user.totalPosts || 0) * 10;
  const activity    = (user.totalDaysActive || 0) * 5;
  const streak      = (user.currentStreak || 0) * 3;
  return connections + posts + activity + streak;
}

// ─── Leaderboard Query ────────────────────────────────────────────────────────

/**
 * Get top N users for a given role, ranked by computed leaderboard score.
 * Counts actual Post and Connection documents for accuracy — not stale counters.
 */
async function getLeaderboard(role, limit = 50, currentUserId = null) {
  const Post = require('../models/Post');

  // Fetch ALL non-blocked users of this role
  const allUsers = await User.find({
    role,
    state: { $ne: 'BLOCKED' },
  })
    .select('name profilePicture currentStreak longestStreak totalPosts totalConnections totalDaysActive rewardPoints')
    .lean();

  if (allUsers.length === 0) return { topN: [], myRank: null, myEntry: null, totalUsers: 0 };

  const userIds = allUsers.map(u => u._id);

  // Count actual posts per user (all-time, not just today)
  const postCounts = await Post.aggregate([
    { $match: { authorId: { $in: userIds } } },
    { $group: { _id: '$authorId', count: { $sum: 1 } } },
  ]);
  const postMap = {};
  postCounts.forEach(p => { postMap[p._id.toString()] = p.count; });

  // Count accepted connections per user.
  // Each Connection document represents ONE accepted connection between two people.
  // We count documents where user is sender OR receiver — not both sides separately.
  // Same logic for IntroRequest.
  const Connection   = require('../models/Connection');
  const IntroRequest = require('../models/IntroRequest');

  // Get all accepted Connection docs involving any of these users
  const acceptedConns = await Connection.find({
    status: 'accepted',
    $or: [{ from: { $in: userIds } }, { to: { $in: userIds } }],
  }).select('from to').lean();

  const connMap = {};
  acceptedConns.forEach(c => {
    const fromId = c.from.toString();
    const toId   = c.to.toString();
    if (userIds.some(uid => uid.toString() === fromId)) {
      connMap[fromId] = (connMap[fromId] || 0) + 1;
    }
    if (userIds.some(uid => uid.toString() === toId)) {
      connMap[toId] = (connMap[toId] || 0) + 1;
    }
  });

  // Get all accepted IntroRequest docs involving any of these users
  const acceptedIntros = await IntroRequest.find({
    status: 'accepted',
    $or: [{ founderId: { $in: userIds } }, { providerId: { $in: userIds } }],
  }).select('founderId providerId').lean();

  // Track unique pairs per user to avoid double-counting
  // (if same two users have both a Connection AND an IntroRequest, count once)
  const pairsSeen = {}; // uid -> Set of other-uid strings
  acceptedConns.forEach(c => {
    const a = c.from.toString();
    const b = c.to.toString();
    if (!pairsSeen[a]) pairsSeen[a] = new Set();
    if (!pairsSeen[b]) pairsSeen[b] = new Set();
    pairsSeen[a].add(b);
    pairsSeen[b].add(a);
  });

  const introMap = {};
  acceptedIntros.forEach(r => {
    const fId = r.founderId?.toString();
    const pId = r.providerId?.toString();
    if (!fId || !pId) return;
    // Only count this pair if not already counted via Connection model
    const fAlreadySeen = pairsSeen[fId]?.has(pId);
    const pAlreadySeen = pairsSeen[pId]?.has(fId);
    if (!fAlreadySeen) {
      introMap[fId] = (introMap[fId] || 0) + 1;
      if (!pairsSeen[fId]) pairsSeen[fId] = new Set();
      pairsSeen[fId].add(pId);
    }
    if (!pAlreadySeen) {
      introMap[pId] = (introMap[pId] || 0) + 1;
      if (!pairsSeen[pId]) pairsSeen[pId] = new Set();
      pairsSeen[pId].add(fId);
    }
  });

  // Final connection count = Connection + IntroRequest (deduped)
  const finalConnMap = {};
  Object.keys(connMap).forEach(uid => { finalConnMap[uid] = connMap[uid]; });
  Object.keys(introMap).forEach(uid => { finalConnMap[uid] = (finalConnMap[uid] || 0) + introMap[uid]; });

  // Build scored list using real counts
  const scored = allUsers.map(u => {
    const id            = u._id.toString();
    const realPosts     = postMap[id]       ?? (u.totalPosts       || 0);
    const realConns     = finalConnMap[id]  ?? (u.totalConnections || 0);
    const daysActive    = u.totalDaysActive  || 0;
    const streak        = u.currentStreak    || 0;

    const leaderboardScore =
      realConns   * 15 +
      realPosts   * 10 +
      daysActive  *  5 +
      streak      *  3;

    return {
      _id:              u._id,
      name:             u.name,
      profilePicture:   u.profilePicture || '',
      currentStreak:    streak,
      longestStreak:    u.longestStreak || 0,
      totalPosts:       realPosts,
      totalConnections: realConns,
      totalDaysActive:  daysActive,
      rewardPoints:     u.rewardPoints || 0,
      leaderboardScore,
    };
  });

  // Sort: score desc, then streak desc as tiebreaker
  scored.sort((a, b) => {
    if (b.leaderboardScore !== a.leaderboardScore) return b.leaderboardScore - a.leaderboardScore;
    return b.currentStreak - a.currentStreak;
  });

  scored.forEach((u, i) => { u.rank = i + 1; });

  // Current user's rank across ALL users
  let myRank  = null;
  let myEntry = null;
  if (currentUserId) {
    const idx = scored.findIndex(u => u._id.toString() === currentUserId.toString());
    if (idx !== -1) {
      myRank  = idx + 1;
      myEntry = scored[idx];
    }
  }

  return { topN: scored.slice(0, limit), myRank, myEntry, totalUsers: scored.length };
}

// ─── Streak Lost (Daily Cron) ─────────────────────────────────────────────────

/**
 * Called by a daily cron job. Finds users who missed yesterday and resets their streak.
 */
async function processStreakLosses() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const twoDaysAgo = new Date(yesterday);
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 1);

  // Users whose last activity was before yesterday (i.e. missed at least one day)
  // and who had a streak > 0
  const usersWhoLostStreak = await User.find({
    currentStreak: { $gt: 0 },
    lastActivityDate: { $lt: yesterday },
  }).select('_id name email currentStreak emailNotifications');

  let count = 0;
  for (const user of usersWhoLostStreak) {
    const lostStreak = user.currentStreak;
    user.currentStreak = 0;
    await user.save();

    // In-app notification (fire-and-forget)
    createNotification({
      userId: user._id,
      type: 'STREAK_LOST',
      title: 'Streak Lost',
      message: `Your ${lostStreak}-day streak has ended. Start a new one today!`,
      priority: 'high',
      actionUrl: '#gamification',
      actionText: 'Rebuild Streak',
    }).catch(e => console.error('Streak lost notification error:', e));

    // Email notification (fire-and-forget)
    if (user.emailNotifications !== false) {
      sendStreakLostEmail(user, lostStreak).catch(e =>
        console.error(`Streak lost email failed for ${user.email}:`, e)
      );
    }

    count++;
  }

  console.log(`[Gamification] Processed streak losses for ${count} users`);
  return count;
}

// ─── Reward Claim ─────────────────────────────────────────────────────────────

/**
 * Claim a reward for a user at a given milestone.
 * Sends delivery details to support@pacificdev.in.
 */
async function claimReward(userId, milestone, deliveryInfo) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const reward = (user.rewards || []).find(r => r.milestone === milestone);
  if (!reward) throw new Error('Reward not unlocked yet');
  if (reward.claimed) throw new Error('Reward already claimed');

  // Mark as claimed
  reward.claimed    = true;
  reward.claimedAt  = new Date();
  reward.deliveryInfo = {
    fullName: deliveryInfo.fullName,
    phone:    deliveryInfo.phone,
    address:  deliveryInfo.address,
  };

  await user.save();

  // Send delivery details to support team
  const rewardInfo = STREAK_REWARDS.find(r => r.milestone === milestone);
  await sendRewardClaimEmail(user, rewardInfo, deliveryInfo);

  // In-app notification
  await createNotification({
    userId,
    type: 'REWARD_UNLOCKED',
    title: 'Reward Claimed!',
    message: `Your ${rewardInfo?.name || 'reward'} claim has been submitted. We'll ship it to you soon!`,
    priority: 'high',
  });

  return { success: true, reward };
}

// ─── Email Templates ──────────────────────────────────────────────────────────

async function sendStreakMilestoneEmail(user, reward) {
  if (user.emailNotifications === false) return;
  try {
    await sendEmail({
      email: user.email,
      subject: `Congratulations! You've unlocked the ${reward.name} reward`,
      message: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="https://api.dolphinorg.in/logo-icon.svg" alt="Dolphin" style="height: 48px;" />
            <h2 style="color: #1E3A8A; margin: 12px 0 0;">Dolphin</h2>
          </div>
          <h2 style="color: #111827;">You've reached a ${reward.milestone}-day streak!</h2>
          <p style="color: #374151; line-height: 1.6;">
            Amazing work, <strong>${user.name}</strong>! You've maintained a <strong>${reward.milestone}-day streak</strong> on Dolphin.
            As a reward, you've unlocked the <strong>${reward.name}</strong>!
          </p>
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 8px;">🎁</div>
            <h3 style="color: #065F46; margin: 0 0 8px;">${reward.name}</h3>
            <p style="color: #047857; margin: 0; font-size: 0.9rem;">${reward.description}</p>
          </div>
          <p style="color: #374151; line-height: 1.6;">
            Log in to your dashboard to claim your reward. You'll need to provide your delivery address.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://www.dolphinorg.in/dashboard#gamification"
               style="display: inline-block; padding: 12px 28px; background: #84CC16; color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">
              Claim Your Reward
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin-top: 24px;">
            &copy; 2026 Dolphin &middot; support@pacificdev.in
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Streak milestone email error:', e);
  }
}

async function sendStreakLostEmail(user, lostStreak) {
  await sendEmail({
    email: user.email,
    subject: `🔥 Your ${lostStreak}-day streak has gone — but you can rebuild it!`,
    message: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1E3A8A; margin: 0;">🐬 Dolphin</h2>
        </div>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 3rem; margin-bottom: 8px;">😢</div>
          <h2 style="color: #DC2626; margin: 0 0 8px;">Your streak has gone</h2>
          <p style="color: #991B1B; font-size: 1.1rem; font-weight: 600; margin: 0;">
            ${lostStreak}-day streak lost
          </p>
        </div>

        <p style="color: #374151; line-height: 1.7; font-size: 1rem;">
          Hi <strong>${user.name}</strong>,
        </p>
        <p style="color: #374151; line-height: 1.7; font-size: 1rem;">
          Your <strong>${lostStreak}-day streak</strong> has ended because you missed a day of activity on Dolphin.
          But don't worry — every great journey has a setback, and this is just yours!
        </p>

        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #065F46; margin: 0 0 12px;">🎁 Maintain your streak to get awesome goodies!</h3>
          <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
            <li><strong>30-day streak</strong> → 🧢 Exclusive Dolphin Cap</li>
            <li><strong>60-day streak</strong> → 🍶 Premium Dolphin Bottle</li>
            <li><strong>90-day streak</strong> → 🎒 Stylish Dolphin Backpack</li>
          </ul>
        </div>

        <p style="color: #374151; line-height: 1.7; font-size: 1rem;">
          Log in today, post an update, make a connection — any activity counts.
          Your new streak starts the moment you come back. 💪
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="https://www.dolphinorg.in"
             style="display: inline-block; padding: 14px 32px; background: #84CC16; color: #0F172A; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 1rem;">
            🔥 Rebuild My Streak Now
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin-top: 24px;">
          &copy; 2026 Dolphin &middot; support@pacificdev.in
        </p>
      </div>
    `,
  });
}

async function sendRewardClaimEmail(user, reward, deliveryInfo) {
  // Email to support team with delivery details
  await sendEmail({
    email: 'support@pacificdev.in',
    subject: `[Reward Claim] ${user.name} — ${reward?.name || 'Reward'}`,
    message: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px;">
        <h2>New Reward Claim</h2>
        <p><strong>User:</strong> ${user.name} (${user.email})</p>
        <p><strong>User ID:</strong> ${user._id}</p>
        <p><strong>Reward:</strong> ${reward?.name || 'Unknown'} (${reward?.milestone || '?'}-day streak milestone)</p>
        <hr />
        <h3>Delivery Details</h3>
        <p><strong>Full Name:</strong> ${deliveryInfo.fullName}</p>
        <p><strong>Phone:</strong> ${deliveryInfo.phone}</p>
        <p><strong>Address:</strong> ${deliveryInfo.address}</p>
        <hr />
        <p style="color: #6B7280; font-size: 0.85rem;">Claimed at: ${new Date().toISOString()}</p>
      </div>
    `,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  recordActivity,
  getLeaderboard,
  processStreakLosses,
  claimReward,
  computeLeaderboardScore,
  STREAK_REWARDS,
  POINTS,
};

