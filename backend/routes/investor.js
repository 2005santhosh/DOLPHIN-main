// backend/routes/investor.js - UPDATED with proper visibility rules
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const User = require('../models/User');

// Get investor profile
router.get('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .select('name email stage state');

    if (!investor) {
      return res.status(404).json({ 
        message: 'Investor profile not found',
        nextSteps: 'Verify your account'
      });
    }

    res.json(investor);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update investor profile with preferences
router.put('/profile', protect, authorize('investor'), async (req, res) => {
  try {
    const { interestAreas, stagePreference } = req.body;

    const investor = await User.findByIdAndUpdate(
      req.user.id,
      { 
        interestAreas: interestAreas || [],
        stagePreference: stagePreference || [4, 5]
      },
      { new: true }
    ).select('name email interestAreas stagePreference');

    res.json({
      message: 'Investor preferences updated successfully',
      investor
    });
  } catch (error) {
    console.error('Error updating investor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const VALIDATION_SCORE_THRESHOLD = 70;

/**
 * INVESTOR VISIBILITY RULE:
 * Startups appear on investor dashboard when overall validation score ≥ 70%.
 * Overall score = average of all completed validation stages.
 */
router.get('/validated-startups', protect, authorize('investor'), async (req, res) => {
  try {
    const allStartups = await Startup.find()
      .populate('founderId', 'name email state stage');

    // Filter: overall validationScore >= 70% (average of completed stages)
    const validatedStartups = allStartups.filter(startup => {
      const overall = startup.validationScore ?? 0;
      return overall >= VALIDATION_SCORE_THRESHOLD;
    });

    const stages = (s) => s.validationStages || {};
    const response = validatedStartups
      .map(startup => {
        const st = stages(startup);
        const lastValidated = Math.max(
          0,
          ...Object.values(st)
            .filter(s => s?.completedAt)
            .map(s => new Date(s.completedAt).getTime())
        );
        return {
          _id: startup._id,
          name: startup.name,
          thesis: startup.thesis,
          industry: startup.industry,
          validationScore: startup.validationScore ?? 0,
          overallScore: startup.validationScore ?? 0,
          currentStage: startup.currentStage,
          stagesCompleted: Object.values(st).filter(s => s?.completedAt).length,
          stagesValidated: Object.values(st).filter(s => s?.isValidated).length,
          milestoneCount: startup.milestones?.length || 0,
          completedMilestones: startup.milestones?.filter(m => m.isCompleted).length || 0,
          founder: startup.founderId,
          problemStatement: startup.problemStatement,
          targetUsers: startup.targetUsers,
          createdAt: startup.createdAt,
          lastValidated
        };
      })
      .sort((a, b) => (b.validationScore || 0) - (a.validationScore || 0));

    res.json(response);
  } catch (error) {
    console.error('Error fetching validated startups:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all startups (with filtering)
router.get('/startups', protect, authorize('investor'), async (req, res) => {
  try {
    const { minScore, stage, industry } = req.query;
    let filter = {};

    if (minScore) {
      filter.validationScore = { $gte: parseInt(minScore) };
    }

    if (stage) {
      filter.currentStage = parseInt(stage);
    }

    if (industry) {
      filter.industry = new RegExp(industry, 'i');
    }

    const startups = await Startup.find(filter)
      .populate('founderId', 'name email')
      .sort({ validationScore: -1 });

    const response = startups.map(startup => ({
      _id: startup._id,
      name: startup.name,
      thesis: startup.thesis,
      industry: startup.industry,
      validationScore: startup.validationScore,
      currentStage: startup.currentStage,
      founder: startup.founderId,
      problemStatement: startup.problemStatement,
      targetUsers: startup.targetUsers,
      createdAt: startup.createdAt
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add startup to watchlist
router.post('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId } = req.body;

    if (!startupId) {
      return res.status(400).json({ 
        message: 'startupId is required',
        nextSteps: 'Select a startup to add to your watchlist'
      });
    }

    const startup = await Startup.findById(startupId);
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Select a valid startup'
      });
    }

    const investor = await User.findById(req.user.id);
    if (!investor.watchlist) {
      investor.watchlist = [];
    }

    if (!investor.watchlist.includes(startupId)) {
      investor.watchlist.push(startupId);
      await investor.save();
    }

    res.status(201).json({
      message: 'Startup added to watchlist',
      watchlistCount: investor.watchlist.length
    });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get investor's watchlist
router.get('/watchlist', protect, authorize('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .populate({
        path: 'watchlist',
        select: 'name thesis industry validationScore currentStage founderId'
      });

    if (!investor.watchlist) {
      return res.json([]);
    }

    const watchlist = investor.watchlist.map(startup => ({
      _id: startup._id,
      name: startup.name,
      thesis: startup.thesis,
      industry: startup.industry,
      validationScore: startup.validationScore,
      currentStage: startup.currentStage,
      founder: startup.founderId
    }));

    res.json(watchlist);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove from watchlist
router.delete('/watchlist/:startupId', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId } = req.params;

    const investor = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { watchlist: startupId } },
      { new: true }
    );

    res.json({
      message: 'Startup removed from watchlist',
      watchlistCount: investor.watchlist?.length || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Express interest in a startup
router.post('/express-interest', protect, authorize('investor'), async (req, res) => {
  try {
    const { startupId, message } = req.body;

    if (!startupId) {
      return res.status(400).json({ 
        message: 'startupId is required',
        nextSteps: 'Select a startup to express interest'
      });
    }

    const startup = await Startup.findById(startupId);
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Select a valid startup'
      });
    }

    if (!startup.investorInterests) {
      startup.investorInterests = [];
    }

    if (startup.investorInterests.find(i => i.investorId.toString() === req.user.id)) {
      return res.status(409).json({ 
        message: 'You have already expressed interest in this startup',
        nextSteps: 'Wait for founder response'
      });
    }

    startup.investorInterests.push({
      investorId: req.user.id,
      message: message || '',
      expressedAt: new Date()
    });

    await startup.save();

    res.status(201).json({
      message: 'Interest expressed successfully',
      nextSteps: 'The founder will be notified of your interest'
    });
  } catch (error) {
    console.error('Error expressing interest:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get providers
router.get('/providers', protect, authorize('investor'), async (req, res) => {
  try {
    const providers = await Provider.find({ verified: true })
      .populate('userId', 'name email')
      .sort({ rating: -1, name: 1 });

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get startup details
router.get('/startups/:id', protect, authorize('investor'), async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id)
      .populate('founderId', 'name email')
      .populate('auditLogs');

    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Verify the startup ID'
      });
    }

    res.json(startup);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;