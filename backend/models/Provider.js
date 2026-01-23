// models/Provider.js (New: Real model for providers replacing mock)
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  verified: { type: Boolean, default: false },
  stageCategories: [{ type: Number }], // Array of stage orders (1-7)
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Provider', providerSchema);