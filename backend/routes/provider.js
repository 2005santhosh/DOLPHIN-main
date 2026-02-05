// backend/routes/provider.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');

// ==========================================
// 1. Get or create provider profile
// ==========================================
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

// ==========================================
// 2. Update provider profile
// ==========================================
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
        stageCategories: stageCategories || [],
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

// ==========================================
// 3. Get eligible founders (STRICT 5-STAGE LOGIC + UNIVERSAL VISIBILITY)
// ==========================================
router.get('/eligible-founders', protect, async (req, res) => {
  
  console.log('!!! ROUTE HIT: /eligible-founders !!!');
  console.log('User ID:', req.user.id);
  
  try {
    const provider = await Provider.findOne({ userId: req.user.id });
    if (!provider) {
      console.log('!! PROVIDER PROFILE NOT FOUND !!');
      return res.status(404).json({ 
        message: 'Provider profile not found',
        nextSteps: 'Create a provider profile first'
      });
    }

    const allStartups = await Startup.find()
      .populate('founderId', 'name email state stage'); 

    console.log(`--- Total Startups in DB: ${allStartups.length} ---`);

    const VALIDATION_STAGES = ['idea', 'problem', 'solution', 'market', 'business'];
    
    // FILTER 1: STRICT REQUIREMENT - ALL 5 STAGES MUST BE VALIDATED
    const eligibleStartups = allStartups.filter(startup => {
      const stages = startup.validationStages || {};
      
      let isEligible = true;
      
      for (const stageKey of VALIDATION_STAGES) {
        const stage = stages[stageKey];
        const isComplete = stage && (stage.completedAt || stage.isValidated);
        
        if (!isComplete) {
          console.log(`❌ REJECTED "${startup.name}": Missing/Incomplete stage [${stageKey}] (Has data: ${!!stage}, IsValidated: ${!!stage?.isValidated})`);
          isEligible = false;
          break;
        }
      }

      if (isEligible) {
        console.log(`✅ PASSED "${startup.name}": All 5 stages validated.`);
      }

      return isEligible;
    });

    console.log(`--- Count after Strict Check: ${eligibleStartups.length} ---`);

    // FILTER 2: PROVIDER PREFERENCES (Stage Categories)
    const providerCategories = provider.stageCategories || [];
    console.log(`🔍 Provider Stage Categories:`, providerCategories);

    // Updated Logic: 
    // 1. If a startup is at Stage 5 (Completed All), show them to ALL providers (Universal Match).
    // 2. Otherwise, respect the Provider's specific category filter.
    const filteredStartups = eligibleStartups.filter(s => {
      
      // SPECIAL RULE: Fully validated founders (Stage 5) are visible to everyone
      if (s.currentStage === 5) {
        console.log(`✅ SHOWN "${s.name}": Completed all stages (Stage 5) - Visible to all providers.`);
        return true;
      }

      // NORMAL RULE: Respect category preferences for non-completed founders
      if (providerCategories.length === 0) return true;
      
      const isMatch = providerCategories.includes(s.currentStage);
      if (!isMatch) {
        console.log(`⚠️  FILTERED OUT "${s.name}": Current Stage ${s.currentStage} not in Provider Categories ${providerCategories}`);
      }
      return isMatch;
    });

    console.log(`--- Final Result Count: ${filteredStartups.length} ---`);

    // Map to response format that matches Frontend expectations
    const response = filteredStartups.map(startup => {
      const stages = startup.validationStages || {};
      const validatedCount = VALIDATION_STAGES.filter(key => stages[key]?.isValidated).length;

      return {
        startupId: startup._id,
        startupName: startup.name,
        thesis: startup.thesis,
        industry: startup.industry,
        currentStage: startup.currentStage,
        validationScore: startup.validationScore,
        stagesCompleted: 5,
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

// ==========================================
// 4. Get verified providers
// ==========================================
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

// ==========================================
// 5. Request introduction
// ==========================================
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

// ==========================================
// 6. Get provider's requests
// ==========================================
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

// ==========================================
// 7. Update request status
// ==========================================
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

// ==========================================
// 8. Search providers
// ==========================================
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