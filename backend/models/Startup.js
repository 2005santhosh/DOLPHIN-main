const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  order: { type: Number, required: true }
});

const startupSchema = new mongoose.Schema({
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  thesis: { type: String },
  industry: { type: String },
  milestones: [milestoneSchema],
  validationScore: { type: Number, default: 0 },
  auditLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Log' }]
});

module.exports = mongoose.model('Startup', startupSchema);