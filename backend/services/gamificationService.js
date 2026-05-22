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
 * Includes ALL non-blocked users regardless of state or startup creation.
 * Score is computed on-the-fly from actual fields so it's always accurate.
 *
 * @param {string} role
 * @param {number} limit  - number of top entries to return
 * @param {string} [currentUserId] - if provided, also returns this user's rank among ALL users
 */
async function getLeaderboard(role, limit = 50, currentUserId = null) {
  // Fetch ALL non-blocked users of this role — no state filter
  const allUsers = await User.find({
    role,
    state: { $ne: 'BLOCKED' },
  })
    .select('name profilePicture currentStreak longestStreak totalPosts totalConnections totalDaysActive rewardPoints leaderboardScore')
    .lean();

  // Compute score on-the-fly for every user (fixes stale leaderboardScore)
  const scored = allUsers.map(u => ({
    _id:              u._id,
    name:             u.name,
    profilePicture:   u.profilePicture || '',
    currentStreak:    u.currentStreak || 0,
    longestStreak:    u.longestStreak || 0,
    totalPosts:       u.totalPosts || 0,
    totalConnections: u.totalConnections || 0,
    totalDaysActive:  u.totalDaysActive || 0,
    rewardPoints:     u.rewardPoints || 0,
    // Compute fresh score — don't rely on stored leaderboardScore
    leaderboardScore: computeLeaderboardScore(u),
  }));

  // Sort descending by score, then by streak as tiebreaker
  scored.sort((a, b) => {
    if (b.leaderboardScore !== a.leaderboardScore) return b.leaderboardScore - a.leaderboardScore;
    return b.currentStreak - a.currentStreak;
  });

  // Assign ranks
  scored.forEach((u, i) => { u.rank = i + 1; });

  // Find current user's rank across ALL users (not just top N)
  let myRank = null;
  let myEntry = null;
  if (currentUserId) {
    const idx = scored.findIndex(u => u._id.toString() === currentUserId.toString());
    if (idx !== -1) {
      myRank = idx + 1;
      myEntry = scored[idx];
    }
  }

  // Return top N for display
  const topN = scored.slice(0, limit);

  return { topN, myRank, myEntry, totalUsers: scored.length };
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

    // In-app notification
    await createNotification({
      userId: user._id,
      type: 'STREAK_LOST',
      title: 'Streak Lost',
      message: `Your ${lostStreak}-day streak has ended. Start a new one today!`,
      priority: 'high',
      actionUrl: '#gamification',
      actionText: 'Rebuild Streak',
    });

    // Email notification
    if (user.emailNotifications !== false) {
      await sendStreakLostEmail(user, lostStreak).catch(e =>
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
            <a href="https://dolphin-main.vercel.app/dashboard#gamification"
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
    subject: `Your ${lostStreak}-day streak has ended — rebuild it today!`,
    message: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="https://api.dolphinorg.in/logo-icon.svg" alt="Dolphin" style="height: 48px;" />
          <h2 style="color: #1E3A8A; margin: 12px 0 0;">Dolphin</h2>
        </div>
        <h2 style="color: #DC2626;">Your streak has ended</h2>
        <p style="color: #374151; line-height: 1.6;">
          Hi <strong>${user.name}</strong>, your <strong>${lostStreak}-day streak</strong> has ended because you missed a day of activity.
        </p>
        <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔥</div>
          <p style="color: #991B1B; font-weight: 600; margin: 0;">
            ${lostStreak}-day streak lost
          </p>
        </div>
        <p style="color: #374151; line-height: 1.6;">
          Don't give up! Every great streak starts with a single day. Log in today to start a new streak and work towards your next reward:
        </p>
        <ul style="color: #374151; line-height: 2;">
          <li><strong>30 days</strong> → Dolphin Cap</li>
          <li><strong>60 days</strong> → Dolphin Bottle</li>
          <li><strong>90 days</strong> → Dolphin Bag</li>
        </ul>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://dolphin-main.vercel.app"
             style="display: inline-block; padding: 12px 28px; background: #84CC16; color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">
            Rebuild My Streak
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
