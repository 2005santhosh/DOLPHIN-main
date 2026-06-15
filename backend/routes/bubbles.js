/**
 * routes/bubbles.js — Group chat (Bubble) API.
 * Bubbles are like WhatsApp groups — admin manages members, anyone can message.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Bubble = require('../models/Bubble');
const User   = require('../models/User');
const { upload, cloudinary } = require('../config/cloudinary');
const sendEmail = require('../utils/sendEmail');

// ── Helper: check if user is admin of a bubble ────────────────────────────────
function isAdmin(bubble, userId) {
  const uid = userId?.toString();
  return bubble.members.some(m => {
    const mid = m.userId?._id?.toString() || m.userId?.toString();
    return mid === uid && m.role === 'admin';
  });
}
function isMember(bubble, userId) {
  const uid = userId?.toString();
  return bubble.members.some(m => {
    const mid = m.userId?._id?.toString() || m.userId?.toString();
    return mid === uid;
  });
}

// ── POST /api/bubbles — Create a new bubble ───────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Bubble name is required' });

    const bubble = await Bubble.create({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.user._id,
      members: [{ userId: req.user._id, role: 'admin', joinedAt: new Date() }],
    });

    const populated = await Bubble.findById(bubble._id)
      .populate('members.userId', 'name profilePicture role');
    res.status(201).json(populated);
  } catch (err) {
    console.error('[Bubbles] Create error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/bubbles — Get all bubbles the current user is a member of ─────────
router.get('/', protect, async (req, res) => {
  try {
    const bubbles = await Bubble.find({ 'members.userId': req.user._id })
      .select('name description picture members lastMessage lastMessageAt createdAt')
      .populate('members.userId', 'name profilePicture role')
      .sort({ lastMessageAt: -1 })
      .lean();

    // Add unread count and current user's role
    const result = bubbles.map(b => ({
      ...b,
      memberCount: b.members.length,
      myRole: b.members.find(m => m.userId?._id?.toString() === req.user._id.toString())?.role || 'member',
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/bubbles/:id — Get bubble details + messages ──────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const bubble = await Bubble.findById(req.params.id)
      .populate('members.userId', 'name profilePicture role isVerified verifiedSource verifiedUntil')
      .populate('messages.senderId', 'name profilePicture')
      .lean();

    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isMember(bubble, req.user._id)) return res.status(403).json({ message: 'Not a member' });

    // Return last 100 messages
    const messages = (bubble.messages || []).slice(-100);
    res.json({ ...bubble, messages });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/bubbles/:id/messages — Send a message ──────────────────────────
router.post('/:id/messages', protect, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    if (!content?.trim() && !mediaUrl) return res.status(400).json({ message: 'Message is empty' });

    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isMember(bubble, req.user._id)) return res.status(403).json({ message: 'Not a member' });

    const msg = {
      senderId:  req.user._id,
      content:   (content || '').trim().slice(0, 2000),
      mediaUrl:  mediaUrl || '',
      mediaType: mediaType || '',
    };

    bubble.messages.push(msg);
    bubble.lastMessage = mediaUrl ? `📎 ${mediaType || 'Media'}` : (content || '').trim().slice(0, 80);
    bubble.lastMessageAt = new Date();
    await bubble.save();

    const savedMsg = bubble.messages[bubble.messages.length - 1];

    // Emit via socket to all members
    const io = req.app.get('socketio');
    if (io) {
      const payload = {
        bubbleId:  bubble._id,
        message: {
          ...savedMsg.toObject(),
          senderName:    req.user.name,
          senderPicture: req.user.profilePicture || '',
        },
      };
      bubble.members.forEach(m => {
        io.to(`user:${m.userId.toString()}`).emit('bubbleMessage', payload);
      });
    }

    res.status(201).json({
      ...savedMsg.toObject(),
      senderName:    req.user.name,
      senderPicture: req.user.profilePicture || '',
    });
  } catch (err) {
    console.error('[Bubbles] Message error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/bubbles/:id/upload-signature — Cloudinary signature for media ────
router.get('/:id/upload-signature', protect, async (req, res) => {
  try {
    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isMember(bubble, req.user._id)) return res.status(403).json({ message: 'Not a member' });

    const crypto = require('crypto');
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'dolphin-bubbles';
    const str = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha256').update(str).digest('hex');
    res.json({ signature, timestamp, folder, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/bubbles/:id/invite — Admin invites a user ───────────────────────
router.post('/:id/invite', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isAdmin(bubble, req.user._id)) return res.status(403).json({ message: 'Only admins can invite' });

    if (isMember(bubble, userId)) return res.status(400).json({ message: 'User is already a member' });

    // Verify user exists
    const user = await User.findById(userId).select('name').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    bubble.members.push({ userId, role: 'member', joinedAt: new Date() });
    await bubble.save();

    // Notify invited user via socket
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${userId}`).emit('bubbleInvite', { bubbleId: bubble._id, bubbleName: bubble.name });
    }

    res.json({ message: `${user.name} added to ${bubble.name}` });

    // Fire-and-forget invite email
    setImmediate(async () => {
      try {
        const invitee = await User.findById(userId).select('email name emailNotifications').lean();
        if (invitee?.email && invitee.emailNotifications !== false) {
          await sendEmail({
            email: invitee.email,
            subject: `🫧 You've been invited to "${bubble.name}" on Dolphin`,
            message: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
              <h2 style="color:#1E3A8A;">🐬 Dolphin</h2>
              <p>Hi <strong>${invitee.name}</strong>,</p>
              <p><strong>${req.user.name}</strong> has invited you to join the Bubble <strong>"${bubble.name}"</strong> on Dolphin.</p>
              <p>Bubbles are group conversations where you can collaborate with multiple people at once.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="https://www.dolphinorg.in" style="display:inline-block;padding:12px 28px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Open Dolphin</a>
              </div>
              <p style="color:#9CA3AF;font-size:0.8rem;">Go to the Bubbles section in your dashboard to start chatting.</p>
            </div>`,
          });
        }
      } catch (e) { console.error('[Bubbles] Invite email error:', e.message); }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/bubbles/:id/members/:userId — Admin removes a member ──────────
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });

    const isSelf = req.params.userId === req.user._id.toString();
    if (!isAdmin(bubble, req.user._id) && !isSelf) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    bubble.members = bubble.members.filter(m => m.userId.toString() !== req.params.userId);
    await bubble.save();

    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('bubbleRemoved', { bubbleId: bubble._id });
    }

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/bubbles/:id — Admin updates name/description/picture ─────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isAdmin(bubble, req.user._id)) return res.status(403).json({ message: 'Only admins can edit' });

    const { name, description } = req.body;
    if (name?.trim()) bubble.name = name.trim().slice(0, 100);
    if (typeof description === 'string') bubble.description = description.trim().slice(0, 300);

    await bubble.save();
    res.json({ name: bubble.name, description: bubble.description });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/bubbles/:id/picture — Admin uploads bubble picture ──────────────
router.post('/:id/picture', protect, (req, res, next) => {
  upload.single('picture')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    try {
      const bubble = await Bubble.findById(req.params.id);
      if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
      if (!isAdmin(bubble, req.user._id)) return res.status(403).json({ message: 'Only admins can change picture' });
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      bubble.picture = req.file.path;
      await bubble.save();
      res.json({ picture: bubble.picture });
    } catch (e) {
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// ── PUT /api/bubbles/:id/members/:userId/role — Promote/demote member ─────────
router.put('/:id/members/:userId/role', protect, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isAdmin(bubble, req.user._id)) return res.status(403).json({ message: 'Only admins can change roles' });

    const member = bubble.members.find(m => m.userId.toString() === req.params.userId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    member.role = role;
    await bubble.save();
    res.json({ message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/bubbles/:id — Admin deletes the bubble ────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const bubble = await Bubble.findById(req.params.id);
    if (!bubble) return res.status(404).json({ message: 'Bubble not found' });
    if (!isAdmin(bubble, req.user._id)) return res.status(403).json({ message: 'Only admins can delete' });

    await Bubble.findByIdAndDelete(req.params.id);

    const io = req.app.get('socketio');
    if (io) {
      bubble.members.forEach(m => {
        io.to(`user:${m.userId.toString()}`).emit('bubbleDeleted', { bubbleId: bubble._id });
      });
    }

    res.json({ message: 'Bubble deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
