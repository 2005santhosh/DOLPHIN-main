const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const connectLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }); // 20 connects/hr

router.post('/request', auth, connectLimiter, async (req, res) => {
    try {
        const { toUserId } = req.body;
        if (!toUserId) return res.status(400).json({ message: 'Invalid user' });
        if (toUserId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot connect to self' });

        // Implement your DB logic here to create a Connection document with status 'pending'
        // e.g., await Connection.findOneAndUpdate({ from: req.user._id, to: toUserId }, ...)

        res.json({ message: 'Connection request sent' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending request' });
    }
});

module.exports = router;