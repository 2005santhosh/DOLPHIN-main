const mongoose = require('mongoose');
const crypto = require('crypto');
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
  updatedAt: { type: Date, default: Date.now },
  rewardPoints: {
    type: Number,
    default: 0
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String,
    default: "" // Will store the path to the image
  },
  // Add this field to the schema
  ratings: [{
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  // ── Gamification ──────────────────────────────────────────────────────────────
  // Streak tracking
  currentStreak:    { type: Number, default: 0 },
  longestStreak:    { type: Number, default: 0 },
  lastActivityDate: { type: Date, default: null },

  // Leaderboard score (computed: connections*15 + posts*10 + dailyActivity*5)
  leaderboardScore: { type: Number, default: 0 },

  // Rewards claimed at streak milestones
  rewards: [{
    milestone:   { type: Number },          // 30, 60, 90
    name:        { type: String },          // 'Dolphin Cap', etc.
    unlockedAt:  { type: Date },
    claimed:     { type: Boolean, default: false },
    claimedAt:   { type: Date },
    deliveryInfo: {
      fullName:  { type: String },
      phone:     { type: String },
      address:   { type: String }
    }
  }],

  // Activity counters for leaderboard
  totalPosts:       { type: Number, default: 0 },
  totalConnections: { type: Number, default: 0 },
  totalDaysActive:  { type: Number, default: 0 },

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  verificationToken: String,
  verificationExpire: Date,

  // ── Profile Verification (paid badge) ────────────────────────────────────────
  isVerified:       { type: Boolean, default: false },
  verifiedAt:       { type: Date, default: null },
  verificationPayment: {
    cfLinkId:       { type: String },
    cfOrderId:      { type: String },
    status:         { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    amount:         { type: Number },
    paidAt:         { type: Date },
  },
});
// Add a method to the schema to generate a reset token
userSchema.methods.getResetPasswordToken = function() {
  // Generate a random token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash the token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expire time (e.g., 10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken; // Return the unhashed token to send via email
};


module.exports = mongoose.model('User', userSchema);
