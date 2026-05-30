/**
 * verificationHelpers.js — Frontend single source of truth for verification state.
 * Mirrors the backend verificationService logic.
 * Use these helpers everywhere instead of checking fields directly.
 */

/**
 * Is this user actually verified right now?
 * Works for all profile types: founder, provider, investor.
 */
export function isUserActuallyVerified(user) {
  if (!user) return false;
  if (user.isFounderVerified) return true;
  if (user.isAdminVerified) return true;
  if (user.isVerified) {
    if (!user.verifiedUntil) return true; // legacy lifetime
    return new Date(user.verifiedUntil) > new Date();
  }
  return false;
}

/**
 * Is this a lifetime badge (no expiry)?
 */
export function isLifetimeBadge(user) {
  if (!user) return false;
  if (user.isFounderVerified) return true;
  if (user.isAdminVerified) return true;
  if (user.isVerified && !user.verifiedUntil) return true;
  return false;
}

/**
 * Get the verification source label.
 */
export function getVerifiedSource(user) {
  if (!user) return null;
  if (user.isFounderVerified) return 'founder';
  if (user.isAdminVerified) return 'admin';
  if (user.isVerified) return 'payment';
  return null;
}

/**
 * Days left on a paid badge. Returns null for lifetime badges.
 */
export function getBadgeDaysLeft(user) {
  if (!user || !user.isVerified) return null;
  if (isLifetimeBadge(user)) return null;
  if (!user.verifiedUntil) return null;
  return Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000));
}

/**
 * Build UI state from a verificationStatus API response OR from user object.
 * Prefer the API response when available (more accurate).
 */
export function buildUIVerificationState(verifyStatus, user) {
  // If we have a fresh API response, use it
  if (verifyStatus !== null && verifyStatus !== undefined) {
    return {
      isVerified:        verifyStatus.isVerified || false,
      isFounderVerified: verifyStatus.isFounderVerified || false,
      isAdminVerified:   verifyStatus.isAdminVerified || false,
      verifiedSource:    verifyStatus.verifiedSource || null,
      verifiedUntil:     verifyStatus.verifiedUntil || null,
      daysLeft:          verifyStatus.daysLeft ?? null,
      shouldShowCTA:     verifyStatus.shouldShowCTA ?? (!verifyStatus.isVerified && !verifyStatus.pendingPayment),
      shouldShowPending: verifyStatus.shouldShowPending ?? false,
      pendingPayment:    verifyStatus.pendingPayment || null,
      isLifetime:        verifyStatus.isFounderVerified || verifyStatus.isAdminVerified || (verifyStatus.isVerified && !verifyStatus.verifiedUntil),
    };
  }

  // Fallback to user object (from localStorage/AuthContext) while API loads
  const verified = isUserActuallyVerified(user);
  const lifetime = isLifetimeBadge(user);
  return {
    isVerified:        verified,
    isFounderVerified: user?.isFounderVerified || false,
    isAdminVerified:   user?.isAdminVerified || false,
    verifiedSource:    getVerifiedSource(user),
    verifiedUntil:     user?.verifiedUntil || null,
    daysLeft:          getBadgeDaysLeft(user),
    shouldShowCTA:     !verified,
    shouldShowPending: false,
    pendingPayment:    null,
    isLifetime:        lifetime,
  };
}
