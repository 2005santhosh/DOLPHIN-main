const User = require('../models/User');
const Startup = require('../models/Startup');

const MAX_STAGE = 7;

/**
 * Advances a founder's stage based on Startup milestone completion.
 *
 * This keeps `User.stage/state` aligned with `Startup.currentStage` and milestone progress.
 * NOTE: this service is not currently wired into routes; it's a safe, centralized helper.
 */
const advanceStage = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const startup = await Startup.findOne({ founderId: userId });
  if (!startup) throw new Error('Startup not found');

  // Determine next stage from milestones: first un-verified milestone order is “current”.
  const nextUnverified = startup.milestones
    ?.slice()
    ?.sort((a, b) => a.order - b.order)
    ?.find(m => !m.verified);

  const derivedStage = nextUnverified ? nextUnverified.order : startup.milestones.length;
  const stage = Math.max(1, Math.min(MAX_STAGE, derivedStage));

  user.stage = stage;
  user.state = `STAGE_${stage}`;
  startup.currentStage = stage;

  await Promise.all([user.save(), startup.save()]);
  return user;
};

module.exports = { advanceStage, MAX_STAGE };
