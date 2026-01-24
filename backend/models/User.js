const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['founder', 'investor', 'provider'], required: true },
  state: { 
    type: String, 
    enum: ['PENDING_APPROVAL', 'APPROVED', 'STAGE_1', 'STAGE_2', 'STAGE_3', 'BLOCKED'],
    default: 'PENDING_APPROVAL'
  },
  stage: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);