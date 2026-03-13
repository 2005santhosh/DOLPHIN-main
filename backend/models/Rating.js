const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  fromUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  toUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  score: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  comment: { 
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Ensure a user can only rate another user once
ratingSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

// Static method to calculate and update average rating on the User model
ratingSchema.statics.calculateAverageRating = async function(toUserId) {
  const stats = await this.aggregate([
    { $match: { toUserId: toUserId } },
    { 
      $group: { 
        _id: '$toUserId', 
        averageRating: { $avg: '$score' },
        ratingCount: { $sum: 1 }
      } 
    }
  ]);

  try {
    const User = mongoose.model('User');
    if (stats.length > 0) {
      await User.findByIdAndUpdate(toUserId, {
        ratingAverage: stats[0].averageRating.toFixed(1),
        ratingCount: stats[0].ratingCount
      });
    } else {
      // If no reviews left, reset to 0
      await User.findByIdAndUpdate(toUserId, {
        ratingAverage: 0,
        ratingCount: 0
      });
    }
  } catch (err) {
    console.error('Error updating rating stats:', err);
  }
};

// Call the static method after saving a rating
ratingSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.toUserId);
});

// Call the static method after removing a rating
ratingSchema.post('remove', function() {
  this.constructor.calculateAverageRating(this.toUserId);
});

module.exports = mongoose.model('Rating', ratingSchema);