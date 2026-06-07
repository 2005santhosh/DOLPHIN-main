const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { getNewMessageEmail } = require('../utils/emailTemplates');
// @route   POST /api/chat/send
router.post('/send', protect, async (req, res) => {
  const { receiverId, content } = req.body;

  if (!receiverId || !content) {
    return res.status(400).json({ message: 'Missing data' });
  }

  // Sanitise: trim and cap content length
  const sanitisedContent = (content || '').toString().trim().slice(0, 2000);
  if (!sanitisedContent) {
    return res.status(400).json({ message: 'Message content is empty' });
  }

  try {
    const newMessage = await Message.create({
      senderId: req.user.id,
      receiverId,
      content: sanitisedContent,
    });

    const populatedMsg = await newMessage.populate('senderId', 'name profilePicture');

    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${receiverId}`).emit('receiveMessage', populatedMsg);
      io.to(`user:${req.user.id}`).emit('receiveMessage', populatedMsg);
    }

    // Respond immediately — don't block on email
    res.json(populatedMsg);

    // Fire-and-forget email notification
    setImmediate(async () => {
      try {
        const [sender, recipient] = await Promise.all([
          User.findById(req.user.id).select('name').lean(),
          User.findById(receiverId).select('email name').lean(),
        ]);
        if (recipient?.email && sender?.name) {
          const msgTemplate = getNewMessageEmail(sender.name, sanitisedContent);
          await sendEmail({
            email: recipient.email,
            subject: msgTemplate.subject,
            message: msgTemplate.html,
          });
        }
      } catch (err) {
        console.error('[Chat] Email notification failed:', err.message);
      }
    });

  } catch (err) {
    console.error('Chat Send Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server Error' });
    }
  }
});

// @route   GET /api/chat/user/:userId
// @desc    Get a user's public profile (name, profilePicture, role) for chat header
// Must be defined BEFORE /:userId to avoid conflict
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const u = await User.findById(req.params.userId)
      .select('name profilePicture role isVerified verifiedSource verifiedUntil')
      .lean();
    if (!u) return res.status(404).json({ message: 'User not found' });
    res.json({ _id: u._id, name: u.name, profilePicture: u.profilePicture || '', role: u.role, isVerified: u.isVerified || false, verifiedSource: u.verifiedSource || null, verifiedUntil: u.verifiedUntil || null });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/chat/conversations
// @desc    Get all conversations — includes connected users even with no messages yet
router.get('/conversations', protect, async (req, res) => {
  try {
    const Connection = require('../models/Connection');

    // 1. Build conversation map from existing messages
    const messages = await Message.find({
      $or: [ { senderId: req.user.id }, { receiverId: req.user.id } ]
    })
    .populate('senderId', 'name profilePicture role isVerified verifiedSource verifiedUntil')
    .populate('receiverId', 'name profilePicture role isVerified verifiedSource verifiedUntil')
    .sort({ createdAt: -1 });

    const conversationsMap = {};

    messages.forEach(msg => {
      if (!msg.senderId || !msg.receiverId) return;

      const partner = msg.senderId._id.toString() === req.user.id.toString()
        ? msg.receiverId
        : msg.senderId;

      if (!partner) return;

      if (!conversationsMap[partner._id.toString()]) {
        conversationsMap[partner._id.toString()] = {
          _id: partner._id,
          name: partner.name,
          profilePicture: partner.profilePicture || '',
          role: partner.role || '',
          isVerified: partner.isVerified || false,
          verifiedSource: partner.verifiedSource || null,
          verifiedUntil: partner.verifiedUntil || null,
          lastMessage: msg.content,
          updatedAt: msg.createdAt,
        };
      }
    });

    // 2. Add connected users who have no messages yet
    const connections = await Connection.find({
      status: 'accepted',
      $or: [
        { from: req.user.id },
        { to: req.user.id },
      ],
    })
    .populate('from', 'name profilePicture role isVerified verifiedSource verifiedUntil')
    .populate('to', 'name profilePicture role isVerified verifiedSource verifiedUntil')
    .lean();

    connections.forEach(conn => {
      const partner = conn.from?._id?.toString() === req.user.id.toString()
        ? conn.to
        : conn.from;

      if (!partner || !partner._id) return;

      const partnerId = partner._id.toString();
      if (!conversationsMap[partnerId]) {
        conversationsMap[partnerId] = {
          _id: partner._id,
          name: partner.name || 'User',
          profilePicture: partner.profilePicture || '',
          role: partner.role || '',
          isVerified: partner.isVerified || false,
          verifiedSource: partner.verifiedSource || null,
          verifiedUntil: partner.verifiedUntil || null,
          lastMessage: '',
          updatedAt: conn.updatedAt || conn.createdAt,
        };
      }
    });

    // 3. Sort: conversations with messages first (by updatedAt), then new connections
    const result = Object.values(conversationsMap).sort((a, b) => {
      // Conversations with messages come first
      const aHasMsg = !!a.lastMessage;
      const bHasMsg = !!b.lastMessage;
      if (aHasMsg !== bHasMsg) return bHasMsg ? 1 : -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    res.json(result);
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/chat/:userId samesite
// ✅ This comes LAST so it doesn't override '/conversations'
router.get('/:userId', protect, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const before = req.query.before; // cursor-based pagination: before=<timestamp>

    const baseQuery = {
      $or: [
        { senderId: req.user.id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.id }
      ]
    };

    if (before) {
      baseQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(baseQuery)
      .populate('senderId', 'name profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Mark as read (fire-and-forget — don't block response)
    Message.updateMany(
      { receiverId: req.user.id, senderId: req.params.userId, read: false },
      { $set: { read: true } }
    ).catch(() => {});

    // Return in chronological order
    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;