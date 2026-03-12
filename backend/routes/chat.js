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

// routes/chat.js

router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name profilePicture')
      .sort({ updatedAt: -1 });

    // 1. Convert Mongoose documents to plain objects so we can modify them
    const sanitizedConversations = conversations.map(conv => {
      const obj = conv.toObject();
      
      // 2. CRITICAL FIX: Filter out 'null' participants (deleted users)
      // This prevents the frontend from crashing if a user was deleted.
      if (obj.participants) {
        obj.participants = obj.participants.filter(p => p !== null);
      }
      
      return obj;
    });

    res.json(sanitizedConversations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/chat/:userId
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