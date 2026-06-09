// backend/models/Message.js
const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji:    { type: String, required: true },  // e.g. "❤️", "👍", "😂"
}, { _id: false, timestamps: false });

const MessageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, default: '' },
  read:       { type: Boolean, default: false },

  // Reactions: array of { userId, emoji } — one emoji per user
  reactions:  { type: [ReactionSchema], default: [] },

  // Soft delete — "deleted for everyone" within 30 min of sending
  deletedForEveryone: { type: Boolean, default: false },
  deletedAt:          { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
