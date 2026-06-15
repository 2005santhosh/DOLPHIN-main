/**
 * Comment.js — Comments on posts.
 */
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  postId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  authorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorImage:{ type: String, default: '' },
  content:    { type: String, required: true, trim: true, maxlength: 500 },
  likes:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

CommentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', CommentSchema);
