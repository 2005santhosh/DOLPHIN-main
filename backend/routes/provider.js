const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');

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
      .sort({ name: 1 });

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

    // Verify provider exists and is verified
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

    // Check for duplicate requests
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

    // Create intro request
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
      .populate('startupId', 'name thesis validationScore')
      .populate('founderId', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
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

    // Ensure the request belongs to this provider
    if (request.providerId.toString() !== req.user.id) {
      return res.status(403).json({ 
        message: 'Access denied',
        nextSteps: 'You can only manage your own requests'
      });
    }

    request.status = status;
    await request.save();

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

module.exports = router;