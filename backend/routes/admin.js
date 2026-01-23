// routes/admin.js (New: Admin panel endpoints, assume investor role for admin)
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Startup = require('../models/Startup');
const Provider = require('../models/Provider');
const IntroRequest = require('../models/IntroRequest');

/**
 * GET /api/admin/startups
 * Fetches all startups for admin review
 * @returns {Array} List of startups
 */
router.get('/startups', protect, async (req, res) => {
  if (req.user.role !== 'investor') return res.status(403).json({ message: 'Admin access only' });
  try {
    const startups = await Startup.find().populate('founderId', 'name email');
    res.json(startups);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/admin/providers
 * Fetches all providers for admin
 * @returns {Array} List of providers
 */
router.get('/providers', protect, async (req, res) => {
  if (req.user.role !== 'investor') return res.status(403).json({ message: 'Admin access only' });
  try {
    const providers = await Provider.find().populate('userId', 'name email');
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add more admin endpoints as needed (e.g., approve provider, view requests)

module.exports = router;