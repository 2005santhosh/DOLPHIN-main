const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const Connection = require('../models/Connection');
const { recordActivity } = require('../services/gamificationService');

const connectLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// POST /api/connections/request - Send a connection request
router.post('/request', protect, connectLimiter, async (req, res) => {
    try {
        const { toUserId } = req.body;
        if (!toUserId) return res.status(400).json({ message: 'Invalid user' });
        if (toUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot connect to yourself' });
        }

        // Check if request already exists in either direction
        const existing = await Connection.findOne({
            $or: [
                { from: req.user._id, to: toUserId },
                { from: toUserId, to: req.user._id }
            ]
        });

        if (existing) {
            // Return the existing status so the frontend can update correctly
            return res.status(400).json({
                message: 'Connection already exists or pending',
                status: existing.status,
            });
        }

        const conn = await Connection.create({
            from: req.user._id,
            to: toUserId,
            status: 'pending'
        });

        res.json({ message: 'Connection request sent', status: 'pending', connectionId: conn._id });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Connection already exists', status: 'pending' });
        }
        console.error('Connection request error:', error);
        res.status(500).json({ message: 'Error sending request' });
    }
});

// GET /api/connections - Get all connection requests for the current user
router.get('/', protect, async (req, res) => {
    try {
        // Incoming: sent TO me
        const incoming = await Connection.find({ to: req.user._id, status: 'pending' })
            .populate('from', 'name email profilePicture role')
            .sort({ createdAt: -1 })
            .lean();

        // Sent: sent BY me (all statuses)
        const sent = await Connection.find({ from: req.user._id })
            .populate('to', 'name email profilePicture role')
            .sort({ createdAt: -1 })
            .lean();

        // Normalise field names so the frontend can use them uniformly
        const normaliseIncoming = incoming.map(c => ({
            _id: c._id,
            status: c.status,
            createdAt: c.createdAt,
            initiator: 'other',
            // The "other" person is the sender (from)
            otherUser: c.from,
            message: c.message || '',
        }));

        const normaliseSent = sent.map(c => ({
            _id: c._id,
            status: c.status,
            createdAt: c.createdAt,
            initiator: 'me',
            // The "other" person is the recipient (to)
            otherUser: c.to,
            message: c.message || '',
        }));

        res.json({ incoming: normaliseIncoming, sent: normaliseSent });
    } catch (error) {
        console.error('Get connections error:', error);
        res.status(500).json({ message: 'Error fetching connections' });
    }
});

// GET /api/connections/status/:userId - Check connection status with a specific user
router.get('/status/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const conn = await Connection.findOne({
            $or: [
                { from: req.user._id, to: userId },
                { from: userId, to: req.user._id }
            ]
        }).lean();

        res.json({ status: conn ? conn.status : null, connectionId: conn?._id || null });
    } catch (error) {
        res.status(500).json({ message: 'Error checking status' });
    }
});

// PUT /api/connections/:id - Accept or Reject a connection request
router.put('/:id', protect, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Only the recipient (to) can accept/reject
        const connection = await Connection.findOneAndUpdate(
            { _id: req.params.id, to: req.user._id, status: 'pending' },
            { status },
            { new: true }
        );

        if (!connection) {
            return res.status(404).json({ message: 'Request not found or already handled' });
        }

        // Award gamification points when accepted
        if (status === 'accepted') {
            recordActivity(req.user._id, 'connection').catch(e =>
                console.error('Gamification connection error (recipient):', e)
            );
            recordActivity(connection.from.toString(), 'connection').catch(e =>
                console.error('Gamification connection error (sender):', e)
            );
        }

        res.json({ message: `Request ${status}`, status });
    } catch (error) {
        console.error('Update connection error:', error);
        res.status(500).json({ message: 'Error updating request' });
    }
});

module.exports = router;
