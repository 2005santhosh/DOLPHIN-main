// routes/startup.js
const express = require('express');
const router = express.Router();
const Startup = require('../models/Startup');
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');
const checkStageGating = require('../middleware/stageGating');

/**
 * GET /api/startups/my-startup
 * Fetches the startup associated with the authenticated founder
 * Requires user to be in APPROVED state
 */
router.get('/my-startup', protect, checkStageGating('APPROVED'), async (req, res) => {
  try {
    const startup = await Startup.findOne({ founderId: req.user.id }).populate('auditLogs');
    if (!startup) {
      return res.status(404).json({ message: 'No startup found for this founder' });
    }
    res.status(200).json(startup);
  } catch (error) {
    console.error('Error fetching startup:', error);
    res.status(500).json({ message: 'Server error while fetching startup' });
  }
});

/**
 * POST /api/startups
 * Creates a new startup for the authenticated founder
 * Initializes with default 7-stage milestones
 */
router.post('/', protect, checkStageGating('APPROVED'), async (req, res) => {
  const { name, thesis, industry } = req.body;

  if (!name || !thesis) {
    return res.status(400).json({ message: 'Name and thesis are required' });
  }

  const initialMilestones = [
    { title: 'Idea Clarity', description: 'Define your core idea and target market.', isCompleted: false, verified: false, order: 1 },
    { title: 'Problem Validation', description: 'Validate the problem with data.', isCompleted: false, verified: false, order: 2 },
    { title: 'Customer Interviews', description: 'Conduct 20+ customer interviews.', isCompleted: false, verified: false, order: 3 },
    { title: 'Solution Fit', description: 'Test solution hypotheses.', isCompleted: false, verified: false, order: 4 },
    { title: 'MVP Prototype', description: 'Build and test MVP.', isCompleted: false, verified: false, order: 5 },
    { title: 'Traction Metrics', description: 'Achieve initial traction (e.g., users/revenue).', isCompleted: false, verified: false, order: 6 },
    { title: 'Funding Readiness', description: 'Prepare pitch and financials.', isCompleted: false, verified: false, order: 7 }
  ];

  try {
    const startup = await Startup.create({
      founderId: req.user.id,
      name,
      thesis,
      industry,
      milestones: initialMilestones,
      auditLogs: []
    });

    // Create audit log for startup creation
    const log = await Log.create({
      userId: req.user.id,
      action: 'startup_created',
      details: { startupId: startup._id, name }
    });
    startup.auditLogs.push(log._id);
    await startup.save();

    res.status(201).json(startup);
  } catch (error) {
    console.error('Error creating startup:', error);
    res.status(500).json({ message: 'Server error while creating startup' });
  }
});

/**
 * PUT /api/startups/:id/milestones
 * Updates a milestone's completion status (founder only)
 * Enforces gating: Cannot complete out-of-order
 * Resets verification on change
 */
router.put('/:id/milestones', protect, checkStageGating('APPROVED'), async (req, res) => {
  const { milestoneId, isCompleted } = req.body;

  if (milestoneId === undefined || isCompleted === undefined) {
    return res.status(400).json({ message: 'milestoneId and isCompleted are required' });
  }

  try {
    const startup = await Startup.findOne({ _id: req.params.id, founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ message: 'Startup not found or unauthorized' });
    }

    const milestoneIndex = startup.milestones.findIndex(m => m._id.toString() === milestoneId);
    if (milestoneIndex === -1) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    const milestone = startup.milestones[milestoneIndex];

    // Gating enforcement
    if (isCompleted && milestone.order > 1) {
      const prevMilestone = startup.milestones.find(m => m.order === milestone.order - 1);
      if (!prevMilestone || !prevMilestone.verified) {
        return res.status(400).json({ 
          message: 'Complete and verify previous milestone first',
          reason: 'Stage gating requires all previous milestones to be verified'
        });
      }
    }

    milestone.isCompleted = isCompleted;
    milestone.verified = false; // Reset verification on founder update

    // Recalculate score based on verified only
    const verifiedCount = startup.milestones.filter(m => m.verified).length;
    startup.validationScore = Math.round((verifiedCount / startup.milestones.length) * 100);

    // Create audit log
    const log = await Log.create({
      userId: req.user.id,
      action: 'milestone_updated',
      details: { milestoneId, isCompleted, startupId: startup._id }
    });
    startup.auditLogs.push(log._id);

    await startup.save();
    res.status(200).json(startup);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ message: 'Server error while updating milestone' });
  }
});

module.exports = router;