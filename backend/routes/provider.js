// backend/routes/provider.js - UPDATED with proper visibility rules
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');

// Get or create provider profile
router.get('/profile', protect, async (req, res) => {
  try {
    let provider = await Provider.findOne({ userId: req.user.id })
      .populate('userId', 'name email state stage');
    
    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider profile not found',
        nextSteps: 'Create a provider profile by updating your settings'
      });
    }

    res.json(provider);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update provider profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, category, description, bio, experienceLevel, specialties, availability, contactMethod, stageCategories } = req.body;

    if (!name || !category || !description) {
      return res.status(400).json({ 
        message: 'name, category, and description are required',
        nextSteps: 'Provide complete provider profile information'
      });
    }

    let provider = await Provider.findOneAndUpdate(
      { userId: req.user.id },
      {
        name,
        category,
        description,
        bio,
        experienceLevel,
        specialties: specialties || [],
        availability,
        contactMethod,
        stageCategories: stageCategories || [1, 2, 3, 4, 5],
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    ).populate('userId', 'name email state stage');

    res.json({
      message: 'Provider profile updated successfully',
      provider,
      nextSteps: 'Your profile is now visible to founders'
    });
  } catch (error) {
    console.error('Error updating provider profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PROVIDER VISIBILITY RULE:
 * Startups are visible to service providers ONLY after completing ALL 5 validation stages.
 * This ensures providers work with fully validated, high-quality startups.
 */
router.get('/eligible-founders', protect, async (req, res) => {
  try {
    const provider = await Provider.findOne({ userId: req.user.id });
    if (!provider) {
      return res.status(404).json({ 
        message: 'Provider profile not found',
        nextSteps: 'Create a provider profile first'
      });
    }

    // Get all startups
    const allStartups = await Startup.find()
      .populate('founderId', 'name email state stage');

    // Filter for provider visibility: ALL 5 stages must be completed
    const VALIDATION_STAGES = ['idea', 'problem', 'solution', 'market', 'business'];
    
    const eligibleStartups = allStartups.filter(startup => {
      const stages = startup.validationStages || {};
      
      // Check if ALL 5 stages are completed (not just validated, but completed)
      const allStagesCompleted = VALIDATION_STAGES.every(stageKey => {
        const stage = stages[stageKey];
        return stage && stage.completedAt;
      });

      // Only show startups that have completed the full roadmap
      return allStagesCompleted;
    });

    // Apply provider's stage category filter (for future flexibility)
    const stageCategories = provider.stageCategories || [];
    const filteredStartups = stageCategories.length > 0
      ? eligibleStartups.filter(s => stageCategories.includes(s.currentStage))
      : eligibleStartups;

    // Map to response format
    const response = filteredStartups.map(startup => {
      const stages = startup.validationStages || {};
      
      // Count validated stages
      const validatedCount = VALIDATION_STAGES.filter(key => 
        stages[key]?.isValidated
      ).length;

      return {
        startupId: startup._id,
        startupName: startup.name,
        thesis: startup.thesis,
        industry: startup.industry,
        currentStage: startup.currentStage,
        validationScore: startup.validationScore, // Overall score
        stagesCompleted: 5, // All 5 stages completed (requirement for visibility)
        stagesValidated: validatedCount,
        founder: startup.founderId,
        problemStatement: startup.problemStatement,
        targetUsers: startup.targetUsers,
        createdAt: startup.createdAt
      };
    }).sort((a, b) => b.validationScore - a.validationScore);

    res.json(response);
  } catch (error) {
    console.error('Error fetching eligible founders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verified providers
router.get('/', protect, async (req, res) => {
  try {
    let query = { verified: true };

    // Contextual matching for founders
    if (req.user.role === 'founder') {
      const startup = await Startup.findOne({ founderId: req.user.id });
      
      if (startup && startup.milestones?.length > 0) {
        const nextMilestone = startup.milestones.find(m => !m.isCompleted);
        const currentStage = nextMilestone ? nextMilestone.order : 3;

        query = { ...query, stageCategories: currentStage };
      }
    }

    const providers = await Provider.find(query)
      .populate('userId', 'name email state stage')
      .sort({ rating: -1, name: 1 });

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Request introduction
router.post('/request-intro', protect, checkStageAccess, async (req, res) => {
  try {
    const { providerId } = req.body;

    if (!providerId) {
      return res.status(400).json({ 
        message: 'providerId is required',
        nextSteps: 'Select a provider to request introduction'
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider || !provider.verified) {
      return res.status(404).json({ 
        message: 'Provider not found or not verified',
        nextSteps: 'Select a verified provider'
      });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ 
        message: 'No startup found',
        nextSteps: 'Create a startup first'
      });
    }

    const existingRequest = await IntroRequest.findOne({
      providerId: provider.userId,
      founderId: req.user.id,
      startupId: startup._id,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      return res.status(409).json({ 
        message: 'Introduction request already exists',
        reason: 'You already have a pending or accepted request with this provider',
        nextSteps: 'Wait for response or choose a different provider'
      });
    }

    const request = await IntroRequest.create({
      providerId: provider.userId,
      founderId: req.user.id,
      startupId: startup._id,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Introduction request sent successfully',
      requestId: request._id,
      status: 'pending',
      nextSteps: 'Wait for provider to respond to your request'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get provider's requests
router.get('/my-requests', protect, async (req, res) => {
  try {
    const requests = await IntroRequest.find({ providerId: req.user.id })
      .populate('startupId', 'name thesis validationScore industry')
      .populate('founderId', 'name email')
      .sort({ createdAt: -1 });

    const requestStats = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      accepted: requests.filter(r => r.status === 'accepted').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };

    res.json({ requests, stats: requestStats });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status
router.put('/requests/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status',
        nextSteps: 'Status must be either "accepted" or "rejected"'
      });
    }

    const request = await IntroRequest.findById(id);
    if (!request) {
      return res.status(404).json({ 
        message: 'Request not found',
        nextSteps: 'Check the request ID and try again'
      });
    }

    if (request.providerId.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Access denied',
        nextSteps: 'You can only manage your own requests'
      });
    }

    request.status = status;
    await request.save();

    const provider = await Provider.findOne({ userId: req.user.id });
    if (provider) {
      if (status === 'accepted') {
        provider.engagementCount = (provider.engagementCount || 0) + 1;
      }
      provider.responseRate = 100;
      await provider.save();
    }

    res.json({
      message: `Request ${status} successfully`,
      status: request.status,
      nextSteps: status === 'accepted' 
        ? 'Introduction has been approved. Contact information will be shared.' 
        : 'Introduction request has been rejected.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Search providers by category or specialty
router.get('/search', protect, async (req, res) => {
  try {
    const { category, specialty, availability } = req.query;
    let query = { verified: true };

    if (category) {
      query.category = new RegExp(category, 'i');
    }

    if (specialty) {
      query.specialties = new RegExp(specialty, 'i');
    }

    if (availability) {
      query.availability = availability;
    }

    const providers = await Provider.find(query)
      .populate('userId', 'name email')
      .sort({ rating: -1 });

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;