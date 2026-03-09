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
  resetPasswordToken: String,
  resetPasswordExpire: Date
  // Virtual or static method to calculate average could be added, but we will calculate on the fly for simplicity
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
