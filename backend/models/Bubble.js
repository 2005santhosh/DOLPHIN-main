/**
 * Bubble.js — Group chat room (like WhatsApp group / Discord channel).
 * Admin can invite/remove members, change name, change picture.
 */
const mongoose = require('mongoose');

const BubbleMessageSchema = new mongoose.Schema({
  senderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:   { type: String, default: '' },
  // Media attachment (image, video, audio, file)
  mediaUrl:  { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'audio', 'file', ''], default: '' },
  deletedForEveryone: { type: Boolean, default: false },
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji:  { type: String },
  }],
}, { timestamps: true, _id: true });

const BubbleSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 300 },
  picture:     { type: String, default: '' }, // Cloudinary URL

  // Creator is also always an admin
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Members with roles
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:   { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  }],

  // Messages stored inline (for small groups; works well up to ~5000 msgs)
  messages: [BubbleMessageSchema],

  // Last activity — for sorting conversations
  lastMessageAt: { type: Date, default: Date.now },
  lastMessage:   { type: String, default: '' },

  // Permissions — WhatsApp-style group settings
  permissions: {
    allowMembersToInvite: { type: Boolean, default: false }, // only admins can invite by default
    allowMembersToEditInfo: { type: Boolean, default: false }, // only admins can edit name/desc by default
  },
}, { timestamps: true });

// Index for fetching bubbles a user belongs to
BubbleSchema.index({ 'members.userId': 1, lastMessageAt: -1 });

module.exports = mongoose.model('Bubble', BubbleSchema);
