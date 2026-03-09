const mongoose = require('mongoose');

const introRequestSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  
  // ✅ ADD THIS: Tracks who sent the request
  initiator: { 
    type: String, 
    enum: ['founder', 'provider', 'investor'], 
    required: true 
  },
  
  message: { type: String },
  servicesOffered: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IntroRequest', introRequestSchema);