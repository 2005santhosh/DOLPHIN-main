const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');

// Get validated startups (score >= 70%)
router.get('/validated-startups', protect, authorize('investor'), async (req, res) => {
  try {
    const startups = await Startup.find({
      validationScore: { $gte: 70 }
    })
    .populate('founderId', 'name email')
    .sort({ validationScore: -1 });

    res.json(startups);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all startups
router.get('/startups', protect, authorize('investor'), async (req, res) => {
  try {
    const startups = await Startup.find()
      .populate('founderId', 'name email')
      .sort({ validationScore: -1 });

    res.json(startups);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get providers
router.get('/providers', protect, authorize('investor'), async (req, res) => {
  try {
    const providers = await Provider.find({ verified: true })
      .populate('userId', 'name email')
      .sort({ name: 1 });

    res.json(providers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;