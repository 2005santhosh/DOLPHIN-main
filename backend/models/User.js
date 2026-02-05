const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['founder', 'investor', 'provider','admin'], required: true },

  // Backend-controlled lifecycle state used by both API authorization and frontend visibility.
  // NOTE: we model stages explicitly to support the 7-stage founder roadmap.
  state: {
    type: String,
    enum: [
      'PENDING_APPROVAL',
      'APPROVED',
      'STAGE_1',
      'STAGE_2',
      'STAGE_3',
      'STAGE_4',
      'STAGE_5',
      'STAGE_6',
      'STAGE_7',
      'BLOCKED'
    ],
    default: 'PENDING_APPROVAL'
  },

  // Numeric stage for convenience; 0 means “not in stages yet” (e.g. pending approval).
  stage: { type: Number, default: 0 },

  emailVerified: { type: Boolean, default: false },
  watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Startup' }],
  interestAreas: [{ type: String }],
  stagePreference: [{ type: Number }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
