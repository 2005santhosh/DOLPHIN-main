const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true, enum: ['founder', 'provider', 'investor'] },
    authorImage: { type: String, default: '' },
    content: { 
        type: String, 
        required: [true, 'Post cannot be empty'], 
        maxlength: [500, 'Post cannot exceed 500 characters'],
        trim: true 
    },
    postType: { 
        type: String, 
        required: true, 
        enum: ['service_needed', 'funding_needed', 'offering_service', 'offering_funding'] 
    },
    tags: [{ type: String, trim: true, maxlength: 20 }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Array of User IDs
}, { timestamps: true });

// Index for sorting feed by newest (Makes DB queries lightning fast)
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);