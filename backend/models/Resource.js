// backend/models/Resource.js
const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['guide', 'template', 'checklist', 'tool', 'video'],
    default: 'guide'
  },
  url: {
    type: String, // Link to the resource (e.g., Google Drive, PDF, Website)
    required: true
  },
  icon: {
    type: String,
    default: 'book'
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resource', ResourceSchema);