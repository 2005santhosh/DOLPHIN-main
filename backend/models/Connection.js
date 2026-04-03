const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
    from: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    to: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'rejected'], 
        default: 'pending' 
    }
}, { timestamps: true });

// Prevent duplicate requests: Ensures a combination of (from, to) is unique
connectionSchema.index({ from: 1, to: 1 }, { unique: true });

// Speed up finding all requests sent TO a specific user
connectionSchema.index({ to: 1, status: 1 });

module.exports = mongoose.model('Connection', connectionSchema);