/**
 * verificationHelpers.js — Payment-only verification. Single source of truth.
 * A user is verified ONLY IF: isVerified=true AND verifiedSource='payment' AND verifiedUntil > now
 */

export function isUserActuallyVerified(user) {
  if (!user) return false;
  return (
    user.isVerified === true &&
    user.verifiedSource === 'payment' &&
    !!user.verifiedUntil &&
    new Date(user.verifiedUntil) > new Date()
  );
}

export function getBadgeDaysLeft(user) {
  if (!isUserActuallyVerified(user) || !user.verifiedUntil) return null;
  return Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000));
}

/**
 * Build UI state from API response (preferred) or user object (fallback while loading).
 * Returns exactly 3 states: verified | pending | unverified
 */
export function buildUIVerificationState(verifyStatus, user) {
  if (verifyStatus !== null && verifyStatus !== undefined) {
    return {
      isVerified:        verifyStatus.isVerified || false,
      verifiedUntil:     verifyStatus.verifiedUntil || null,
      daysLeft:          verifyStatus.daysLeft ?? null,
      shouldShowCTA:     verifyStatus.shouldShowCTA ?? !verifyStatus.isVerified,
      shouldShowPending: verifyStatus.shouldShowPending ?? false,
      pendingPayment:    verifyStatus.pendingPayment || null,
    };
  }
  // Fallback to user object while API loads
  const verified = isUserActuallyVerified(user);
  return {
    isVerified:        verified,
    verifiedUntil:     user?.verifiedUntil || null,
    daysLeft:          getBadgeDaysLeft(user),
    shouldShowCTA:     !verified,
    shouldShowPending: false,
    pendingPayment:    null,
  };
}
