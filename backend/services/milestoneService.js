// backend/services/milestoneService.js
const Startup = require('../models/Startup');
const Log = require('../models/Log');

const updateMilestone = async (startupId, milestoneId, isCompleted, userId) => {
  // Find startup and verify user ownership
  const startup = await Startup.findOne({ _id: startupId, founderId: userId });
  
  if (!startup) {
    throw new Error('Startup not found or access denied');
  }

  const milestone = startup.milestones.find(m => m._id.toString() === milestoneId);
  
  if (!milestone) {
    throw new Error('Milestone not found');
  }

  // Check gating rules - only when marking as complete
  if (isCompleted && milestone.order > 1) {
    const prevMilestone = startup.milestones.find(m => m.order === milestone.order - 1);
    if (!prevMilestone || !prevMilestone.verified) {
      throw new Error('Complete and verify previous milestone first');
    }
  }

  // Update milestone status
  milestone.isCompleted = isCompleted;
  milestone.verified = false; // Reset verification on founder update

  // Recalculate validation score
  const verifiedCount = startup.milestones.filter(m => m.verified).length;
  startup.validationScore = Math.round((verifiedCount / startup.milestones.length) * 100);

  // Create audit log
  const log = await Log.create({
    userId,
    action: 'milestone_updated',
    details: { milestoneId, isCompleted, startupId }
  });
  startup.auditLogs.push(log._id);

  await startup.save();
  
  // Return populated startup
  return await Startup.findById(startupId).populate('auditLogs');
};

module.exports = { updateMilestone };