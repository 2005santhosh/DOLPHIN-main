// backend/routes/resources.js
const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');

// @route   GET /api/resources
// @desc    Get all resources
// @access  Public (or Protected if you want)
router.get('/', async (req, res) => {
  try {
    let resources = await Resource.find().sort({ createdAt: -1 });

    // If no resources exist, seed them with REAL links for immediate use
    if (resources.length === 0) {
      const seedResources = [
        {
          title: 'Lean Canvas Template',
          description: 'One-page business plan template to deconstruct your idea into key assumptions.',
          type: 'template',
          url: 'https://www.leancanvas.com/',
          icon: 'file-text'
        },
        {
          title: 'Startup School by Y Combinator',
          description: 'Free online course on how to start a startup. Highly recommended for idea validation.',
          type: 'guide',
          url: 'https://www.startupschool.org/',
          icon: 'book'
        },
        {
          title: 'Mom Test Book Summary',
          description: 'How to talk to customers and learn if your business is a good idea when everyone is lying to you.',
          type: 'guide',
          url: 'https://www.momtestbook.com/',
          icon: 'book'
        },
        {
          title: 'Competitor Analysis Spreadsheet',
          description: 'Template to track competitors, pricing, features, and market positioning.',
          type: 'template',
          url: 'https://docs.google.com/spreadsheets/d/example',
          icon: 'file-text'
        },
        {
          title: 'Validation Checklist',
          description: 'A checklist to ensure you have validated problem, solution, and market before building.',
          type: 'checklist',
          url: '#validation-checklist', // Internal link or external
          icon: 'check-square'
        }
      ];

      await Resource.insertMany(seedResources);
      resources = await Resource.find().sort({ createdAt: -1 });
    }

    res.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;