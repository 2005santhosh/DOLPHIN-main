const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true, // Ensure emails are case-insensitive
    trim: true
  },
  password: { 
    type: String, 
    required: true, 
    select: false 
  },
  role: { 
    type: String, 
    enum: ['founder', 'investor', 'provider', 'admin'], 
    required: true 
  },

  // RECOMMENDATION 1: State consistency
  // Removed numeric 'stage' field. We now derive the stage number virtually from the string state.
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

  emailVerified: { type: Boolean, default: false },
  
  watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Startup' }],
  
  interestAreas: [{ type: String }],
  stagePreference: [{ type: Number }],
  
  rewardPoints: { type: Number, default: 0 },
  emailNotifications: { type: Boolean, default: true },
  
  profilePicture: {
    type: String,
    default: "default.jpg" 
  },

  // RECOMMENDATION 2: Unbounded Arrays
  // Removed embedded 'ratings' array.
  // We now store rating aggregates here for performance, updated when ratings are added.
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  
  resetPasswordToken: String,
  resetPasswordExpire: Date

}, {
  timestamps: true, // Handles createdAt/updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// RECOMMENDATION 3: Indexing
// Optimizes queries filtering by role and state (e.g., "Show me all approved founders")
userSchema.index({ role: 1, state: 1 });
// Optimizes text search on name (optional but useful for admin panels)
userSchema.index({ name: 'text' });

// --- VIRTUALS ---

// RECOMMENDATION 1 IMPLEMENTATION:
// Derive numeric stage from the state string automatically.
userSchema.virtual('stage').get(function() {
  if (!this.state) return 0;
  if (this.state === 'PENDING_APPROVAL') return 0;
  if (this.state === 'BLOCKED') return -1;
  
  // Extract number from string (e.g., "STAGE_5" -> 5)
  const match = this.state.match(/STAGE_(\d+)/);
  return match ? parseInt(match[1]) : 0;
});

// Reverse populate ratings if needed (usually done in controller, but useful to define)
userSchema.virtual('ratings', {
  ref: 'Rating',
  localField: '_id',
  foreignField: 'toUserId',
  justOne: false
});

// --- MIDDLEWARE ---

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// --- METHODS ---

userSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);