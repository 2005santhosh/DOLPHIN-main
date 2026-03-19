const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');

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
  } catch (err) {
    console.error('Chat Send Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/chat/conversations
// @desc    Get all conversations for logged-in user
router.get('/conversations', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [ { senderId: req.user.id }, { receiverId: req.user.id } ]
    })
    .populate('senderId', 'name profilePicture')
    .populate('receiverId', 'name profilePicture')
    .sort({ createdAt: -1 });

    const conversationsMap = {};

    messages.forEach(msg => {
      // ==========================================
      // FIX: Check if sender or receiver is NULL (Deleted User)
      // If a user was deleted, populate returns null. We must skip this.
      // ==========================================
      if (!msg.senderId || !msg.receiverId) {
        console.log(`Skipping message ${msg._id}: User data missing (deleted).`);
        return; // Skip this message
      }

      const partner = msg.senderId._id.toString() === req.user.id.toString() 
        ? msg.receiverId 
        : msg.senderId;

      // Safety check
      if (!partner) return;

      if (!conversationsMap[partner._id]) {
        conversationsMap[partner._id] = {
          _id: partner._id,
          name: partner.name,
          profilePicture: partner.profilePicture || "",
          lastMessage: msg.content,
          updatedAt: msg.createdAt
        };
      }
    });

    res.json(Object.values(conversationsMap));
  } catch (err) {
    console.error(err);
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