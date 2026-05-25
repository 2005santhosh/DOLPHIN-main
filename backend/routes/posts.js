const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const IntroRequest = require('../models/IntroRequest');
const Connection = require('../models/Connection');
const { protect } = require('../middleware/authMiddleware');
const { uploadPostMedia, cloudinary } = require('../config/cloudinary');
const rateLimit = require('express-rate-limit');
const { recordActivity } = require('../services/gamificationService');

const feedLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 300 });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
const likeLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 200 });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

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
            postType: postType || 'general',
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            media,
            mediaCount: media.length
        });

        // Award gamification points for posting
        recordActivity(user._id, 'post').catch(e => console.error('Gamification post error:', e));

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
        const filterType = req.query.filter; // 'all', 'mine', or a specific postType value
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const VALID_POST_TYPES = ['general', 'service_needed', 'funding_needed', 'offering_service', 'offering_funding'];

        // Build the role-based author filter (who can see whose posts)
        const buildRoleFilter = (userId, role) => {
            if (role === 'founder') {
                return { $or: [{ authorId: userId }, { authorRole: 'investor' }, { authorRole: 'provider' }] };
            } else if (role === 'provider') {
                return { $or: [{ authorId: userId }, { authorRole: 'founder' }] };
            } else if (role === 'investor') {
                return { $or: [{ authorId: userId }, { authorRole: 'founder' }] };
            }
            return {}; // admin sees everything
        };

        let filter = {};

        if (filterType === 'mine') {
            filter = { authorId: req.user._id };
        } else if (VALID_POST_TYPES.includes(filterType)) {
            // Filter by specific post type within the role-based feed
            const roleFilter = buildRoleFilter(req.user._id, userRole);
            // Merge role filter with postType filter
            if (roleFilter.$or) {
                filter = { $and: [roleFilter, { postType: filterType }] };
            } else {
                filter = { postType: filterType };
            }
        } else {
            // 'all' — role-based feed, no postType restriction
            filter = buildRoleFilter(req.user._id, userRole);
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

        // Enrich with connection status for each post author
        // Check BOTH Connection model (direct connect) and IntroRequest model (founder/provider flow)
        const authorIds = [...new Set(
            formattedPosts
                .filter(p => p.authorId?.toString() !== req.user._id.toString())
                .map(p => p.authorId?.toString())
                .filter(Boolean)
        )];

        let connectionMap = {};
        if (authorIds.length > 0) {
            // Check Connection model (used by connect button in posts/investors/providers)
            const connections = await Connection.find({
                $or: [
                    { from: req.user._id, to: { $in: authorIds } },
                    { from: { $in: authorIds }, to: req.user._id },
                ]
            }).select('from to status').lean();

            connections.forEach(conn => {
                const otherId = conn.from?.toString() === req.user._id.toString()
                    ? conn.to?.toString()
                    : conn.from?.toString();
                if (otherId) {
                    const priority = { accepted: 3, pending: 2, rejected: 1 };
                    if (!connectionMap[otherId] || (priority[conn.status] || 0) > (priority[connectionMap[otherId]] || 0)) {
                        connectionMap[otherId] = conn.status;
                    }
                }
            });

            // Also check IntroRequest model (founder/provider flow) — only if not already found
            const missingIds = authorIds.filter(id => !connectionMap[id]);
            if (missingIds.length > 0) {
                const requests = await IntroRequest.find({
                    $or: [
                        { founderId: req.user._id, providerId: { $in: missingIds } },
                        { providerId: req.user._id, founderId: { $in: missingIds } },
                        { founderId: { $in: missingIds }, providerId: req.user._id },
                        { providerId: { $in: missingIds }, founderId: req.user._id },
                    ]
                }).select('founderId providerId status').lean();

                requests.forEach(req2 => {
                    const otherId = req2.founderId?.toString() === req.user._id.toString()
                        ? req2.providerId?.toString()
                        : req2.founderId?.toString();
                    if (otherId) {
                        const priority = { accepted: 3, pending: 2, rejected: 1 };
                        if (!connectionMap[otherId] || (priority[req2.status] || 0) > (priority[connectionMap[otherId]] || 0)) {
                            connectionMap[otherId] = req2.status;
                        }
                    }
                });
            }
        }

        const enrichedPosts = formattedPosts.map(p => ({
            ...p,
            connectionStatus: p.authorId?.toString() === req.user._id.toString()
                ? 'own'
                : (connectionMap[p.authorId?.toString()] || null)
        }));

        res.json({
            posts: enrichedPosts,
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
