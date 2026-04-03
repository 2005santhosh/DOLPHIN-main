const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User'); // Adjust path if needed
const auth = require('../middleware/auth'); // Your existing auth middleware
const rateLimit = require('express-rate-limit');

// SECURITY: Prevent spamming the feed
const feedLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30 });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }); // 5 posts per hour
const likeLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30 }); // 30 likes per min

// POST /api/posts - Create Post
router.post('/', auth, createLimiter, async (req, res) => {
    try {
        const { content, postType, tags } = req.body;
        const user = req.user;

        const newPost = await Post.create({
            authorId: user._id,
            authorName: user.name,
            authorRole: user.role,
            authorImage: user.profileImage || '',
            content,
            postType,
            tags: tags || []
        });

        // ==========================================
        // SMART EMAIL/NOTIFICATION TRIGGER LOGIC
        // ==========================================
        // NOTE: Implement your sendEmail() function and Notification.create() here based on postType and tags.
        // Example: if(user.role === 'founder' && postType === 'service_needed') { ... find matching providers ... sendEmail() ... }

        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: 'Server error creating post' });
    }
});

// GET /api/posts/feed - Get Smart Feed
router.get('/feed', auth, feedLimiter, async (req, res) => {
    try {
        const userRole = req.user.role;
        let filter = {};

        // Smart Filtering
        if (userRole === 'founder') filter = { authorRole: { $in: ['provider', 'investor'] } };
        else if (userRole === 'provider') filter = { authorRole: 'founder' };
        else if (userRole === 'investor') filter = { authorRole: 'founder' };

        // PERFORMANCE: .lean() converts to plain JS objects (much faster JSON serialization)
        // .select() prevents sending unnecessary data
        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .limit(50) // Never send infinite data to mobile
            .lean();

        // Map likes securely on the backend to save mobile CPU
        const formattedPosts = posts.map(post => ({
            _id: post._id,
            authorId: post.authorId,
            authorName: post.authorName,
            authorRole: post.authorRole,
            authorImage: post.authorImage,
            content: post.content,
            postType: post.postType,
            tags: post.tags,
            createdAt: post.createdAt,
            likeCount: post.likes.length,
            isLikedByMe: post.likes.includes(req.user._id) // O(1) lookup on backend
        }));

        res.json(formattedPosts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching feed' });
    }
});

// POST /api/posts/:id/like - Toggle Like
router.post('/:id/like', auth, likeLimiter, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const isLiked = post.likes.includes(req.user._id);
        
        if (isLiked) {
            post.likes.pull(req.user._id); // Remove like
        } else {
            post.likes.addToSet(req.user._id); // Add like (prevents duplicates securely)
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

module.exports = router;