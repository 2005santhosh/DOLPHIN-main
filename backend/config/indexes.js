/**
 * indexes.js — Register all production MongoDB indexes.
 *
 * Run once on startup (idempotent — Mongoose skips existing indexes).
 * Strategy: Equality → Sort → Range order per compound index.
 * Only indexes that match real query patterns in the codebase.
 */

const mongoose = require('mongoose');

async function ensureIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[Indexes] DB not ready, skipping index creation');
      return;
    }

    // ── USER ──────────────────────────────────────────────────────────────────
    // login: { email } unique — already declared in schema (unique:true)
    // leaderboard query: role + leaderboardScore (DESC)
    await db.collection('users').createIndex(
      { role: 1, leaderboardScore: -1 },
      { name: 'role_leaderboardScore', background: true }
    );
    // protect middleware: _id (primary key — already indexed)
    // verified listing sort (investor/founder/provider listing pages)
    await db.collection('users').createIndex(
      { isVerified: 1, verifiedSource: 1, verifiedUntil: 1 },
      { name: 'verification_status', background: true }
    );
    // gamification streak loss cron: lastActivityDate
    await db.collection('users').createIndex(
      { lastActivityDate: 1 },
      { name: 'lastActivityDate', background: true, sparse: true }
    );
    // investor listing: role (to find all investors/providers)
    await db.collection('users').createIndex(
      { role: 1, isDeleted: 1 },
      { name: 'role_isDeleted', background: true }
    );
    // verification expiry cron
    await db.collection('users').createIndex(
      { isVerified: 1, verifiedUntil: 1 },
      { name: 'verifiedUntil_expiry', background: true, sparse: true }
    );

    // ── STARTUP ───────────────────────────────────────────────────────────────
    // founder's own startup lookup
    await db.collection('startups').createIndex(
      { founderId: 1 },
      { name: 'founderId', background: true, unique: true }
    );
    // investor validated startups list: score DESC, then verified-first sort
    await db.collection('startups').createIndex(
      { validationScore: -1, createdAt: -1 },
      { name: 'validationScore_createdAt', background: true }
    );
    // provider eligible founders: all startups — just founderId needed
    await db.collection('startups').createIndex(
      { createdAt: -1 },
      { name: 'createdAt_desc', background: true }
    );

    // ── POST ─────────────────────────────────────────────────────────────────
    // feed query: authorId + createdAt for "mine" filter
    await db.collection('posts').createIndex(
      { authorId: 1, createdAt: -1 },
      { name: 'authorId_createdAt', background: true }
    );
    // feed role-based filter: authorRole + createdAt
    await db.collection('posts').createIndex(
      { authorRole: 1, createdAt: -1 },
      { name: 'authorRole_createdAt', background: true }
    );
    // verified author boost: isAuthorVerified computed field not on Post, but we
    // query User.find({_id:{$in:...},isVerified,verifiedSource,verifiedUntil})
    // — covered by verification_status index on users above

    // ── INTROREQUEST ─────────────────────────────────────────────────────────
    // founder incoming requests
    await db.collection('introrequests').createIndex(
      { founderId: 1, initiator: 1, status: 1 },
      { name: 'founderId_initiator_status', background: true }
    );
    // provider requests
    await db.collection('introrequests').createIndex(
      { providerId: 1, status: 1, createdAt: -1 },
      { name: 'providerId_status_createdAt', background: true }
    );
    // feed connectionMap lookup (IntroRequest side)
    await db.collection('introrequests').createIndex(
      { founderId: 1, providerId: 1 },
      { name: 'founderId_providerId', background: true }
    );
    // startup-based lookup (investor express-interest duplicate check)
    await db.collection('introrequests').createIndex(
      { providerId: 1, startupId: 1 },
      { name: 'providerId_startupId', background: true }
    );

    // ── CONNECTION ────────────────────────────────────────────────────────────
    // status check between two users
    await db.collection('connections').createIndex(
      { from: 1, to: 1 },
      { name: 'from_to', background: true, unique: true }
    );
    // fetch all connections for a user
    await db.collection('connections').createIndex(
      { to: 1, status: 1, createdAt: -1 },
      { name: 'to_status_createdAt', background: true }
    );
    await db.collection('connections').createIndex(
      { from: 1, status: 1, createdAt: -1 },
      { name: 'from_status_createdAt', background: true }
    );
    // chat conversations: messages involving a user
    await db.collection('connections').createIndex(
      { status: 1, from: 1, to: 1 },
      { name: 'status_from_to', background: true }
    );

    // ── MESSAGE ───────────────────────────────────────────────────────────────
    // fetch conversation thread (most common query)
    await db.collection('messages').createIndex(
      { senderId: 1, receiverId: 1, createdAt: 1 },
      { name: 'sender_receiver_createdAt', background: true }
    );
    await db.collection('messages').createIndex(
      { receiverId: 1, senderId: 1, createdAt: 1 },
      { name: 'receiver_sender_createdAt', background: true }
    );

    // ── NOTIFICATION ──────────────────────────────────────────────────────────
    await db.collection('notifications').createIndex(
      { userId: 1, read: 1, createdAt: -1 },
      { name: 'userId_read_createdAt', background: true }
    );
    // cleanup cron: createdAt
    await db.collection('notifications').createIndex(
      { createdAt: 1 },
      { name: 'createdAt_ttl', background: true }
    );

    // ── VERIFICATIONPAYMENT ───────────────────────────────────────────────────
    await db.collection('verificationpayments').createIndex(
      { userId: 1, status: 1 },
      { name: 'userId_status', background: true }
    );
    await db.collection('verificationpayments').createIndex(
      { cfPaymentId: 1 },
      { name: 'cfPaymentId_unique', background: true, unique: true, sparse: true }
    );
    await db.collection('verificationpayments').createIndex(
      { orderId: 1 },
      { name: 'orderId', background: true }
    );

    console.log('[Indexes] All indexes ensured ✓');
  } catch (err) {
    // Non-fatal — app runs fine without perfect indexes, just slower
    console.error('[Indexes] Index creation error (non-fatal):', err.message);
  }
}

module.exports = ensureIndexes;
