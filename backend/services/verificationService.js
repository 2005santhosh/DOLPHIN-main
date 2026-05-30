/**
 * verificationService.js
 * PAYMENT-ONLY verification. No founder/admin/legacy paths.
 *
 * A user is verified ONLY IF:
 *   user.isVerified === true
 *   AND user.verifiedSource === 'payment'
 *   AND user.verifiedUntil exists
 *   AND user.verifiedUntil > now
 */
const User = require('../models/User');
const VerificationPayment = require('../models/VerificationPayment');

const ELIGIBLE_PROFILE_TYPES = ['founder', 'provider', 'investor'];
const PENDING_TTL_MIN = () => Number(process.env.VERIFICATION_PENDING_TTL_MINUTES || 30);

/** Single source of truth — payment-only */
function isUserActuallyVerified(user) {
  if (!user) return false;
  return (
    user.isVerified === true &&
    user.verifiedSource === 'payment' &&
    !!user.verifiedUntil &&
    new Date(user.verifiedUntil) > new Date()
  );
}

/** Can this user purchase verification? */
function canPurchaseVerification(user) {
  if (!user) return { ok: false, reason: 'not_authenticated' };
  if (!ELIGIBLE_PROFILE_TYPES.includes(user.role))
    return { ok: false, reason: 'ineligible_profile_type' };
  if (isUserActuallyVerified(user))
    return { ok: false, reason: 'already_active' };
  return { ok: true };
}

/** Build unified status for frontend — 3 states only */
async function buildVerificationStatus(user) {
  const verified = isUserActuallyVerified(user);

  let daysLeft = null;
  if (verified && user.verifiedUntil) {
    daysLeft = Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000));
  }

  let pendingPayment = null;
  if (!verified) {
    const cutoff = new Date(Date.now() - PENDING_TTL_MIN() * 60 * 1000);
    pendingPayment = await VerificationPayment.findOne({
      userId: user._id,
      status: { $in: ['created', 'pending'] },
      createdAt: { $gte: cutoff },
    }).select('cashfreeOrderId status createdAt').lean();
  }

  return {
    profileType:              user.role,
    isVerified:               verified,
    verifiedSource:           verified ? 'payment' : null,
    verifiedAt:               verified ? user.verifiedAt : null,
    verifiedUntil:            verified ? user.verifiedUntil : null,
    daysLeft,
    activePlan:               verified ? 'monthly' : null,
    shouldShowCTA:            !verified && !pendingPayment,
    shouldShowPending:        !verified && !!pendingPayment,
    shouldShowVerifiedMessage: verified,
    pendingPayment:           pendingPayment ? {
      orderId:   pendingPayment.cashfreeOrderId,
      status:    pendingPayment.status,
      createdAt: pendingPayment.createdAt,
    } : null,
  };
}

module.exports = {
  isUserActuallyVerified,
  canPurchaseVerification,
  buildVerificationStatus,
  ELIGIBLE_PROFILE_TYPES,
};
