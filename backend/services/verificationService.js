/**
 * verificationService.js
 * Single source of truth for all verification logic.
 *
 * Verification sources:
 *   'founder'  — lifetime badge granted to early supporters (isFounderVerified=true)
 *   'admin'    — manually granted by admin (isAdminVerified=true)
 *   'payment'  — paid monthly badge (isVerified=true + verifiedUntil in future)
 *   null       — not verified
 *
 * All profile types (founder, provider, investor) can be verified.
 * "founder-verified" means early-supporter lifetime badge, NOT the founder profile type.
 */

const User = require('../models/User');
const VerificationPayment = require('../models/VerificationPayment');

// All profile types eligible for paid verification
const ELIGIBLE_PROFILE_TYPES = ['founder', 'provider', 'investor'];

/**
 * Core verification check — single source of truth.
 * Returns true if the user has ANY active verification.
 */
function isUserActuallyVerified(user) {
  if (!user) return false;
  // Founder-lifetime badge (early supporters)
  if (user.isFounderVerified) return true;
  // Admin-manually verified (legacy or explicit admin grant)
  if (user.isAdminVerified) return true;
  // Paid badge — must have isVerified=true AND either no expiry (legacy) or future expiry
  if (user.isVerified) {
    if (!user.verifiedUntil) return true; // legacy lifetime (pre-monthly system)
    return new Date(user.verifiedUntil) > new Date();
  }
  return false;
}

/**
 * Determine the source of verification.
 */
function getVerifiedSource(user) {
  if (!user) return null;
  if (user.isFounderVerified) return 'founder';
  if (user.isAdminVerified) return 'admin';
  if (user.isVerified) return 'payment';
  return null;
}

/**
 * Is this a lifetime badge (no expiry)?
 */
function isLifetimeBadge(user) {
  if (!user) return false;
  if (user.isFounderVerified) return true;
  if (user.isAdminVerified) return true;
  if (user.isVerified && !user.verifiedUntil) return true; // legacy
  return false;
}

/**
 * Can this user purchase a paid verification?
 */
function canPurchaseVerification(user) {
  if (!user) return { ok: false, reason: 'not_authenticated' };
  if (!ELIGIBLE_PROFILE_TYPES.includes(user.role)) {
    return { ok: false, reason: 'ineligible_profile_type' };
  }
  if (user.isFounderVerified) return { ok: false, reason: 'founder_lifetime' };
  if (user.isAdminVerified) return { ok: false, reason: 'admin_verified' };
  if (isUserActuallyVerified(user)) return { ok: false, reason: 'already_active' };
  return { ok: true };
}

/**
 * Build the unified status response for the frontend.
 * This is the ONLY place that determines what the UI shows.
 */
async function buildVerificationStatus(user) {
  const verified = isUserActuallyVerified(user);
  const source = getVerifiedSource(user);
  const lifetime = isLifetimeBadge(user);

  // Days left (only for paid monthly badges)
  let daysLeft = null;
  if (user.isVerified && user.verifiedUntil && !lifetime) {
    daysLeft = Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000));
  }

  // Pending payment check (only if not verified)
  let pendingPayment = null;
  if (!verified) {
    const PENDING_TTL_MIN = Number(process.env.VERIFICATION_PENDING_TTL_MINUTES || 30);
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MIN * 60 * 1000);
    pendingPayment = await VerificationPayment.findOne({
      userId: user._id,
      status: { $in: ['created', 'pending'] },
      createdAt: { $gte: pendingCutoff },
    }).select('cashfreeOrderId status createdAt').lean();
  }

  // UI decision flags
  const shouldShowCTA = !verified && !pendingPayment;
  const shouldShowPending = !verified && !!pendingPayment;
  const shouldShowVerifiedMessage = verified;

  return {
    profileType:              user.role,
    isVerified:               verified,
    isFounderVerified:        user.isFounderVerified || false,
    isAdminVerified:          user.isAdminVerified || false,
    verifiedSource:           source,
    verifiedAt:               user.verifiedAt || null,
    verifiedUntil:            lifetime ? null : (user.verifiedUntil || null),
    daysLeft,
    activePlan:               verified ? (lifetime ? 'lifetime' : 'monthly') : null,
    shouldShowCTA,
    shouldShowPending,
    shouldShowVerifiedMessage,
    pendingPayment:           pendingPayment ? {
      orderId:   pendingPayment.cashfreeOrderId,
      status:    pendingPayment.status,
      createdAt: pendingPayment.createdAt,
    } : null,
  };
}

/**
 * Migrate legacy verified users to the correct source field.
 * Safe to run multiple times (idempotent).
 * - isVerified=true + isFounderVerified=false + verifiedUntil=null → isFounderVerified=true (early supporter)
 * - isVerified=true + isAdminVerified=false + verifiedUntil=null + no payment record → isAdminVerified=true
 */
async function migrateLegacyVerifiedUsers() {
  // All users with isVerified=true but no source field set and no verifiedUntil
  const legacyUsers = await User.find({
    isVerified: true,
    isFounderVerified: { $ne: true },
    isAdminVerified: { $ne: true },
    verifiedUntil: null,
  }).select('_id email isVerified isFounderVerified isAdminVerified verifiedUntil').lean();

  let founderCount = 0;
  let adminCount = 0;

  for (const u of legacyUsers) {
    // Check if there's a paid payment record for this user
    const hasPaidRecord = await VerificationPayment.exists({ userId: u._id, status: 'paid' });
    if (!hasPaidRecord) {
      // No payment record — this was an admin/manual verification
      // We treat these as admin-verified (preserves their lifetime status)
      await User.findByIdAndUpdate(u._id, { $set: { isAdminVerified: true } });
      adminCount++;
    }
  }

  console.log(`[Migration] Legacy verified users: ${adminCount} marked as admin-verified`);
  return { adminCount };
}

module.exports = {
  isUserActuallyVerified,
  getVerifiedSource,
  isLifetimeBadge,
  canPurchaseVerification,
  buildVerificationStatus,
  migrateLegacyVerifiedUsers,
  ELIGIBLE_PROFILE_TYPES,
};
