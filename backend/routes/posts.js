const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { protect } = require('../middleware/authMiddleware');
const { uploadPostMedia, cloudinary } = require('../config/cloudinary');
const rateLimit = require('express-rate-limit');

const feedLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 50 });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const likeLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 50 });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// POST /api/posts - Create post with optional media
router.post('/', protect, createLimiter, uploadPostMedia.array('media', 10), async (req, res) => {
    try {
        const { content, postType, tags } = req.body;
        const user = req.user;

        // Validate: Either content or media must be present
        if (!content && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: 'Post must have content or media' });
        }

        // Process uploaded media
        const media = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaItem = {
                    url: file.path,
                    publicId: file.filename,
                    type: file.mimetype.startsWith('video/') ? 'video' : 'image',
                    width: file.width,
                    height: file.height
                };

                // Add video-specific data
                if (mediaItem.type === 'video') {
                    mediaItem.duration = file.duration;
                    // Cloudinary generates thumbnail automatically
                    mediaItem.thumbnail = file.path.replace(/\.(mp4|mov|avi|mkv|webm)$/, '.jpg');
                }

                media.push(mediaItem);
            }
        }

        const newPost = await Post.create({
            authorId: user._id,
            authorName: user.name,
            authorRole: user.role,
            authorImage: user.profilePicture || '',
            content: content || '',
            postType,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            media,
            mediaCount: media.length
        });

        res.status(201).json(newPost);
    } catch (error) {
        console.error('Create post error:', error);
        
        // Clean up uploaded files if post creation fails
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    await cloudinary.uploader.destroy(file.filename, {
                        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image'
                    });
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
            }
        }
        
        res.status(500).json({ message: error.message || 'Server error creating post' });
    }
});

// GET /api/posts/feed - Instagram-like feed with infinite scroll
router.get('/feed', protect, feedLimiter, async (req, res) => {
    try {
        const userRole = req.user.role;
        const filterType = req.query.filter; // 'all' or 'mine'
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let filter = {};

        if (filterType === 'mine') {
            filter = { authorId: req.user._id };
        } else {
            // Instagram-like algorithm: Show relevant posts based on role
            if (userRole === 'founder') {
                filter = { 
                    $or: [ 
                        { authorId: req.user._id }, 
                        { postType: { $in: ['offering_service', 'offering_funding'] } } 
                    ] 
                };
            } else if (userRole === 'provider') {
                filter = { 
                    $or: [ 
                        { authorId: req.user._id }, 
                        { postType: 'service_needed' } 
                    ] 
                };
            } else if (userRole === 'investor') {
                filter = { 
                    $or: [ 
                        { authorId: req.user._id }, 
                        { postType: 'funding_needed' } 
                    ] 
                };
            }
        }

        // Get total count for pagination
        const totalPosts = await Post.countDocuments(filter);

        // Fetch posts with Instagram-like sorting (engagement-based)
        const posts = await Post.find(filter)
            .sort({ createdAt: -1 }) // Most recent first (can be enhanced with engagement score)
            .skip(skip)
            .limit(limit)
            .lean();

        const formattedPosts = posts.map(post => ({
            _id: post._id,
            authorId: post.authorId,
            authorName: post.authorName,
            authorRole: post.authorRole,
            authorImage: post.authorImage || '',
            content: post.content,
            postType: post.postType,
            tags: post.tags,
            media: post.media || [],
            mediaCount: post.mediaCount || 0,
            createdAt: post.createdAt,
            likeCount: post.likes.length,
            isLikedByMe: post.likes.some(id => id.toString() === req.user._id.toString()),
            viewCount: post.viewCount || 0
        }));

        res.json({
            posts: formattedPosts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPosts / limit),
                totalPosts,
                hasMore: skip + posts.length < totalPosts
            }
        });
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ message: 'Error fetching feed' });
    }
});

// POST /api/posts/:id/like
router.post('/:id/like', protect, likeLimiter, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const isLiked = post.likes.some(id => id.toString() === req.user._id.toString());
        
        if (isLiked) {
            post.likes.pull(req.user._id);
        } else {
            post.likes.addToSet(req.user._id);
        }

        await post.save();

        res.json({ 
            isLikedByMe: !isLiked, 
            likeCount: post.likes.length 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error liking post' });
    }
});

// POST /api/posts/:id/view - Track views for algorithm
router.post('/:id/view', protect, async (req, res) => {
    try {
        await Post.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error tracking view' });
    }
});

// DELETE /api/posts/:id - Delete own post with media cleanup
router.delete('/:id', protect, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Security: Ensure only the author can delete their post
        if (post.authorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this post' });
        }

        // Delete media from Cloudinary
        if (post.media && post.media.length > 0) {
            for (const mediaItem of post.media) {
                try {
                    await cloudinary.uploader.destroy(mediaItem.publicId, {
                        resource_type: mediaItem.type === 'video' ? 'video' : 'image'
                    });
                } catch (cleanupError) {
                    console.error('Media cleanup error:', cleanupError);
                }
            }
        }

        await Post.findByIdAndDelete(req.params.id);

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Error deleting post' });
    }
});

module.exports = router;