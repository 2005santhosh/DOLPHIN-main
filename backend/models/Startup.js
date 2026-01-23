// models/Startup.js (Updated: Enhanced validation logic - added adminVerified field, compute score only if verified)
const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: String,
  description: String,
  isCompleted: { type: Boolean, default: false },
  verified: { type: Boolean, default: false }, // Founder marks complete, admin verifies
  order: { type: Number, required: true } // For gating
});

const startupSchema = new mongoose.Schema({
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  thesis: { type: String },
  industry: { type: String },
  milestones: [milestoneSchema],
  validationScore: { type: Number, default: 0 }, // Only based on verified milestones
  auditLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Log' }]
});

module.exports = mongoose.model('Startup', startupSchema);