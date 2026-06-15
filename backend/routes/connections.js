const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const Connection = require('../models/Connection');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { getNewRequestEmail } = require('../utils/emailTemplates');
const { recordActivity } = require('../services/gamificationService');

const connectLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// POST /api/connections/request - Send a connection request
router.post('/request', protect, connectLimiter, async (req, res) => {
    try {
        const { toUserId } = req.body;
        if (!toUserId) return res.status(400).json({ message: 'Invalid user' });

        // Validate ObjectId format to prevent CastError 500s
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(toUserId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

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
            return res.status(400).json({
                message: existing.status === 'accepted' ? 'Already connected' : 'Connection request already sent',
                status: existing.status,
            });
        }

        const conn = await Connection.create({
            from: req.user._id,
            to: toUserId,
            status: 'pending'
        });

        res.json({ message: 'Connection request sent', status: 'pending', connectionId: conn._id });

        // Fire-and-forget email to recipient
        setImmediate(async () => {
            try {
                const recipient = await User.findById(toUserId).select('email name emailNotifications').lean();
                if (recipient?.email && recipient.emailNotifications !== false) {
                    const tpl = getNewRequestEmail(req.user.name, 'Connection');
                    await sendEmail({ email: recipient.email, subject: tpl.subject, message: tpl.html });
                }
            } catch (e) {
                console.error('[Connections] Email notification failed:', e.message);
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key — connection already exists, return gracefully
            const existing = await Connection.findOne({
                $or: [
                    { from: req.user._id, to: req.body.toUserId },
                    { from: req.body.toUserId, to: req.user._id }
                ]
            }).lean();
            return res.status(400).json({
                message: 'Connection already exists',
                status: existing?.status || 'pending',
            });
        }
        console.error('Connection request error:', error);
        res.status(500).json({ message: 'Error sending request' });
    }
});

// GET /api/connections - Get all connection requests for the current user
router.get('/', protect, async (req, res) => {
    try {
        const myId = req.user._id;

        // Incoming: sent TO me (ALL statuses — not just pending)
        const incoming = await Connection.find({ to: myId })
            .populate('from', 'name email profilePicture role isVerified verifiedSource verifiedUntil')
            .sort({ createdAt: -1 })
            .lean();

        // Sent: sent BY me (all statuses)
        const sent = await Connection.find({ from: myId })
            .populate('to', 'name email profilePicture role isVerified verifiedSource verifiedUntil')
            .sort({ createdAt: -1 })
            .lean();

        const normaliseIncoming = incoming.map(c => ({
            _id: c._id,
            status: c.status,
            createdAt: c.createdAt,
            initiator: 'other',
            otherUser: c.from,
            message: c.message || '',
        }));

        const normaliseSent = sent.map(c => ({
            _id: c._id,
            status: c.status,
            createdAt: c.createdAt,
            initiator: 'me',
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

// POST /api/connections/status-bulk - Check connection status for multiple users at once
router.post('/status-bulk', protect, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.json({});
        }
        const myId = req.user._id;
        const connections = await Connection.find({
            $or: [
                { from: myId, to: { $in: userIds } },
                { from: { $in: userIds }, to: myId },
            ]
        }).select('from to status').lean();

        const statusMap = {};
        connections.forEach(conn => {
            const otherId = conn.from.toString() === myId.toString()
                ? conn.to.toString()
                : conn.from.toString();
            // Keep the highest-priority status if multiple exist
            const priority = { accepted: 3, pending: 2, rejected: 1 };
            if (!statusMap[otherId] || (priority[conn.status] || 0) > (priority[statusMap[otherId]] || 0)) {
                statusMap[otherId] = conn.status;
            }
        });
        res.json(statusMap);
    } catch (error) {
        console.error('Bulk status error:', error);
        res.status(500).json({ message: 'Error checking statuses' });
    }
});

// GET /api/connections/all-accepted - Return every accepted connected user (for bubble invite modal)
// Queries BOTH Connection model (peer connections) AND IntroRequest model (cross-role connections).
router.get('/all-accepted', protect, async (req, res) => {
    try {
        const myId = req.user._id;
        const IntroRequest = require('../models/IntroRequest');

        // ── 1. Connection model (peer-to-peer, all role combos) ──────────────
        const peerConns = await Connection.find({
            $or: [
                { from: myId, status: 'accepted' },
                { to:   myId, status: 'accepted' },
            ]
        })
        .populate('from', 'name profilePicture role isVerified verifiedSource verifiedUntil')
        .populate('to',   'name profilePicture role isVerified verifiedSource verifiedUntil')
        .lean();

        const fromPeer = peerConns.map(c =>
            c.from._id.toString() === myId.toString() ? c.to : c.from
        );

        // ── 2. IntroRequest model (founder↔provider, founder↔investor) ──────
        const introConns = await IntroRequest.find({
            $or: [
                { founderId:  myId, status: 'accepted' },
                { providerId: myId, status: 'accepted' },
            ]
        })
        .populate('founderId',  'name profilePicture role isVerified verifiedSource verifiedUntil')
        .populate('providerId', 'name profilePicture role isVerified verifiedSource verifiedUntil')
        .lean();

        const fromIntro = introConns.map(r => {
            // Return whichever side is NOT the current user
            const isFounder = r.founderId?._id?.toString() === myId.toString();
            return isFounder ? r.providerId : r.founderId;
        }).filter(Boolean);

        // ── 3. Merge and deduplicate ─────────────────────────────────────────
        const seen = new Set();
        const unique = [...fromPeer, ...fromIntro].filter(u => {
            const id = u?._id?.toString();
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        res.json({ users: unique });
    } catch (error) {
        console.error('all-accepted error:', error);
        res.status(500).json({ message: 'Error fetching connections' });
    }
});

// GET /api/connections/pending-count - Fast pending count for badge (no full load needed)
router.get('/pending-count', protect, async (req, res) => {
    try {
        // Only count requests sent TO me that are still pending
        const count = await Connection.countDocuments({ to: req.user._id, status: 'pending' });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching count' });
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
