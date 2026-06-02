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

  try {
    const newMessage = await Message.create({
      senderId: req.user.id,
      receiverId,
      content
    });

    const populatedMsg = await newMessage.populate('senderId', 'name profilePicture');

    const io = req.app.get('socketio');
    if (io) {
      // Emit to RECEIVER
      io.to(`user:${receiverId}`).emit('receiveMessage', populatedMsg);
      // Emit to SENDER (for other tabs)
      io.to(`user:${req.user.id}`).emit('receiveMessage', populatedMsg);
    }

    res.json(populatedMsg);
    // Fetch sender and recipient details
    const sender = await User.findById(req.user.id); // or req.user._id depending on your auth middleware
    const recipient = await User.findById(receiverId);

    if (recipient && recipient.email) {
      try {
        const msgTemplate = getNewMessageEmail(sender.name, content);
        await sendEmail({
            email: recipient.email,
            subject: msgTemplate.subject,
            message: msgTemplate.html
        });
      } catch (err) {
        console.error("Chat email notification failed:", err);
      }
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error('Chat Send Error:', err);
    res.status(500).json({ message: 'Server Error' });
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
    const messages = await Message.find({
      $or: [
        { senderId: req.user.id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user.id }
      ]
    })
    .populate('senderId', 'name profilePicture')
    .sort({ createdAt: 1 });

    // Mark as read
    await Message.updateMany(
      { receiverId: req.user.id, senderId: req.params.userId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;