const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { protect } = require('../middleware/authMiddleware');// Use your existing auth middleware
const rateLimit = require('express-rate-limit');

const feedLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30 });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const likeLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30 });

// POST /api/posts
router.post('/', protect, createLimiter, async (req, res) => {
    try {
        const { content, postType, tags } = req.body;
        const user = req.user;

        const newPost = await Post.create({
            authorId: user._id,
            authorName: user.name,
            authorRole: user.role,
            authorImage: user.profilePicture || '',
            content,
            postType,
            tags: tags || []
        });

        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: 'Server error creating post' });
    }
});

// GET /api/posts/feed
router.get('/feed', protect, feedLimiter, async (req, res) => {
    try {
        const userRole = req.user.role;
        const filterType = req.query.filter; // 'all' or 'mine'
        let filter = {};

        if (filterType === 'mine') {
            // MY POSTS: Only return posts by this user
            filter = { authorId: req.user._id };
        } else {
            // ALL POSTS: Targeted feed logic based on role
            if (userRole === 'founder') {
                filter = { $or: [ { authorId: req.user._id }, { postType: { $in: ['offering_service', 'offering_funding'] } } ] };
            } else if (userRole === 'provider') {
                filter = { $or: [ { authorId: req.user._id }, { postType: 'service_needed' } ] };
            } else if (userRole === 'investor') {
                filter = { $or: [ { authorId: req.user._id }, { postType: 'funding_needed' } ] };
            }
        }

        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        const formattedPosts = posts.map(post => ({
            _id: post._id,
            authorId: post.authorId,
            authorName: post.authorName,
            authorRole: post.authorRole,
            authorImage: post.authorPicture || post.authorImage || '',
            content: post.content,
            postType: post.postType,
            tags: post.tags,
            createdAt: post.createdAt,
            likeCount: post.likes.length,
            isLikedByMe: post.likes.includes(req.user._id)
        }));

        res.json(formattedPosts);
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

        const isLiked = post.likes.includes(req.user._id);
        
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

module.exports = router;