// backend/routes/provider.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
// ==========================================
// 1. Get or create provider profile
// ==========================================
// @route   GET /api/provider/profile
router.get('/profile', protect, async (req, res) => {
  try {
    // OPTIMIZATION: Use .lean() for pure JSON objects (faster)
    let provider = await Provider.findOne({ userId: req.user.id })
      .populate('userId', 'name email state stage profilePicture ratings')
      .lean(); 
    
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const user = provider.userId || {};
    const ratings = user.ratings || [];
    const totalScore = ratings.reduce((sum, r) => sum + (r.score || 0), 0);
    const avgRating = ratings.length > 0 ? (totalScore / ratings.length) : 0;

    res.json({
      ...provider,
      avgRating: avgRating.toFixed(1),
      name: user.name || provider.name,
      profilePicture: user.profilePicture,
      // CRITICAL: Pass state explicitly for frontend badge logic
      state: user.state 
    });
  } catch (error) {
    console.error('Error fetching provider profile:', error);
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
// backend/routes/provider.js

// ... existing imports and routes ...

// ==========================================
// 3. Get eligible founders (STRICT 5-STAGE LOGIC)
// ==========================================
// ==========================================
// 3. Get eligible founders (NOW SHOWS ALL)
// ==========================================
// @route   GET /api/provider/eligible-founders
router.get('/eligible-founders', protect, async (req, res) => {
  try {
    // 1. FETCH ALL STARTUPS
    // REMOVED: .find({ validationScore: { $gte: 70 } })
    const startups = await Startup.find({}) 
      .populate({
        path: 'founderId',
        select: 'name email profilePicture rewardPoints state',
        match: { isDeleted: { $ne: true } } // Exclude startups of deleted users
      }) 
      .select('name thesis industry validationScore currentStage founderId')
      .lean();

    const eligibleFounders = startups.map(startup => {
      const user = startup.founderId;
      
      // If user is deleted (populate returns null) or missing, filter out
      if (!user) return null;

      return {
        _id: startup._id,
        startupName: startup.name,
        thesis: startup.thesis,
        industry: startup.industry,
        validationScore: startup.validationScore || 0, // Default to 0 if null
        currentStage: startup.currentStage,
        founderId: {
          _id: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          rewardPoints: user.rewardPoints || 0,
          state: user.state // Ensure state is passed samesite
        }
      };
    }).filter(f => f !== null);

    res.json(eligibleFounders);
  } catch (error) {
    console.error('Error fetching eligible founders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ... existing routes ...

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
      status: 'pending',
      initiator: 'founder' // ✅ Add this for consistency
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
// backend/routes/provider.js

// backend/routes/provider.js

// backend/routes/provider.js

// @access  Private
router.get('/my-requests', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // ✅ FIX: Remove 'initiator' filter. 
    // We want ALL requests where 'providerId' is ME (both Sent and Incoming).
    const requests = await IntroRequest.find({ 
      providerId: req.user.id
    })
      .populate('founderId', 'name email profilePicture')
      .populate('startupId', 'name industry')
      .sort({ createdAt: -1 });

    const requestStats = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      accepted: requests.filter(r => r.status === 'accepted').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };

    res.json({ requests, stats: requestStats });
  } catch (error) {
    console.error('Error in /my-requests:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
});
// ==========================================
// 7. Update request status
// ==========================================
// backend/routes/provider.js

// @route   PUT /api/provider/requests/:id
// @desc    Update request status (Accept/Reject)
router.put('/requests/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await IntroRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Security: Only the provider involved can update this
    if (request.providerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    res.json({ success: true, message: `Request ${status}` });
  } catch (err) {
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

// ==========================================
// Provider Sends Request to Founder (BULLETPROOF)
// ==========================================
router.post('/send-request', protect, async (req, res) => {
  try {
    const { startupId, message, servicesOffered } = req.body;

    if (!startupId || !message) {
      return res.status(400).json({ message: 'Startup ID and Message are required' });
    }

    const provider = await Provider.findOne({ userId: req.user.id });
    if (!provider) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    const startup = await Startup.findById(startupId).populate('founderId', 'name email');
    if (!startup || !startup.founderId) {
      return res.status(404).json({ message: 'Startup or Founder not found' });
    }
    
    const founder = startup.founderId;

    const existingRequest = await IntroRequest.findOne({
      providerId: req.user.id,
      founderId: founder._id,
      startupId: startup._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending request with this founder' });
    }

    // ✅ 1. Create Request (MAIN PRIORITY - Don't let anything stop this)
    const newRequest = await IntroRequest.create({
      providerId: req.user.id,
      founderId: founder._id,
      startupId: startup._id,
      status: 'pending',
      message: message,
      servicesOffered: servicesOffered,
      initiator: 'provider'
    });

    // ✅ 2. Return Success IMMEDIATELY
    // We do this before emails/notifications so the user gets instant feedback
    res.status(201).json({
      success: true,
      message: 'Request sent successfully!',
      request: newRequest
    });

    // ==========================================
    // EVERYTHING BELOW RUNS IN THE BACKGROUND
    // If it fails, the user already got the success message
    // ==========================================

    // 3. Notification (Fire and forget)
    (async () => {
      try {
        if (typeof Notification !== 'undefined' && Notification.create) {
          const notification = await Notification.create({
            userId: founder._id,
            title: 'New Connection Request',
            message: `${provider.name || 'A provider'} wants to connect with you!`,
            type: 'INTRO_REQUEST',
            read: false
          });
          
          const io = req.app.get('socketio');
          if (io && notification) {
            io.to(founder._id.toString()).emit('newNotification', notification);
          }
        }
      } catch (e) {
        console.error('BG: Notification failed:', e.message);
      }
    })();

    // 4. Email (Fire and forget)
    (async () => {
      try {
        // Dynamically import to prevent crash if file doesn't exist
        const sendEmail = require('../utils/emailService');
        const templates = require('../utils/emailTemplates');
        const getNewRequestEmail = templates.getNewRequestEmail;

        if (founder.email && typeof sendEmail === 'function' && typeof getNewRequestEmail === 'function') {
          const emailTemplate = getNewRequestEmail(provider.name || 'A Provider', 'Service Provider');
          await sendEmail({
            email: founder.email,
            subject: emailTemplate.subject,
            message: emailTemplate.html
          });
          console.log(`✅ Email sent to ${founder.email}`);
        }
      } catch (e) {
        console.error('BG: Email failed:', e.message);
      }
    })();

  } catch (error) {
    console.error('❌ Send Request FATAL Error:', error);
    // Only send 500 if we haven't already sent a response
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error' });
    }
  }
});
// TEMPORARY FIX ROUTE - DELETE AFTER USE
router.get('/fix-broken-link', async (req, res) => {
  try {
    // 1. Find the broken provider
    const brokenProvider = await Provider.findById('698eb280a54df7a451bf38df');
    
    if (!brokenProvider) return res.send('Provider not found');

    // 2. Find the user associated with this provider (by email match if possible, or manual ID)
    // Since we don't know the user email, you must REPLACE 'USER_ID_HERE' with the actual User ID string
    const correctUserId = 'USER_ID_HERE'; // <--- PASTE THE CORRECT USER ID HERE

    if (!correctUserId || correctUserId === 'USER_ID_HERE') {
        return res.send('Please edit the code and paste the correct User ID.');
    }

    brokenProvider.userId = correctUserId;
    await brokenProvider.save();
    
    res.send(`Fixed! Provider linked to User ${correctUserId}`);
  } catch (err) {
    res.send('Error: ' + err.message);
  }
});
module.exports = router;