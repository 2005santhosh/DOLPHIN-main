const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const Connection = require('../models/Connection');

const connectLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// POST /api/connections/request - Send a request
router.post('/request', protect, connectLimiter, async (req, res) => {
    try {
        const { toUserId } = req.body;
        if (!toUserId) return res.status(400).json({ message: 'Invalid user' });
        if (toUserId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot connect to self' });

        // Check if request already exists
        const existingRequest = await Connection.findOne({
            $or: [
                { from: req.user._id, to: toUserId },
                { from: toUserId, to: req.user._id }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Connection already exists or pending' });
        }

        // Create connection request
        await Connection.create({
            from: req.user._id,
            to: toUserId,
            status: 'pending'
        });

        res.json({ message: 'Connection request sent' });
    } catch (error) {
        // Handle duplicate key error from MongoDB index
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Connection already exists' });
        }
        res.status(500).json({ message: 'Error sending request' });
    }
});

// GET /api/connections - Get all requests for the Requests page
router.get('/', protect, async (req, res) => {
    try {
        // Get Incoming (sent TO me)
        const incoming = await Connection.find({ to: req.user._id, status: 'pending' })
            .populate('from', 'name email profileImage role')
            .sort({ createdAt: -1 });

        // Get Sent (sent BY me)
        const sent = await Connection.find({ from: req.user._id })
            .populate('to', 'name email profileImage role')
            .sort({ createdAt: -1 });

        res.json({ incoming, sent });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests' });
    }
});

// PUT /api/connections/:id - Accept or Reject
router.put('/:id', protect, async (req, res) => {
    try {
        const { status } = req.body; // 'accepted' or 'rejected'
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Find request and ensure it was sent TO the current user
        const connection = await Connection.findOneAndUpdate(
            { _id: req.params.id, to: req.user._id, status: 'pending' },
            { status },
            { new: true }
        );

        if (!connection) {
            return res.status(404).json({ message: 'Request not found or already handled' });
        }

        res.json({ message: `Request ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Error updating request' });
    }
});

module.exports = router;