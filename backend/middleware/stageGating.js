const Startup = require('../models/Startup');

/**
 * Stage gating middleware (security boundary). samesite
 *
 * Enforces that:
 * - user is authenticated (handled by `protect`)
 * - user is not PENDING_APPROVAL or BLOCKED
 * - a founder has an associated Startup record for startup-dependent actions
 *
 * Note: milestone ordering rules are enforced inside milestone update logic (e.g. `milestoneService`).
 */
const checkStageAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: 'User not authenticated',
        nextSteps: 'Login again'
      });
    }

    if (req.user.state === 'PENDING_APPROVAL') {
      return res.status(403).json({
        message: 'Access denied',
        reason: 'Account pending admin approval',
        nextSteps: 'Wait for admin approval to access this feature'
      });
    }

    if (req.user.state === 'BLOCKED') {
      return res.status(403).json({
        message: 'Access denied',
        reason: 'Account blocked by administrator',
        nextSteps: 'Contact support or an administrator for assistance'
      });
    }

    // This middleware is currently only used for founder-driven actions.
    if (req.user.role !== 'founder') {
      return res.status(403).json({
        message: 'Access denied',
        reason: 'This action is for founders only',
        nextSteps: 'Use an account with the founder role'
      });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({
        message: 'Startup not found',
        nextSteps: 'Create a startup first to access this feature'
      });
    }

    // Attach for downstream handlers to avoid re-querying.
    req.startup = startup;

    next();
  } catch (error) {
    console.error('Stage gating error:', error);
    res.status(500).json({ message: 'Server error during stage validation' });
  }
};

module.exports = checkStageAccess;
