// backend/routes/founder.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Log = require('../models/Log');
const { updateMilestone } = require('../services/milestoneService');

// Get founder's startup
router.get('/my-startup', protect, async (req, res) => {
  try {
    // Check if user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const startup = await Startup.findOne({ founderId: req.user.id })
      .populate('auditLogs');
    
    if (!startup) {
      return res.status(404).json({ 
        message: 'No startup found',
        nextSteps: 'Create a startup first to access this feature'
      });
    }

    res.json(startup);
  } catch (error) {
    console.error('Error fetching startup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create startup
router.post('/', protect, async (req, res) => {
  try {
    // Check if user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const { name, thesis, industry } = req.body;

    if (!name || !thesis) {
      return res.status(400).json({ 
        message: 'Name and thesis are required',
        nextSteps: 'Provide a name and problem statement for your startup'
      });
    }

    const initialMilestones = [
      { title: 'Idea Validation', description: 'Validate your initial idea', order: 1 },
      { title: 'Problem Definition', description: 'Deep dive into the problem', order: 2 },
      { title: 'Solution Development', description: 'Develop your solution', order: 3 },
      { title: 'Market Validation', description: 'Validate your market', order: 4 },
      { title: 'Business Model Validation', description: 'Validate your business model', order: 5 }
    ];

    const startup = await Startup.create({
      founderId: req.user.id,
      name,
      thesis,
      industry,
      milestones: initialMilestones,
      auditLogs: []
    });

    // Create audit log
    const log = await Log.create({
      userId: req.user.id,
      action: 'startup_created',
      details: { startupId: startup._id, name }
    });
    startup.auditLogs.push(log._id);
    await startup.save();

    // Return populated startup
    const populatedStartup = await Startup.findById(startup._id).populate('auditLogs');
    res.status(201).json(populatedStartup);
  } catch (error) {
    console.error('Error creating startup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update milestone - FIXED endpoint to match frontend expectations
router.put('/milestones', protect, checkStageAccess, async (req, res) => {
  try {
    // Check if user exists in request
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const { milestoneId, isCompleted } = req.body;

    if (!milestoneId || isCompleted === undefined) {
      return res.status(400).json({ 
        message: 'milestoneId and isCompleted are required',
        nextSteps: 'Select a milestone and mark it as completed'
      });
    }

    // Verify user owns the startup
    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found or access denied',
        nextSteps: 'Create a startup first or check your permissions'
      });
    }

    const updatedStartup = await updateMilestone(
      startup._id, 
      milestoneId, 
      isCompleted, 
      req.user.id
    );

    res.json(updatedStartup);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(400).json({ 
      message: error.message,
      nextSteps: error.message.includes('previous milestone') 
        ? 'Complete and verify the previous milestone first'
        : 'Check your milestone selection and try again'
    });
  }
});

module.exports = router;