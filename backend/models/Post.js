const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true, enum: ['founder', 'provider', 'investor'] },
    authorImage: { type: String, default: '' },
    content: { 
        type: String, 
        maxlength: [2200, 'Post cannot exceed 2200 characters'],
        trim: true,
        default: ''
    },
    postType: { 
        type: String, 
        required: true, 
        enum: ['service_needed', 'funding_needed', 'offering_service', 'offering_funding'] 
    },
    tags: [{ type: String, trim: true, maxlength: 20 }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Media fields for Instagram-like posts
    media: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }, // Cloudinary public_id for deletion
        type: { type: String, enum: ['image', 'video'], required: true },
        width: Number,
        height: Number,
        duration: Number, // For videos
        thumbnail: String // Video thumbnail URL
    }],
    mediaCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0, index: true }
}, { timestamps: true });

// Compound indexes for efficient queries
postSchema.index({ createdAt: -1 });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ postType: 1, createdAt: -1 });
postSchema.index({ 'likes': 1 });

// Virtual for engagement score (for Instagram-like algorithm)
postSchema.virtual('engagementScore').get(function() {
    const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    const likesWeight = this.likes.length * 10;
    const viewsWeight = this.viewCount * 0.1;
    const recencyBoost = Math.max(0, 100 - ageInHours);
    return likesWeight + viewsWeight + recencyBoost;
});

module.exports = mongoose.model('Post', postSchema);