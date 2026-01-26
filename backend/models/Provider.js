const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  verified: { type: Boolean, default: false },
  stageCategories: [{ type: Number }],
  bio: { type: String },
  experienceLevel: { type: String, enum: ['junior', 'mid', 'senior', 'executive'], default: 'mid' },
  specialties: [{ type: String }],
  availability: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  contactMethod: { type: String, enum: ['email', 'video', 'in-person', 'mixed'], default: 'email' },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  engagementCount: { type: Number, default: 0 },
  responseRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Provider', providerSchema);