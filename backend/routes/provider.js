// routes/provider.js
// Handles provider-related endpoints with role-based access control
// Uses real Provider model instead of mock data

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Provider = require('../models/Provider');
const Startup = require('../models/Startup');
const IntroRequest = require('../models/IntroRequest');

/**
 * GET /api/providers
 * Returns list of verified providers
 * - Founders get contextual (stage-based) recommendations
 * - Investors & Providers see full verified list
 */
router.get('/', protect, async (req, res) => {
  if (!['founder', 'investor', 'provider'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    // Base query: only show verified providers
    let query = { verified: true };

    let providers = await Provider.find(query)
      .select('name category description stageCategories verified')
      .lean(); // faster, plain JS objects

    // Contextual matching ONLY for founders
    if (req.user.role === 'founder') {
      const startup = await Startup.findOne({ founderId: req.user.id });

      if (startup && startup.milestones?.length > 0) {
        const nextMilestone = startup.milestones.find(m => !m.isCompleted);
        const currentStage = nextMilestone ? nextMilestone.order : 7;

        providers = providers.filter(p =>
          p.stageCategories.some(stage => stage === currentStage)
        );
      }
    }

    // Optional: sort by name or relevance
    providers.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json(providers);
  } catch (err) {
    console.error('Error fetching providers:', err);
    res.status(500).json({ message: 'Failed to fetch providers' });
  }
});

/**
 * POST /api/providers/request-intro
 * Allows founders to request introduction to a provider
 */
router.post('/request-intro', protect, async (req, res) => {
  if (req.user.role !== 'founder') {
    return res.status(403).json({ message: 'Only founders can request introductions' });
  }

  const { providerId } = req.body;

  if (!providerId) {
    return res.status(400).json({ message: 'providerId is required' });
  }

  try {
    // Verify the provider exists and is verified
    const provider = await Provider.findById(providerId);
    if (!provider || !provider.verified) {
      return res.status(404).json({ message: 'Provider not found or not verified' });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ message: 'No startup found for this founder' });
    }

    // Create intro request
    const request = await IntroRequest.create({
      providerId: provider.userId,   // store the User _id of provider
      founderId: req.user.id,
      startupId: startup._id,
      status: 'pending'
    });

    console.log(`[INTRO REQUEST CREATED] Founder ${req.user.id} → Provider ${providerId}`);

    // TODO: send email notification (nodemailer / sendgrid)

    res.status(201).json({
      message: 'Introduction request sent successfully',
      requestId: request._id,
      status: 'pending'
    });
  } catch (err) {
    console.error('Error processing intro request:', err);
    res.status(500).json({ message: 'Server error while sending request' });
  }
});

/**
 * GET /api/providers/my-requests
 * Returns all intro requests sent to this provider
 * (Used in provider-dashboard)
 */
router.get('/my-requests', protect, async (req, res) => {
  if (req.user.role !== 'provider') {
    return res.status(403).json({ message: 'Only providers can view their requests' });
  }

  try {
    const requests = await IntroRequest.find({ providerId: req.user.id })
      .populate('startupId', 'name thesis validationScore')
      .populate('founderId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(requests);
  } catch (err) {
    console.error('Error fetching provider requests:', err);
    res.status(500).json({ message: 'Failed to load requests' });
  }
});

/**
 * PUT /api/providers/requests/:id
 * Updates the status of an intro request
 */
router.put('/requests/:id', protect, async (req, res) => {
  if (req.user.role !== 'provider') {
    return res.status(403).json({ message: 'Only providers can update requests' });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const request = await IntroRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Ensure the request belongs to this provider
    if (request.providerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    request.status = status;
    await request.save();

    // TODO: send email notification to founder

    res.status(200).json({
      message: 'Request updated successfully',
      status: request.status
    });
  } catch (err) {
    console.error('Error updating request:', err);
    res.status(500).json({ message: 'Server error while updating request' });
  }
});

module.exports = router;