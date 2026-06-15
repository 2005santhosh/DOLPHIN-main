const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const IntroRequest = require('../models/IntroRequest');
const Connection = require('../models/Connection');
const { protect } = require('../middleware/authMiddleware');
const { cloudinary } = require('../config/cloudinary');
const rateLimit = require('express-rate-limit');
const { recordActivity } = require('../services/gamificationService');

const feedLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 300 });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
const likeLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 200 });

const DAILY_POST_LIMIT = 5;

/** Returns start of current calendar day in UTC (midnight 00:00:00.000) */
function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Count how many posts this user has created since midnight UTC today */
async function countTodayPosts(userId) {
  return Post.countDocuments({
    authorId: userId,
    createdAt: { $gte: startOfTodayUTC() },
  });
}

// ─── GET /api/posts/videos — all video posts for the Reels Viewer ─────────────
// Returns ALL video posts (not paginated) so the viewer can scroll through all of them.
// Capped at 200 to prevent excessive payload.
router.get('/videos', protect, async (req, res) => {
    try {
        const userRole = req.user.role;
        const buildRoleFilter = (userId, role) => {
            if (role === 'founder')   return { $or: [{ authorId: userId }, { authorRole: 'investor' }, { authorRole: 'provider' }] };
            if (role === 'provider')  return { $or: [{ authorId: userId }, { authorRole: 'founder' }] };
            if (role === 'investor')  return { $or: [{ authorId: userId }, { authorRole: 'founder' }] };
            return {};
        };
        const roleFilter = buildRoleFilter(req.user._id, userRole);
        const filter = { ...roleFilter, 'media.type': 'video', mediaCount: { $gt: 0 } };

        const posts = await Post.find(filter)
            .select('authorId authorName authorRole authorImage content postType media mediaCount createdAt likes viewCount')
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();

        // Build verified author set for badge display
        const authorIds = [...new Set(posts.map(p => p.authorId?.toString()).filter(Boolean))];
        const verifiedSet = new Set();
        if (authorIds.length > 0) {
            const verifiedAuthors = await User.find(
                { _id: { $in: authorIds }, isVerified: true, verifiedSource: 'payment', verifiedUntil: { $gt: new Date() } },
                { _id: 1 }
            ).lean();
            verifiedAuthors.forEach(u => verifiedSet.add(u._id.toString()));
        }

        const result = posts.map(post => ({
            _id: post._id,
            authorId: post.authorId,
            authorName: post.authorName,
            authorRole: post.authorRole,
            authorImage: post.authorImage || '',
            content: post.content,
            postType: post.postType,
            media: post.media || [],
            mediaCount: post.mediaCount || 0,
            createdAt: post.createdAt,
            likeCount: post.likes?.length || 0,
            isLikedByMe: post.likes?.some(id => id.toString() === req.user._id.toString()) || false,
            viewCount: post.viewCount || 0,
            isAuthorVerified: verifiedSet.has(post.authorId?.toString()),
            connectionStatus: null, // not needed for viewer
        }));

        res.json({ posts: result, total: result.length });
    } catch (error) {
        console.error('Videos feed error:', error);
        res.status(500).json({ message: 'Error fetching videos' });
    }
});

// ─── GET /api/posts/daily-limit — how many posts remain today ────────────────
router.get('/daily-limit', protect, async (req, res) => {    try {
        const usedToday = await countTodayPosts(req.user._id);
        const remaining = Math.max(0, DAILY_POST_LIMIT - usedToday);
        const tomorrow  = startOfTodayUTC();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        res.json({
            dailyLimit:  DAILY_POST_LIMIT,
            usedToday,
            remaining,
            resetsAt: tomorrow.toISOString(),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ─── GET /api/posts/upload-signature — Cloudinary direct upload signature ────
// Frontend calls this to get a signed upload preset, then uploads directly to
// Cloudinary (browser → CDN). No binary data passes through our server.
router.get('/upload-signature', protect, async (req, res) => {
    try {
        const crypto = require('crypto');
        const timestamp = Math.round(Date.now() / 1000);
        const folder = 'dolphin-posts';

        // CRITICAL: Only sign exactly the params you send in the XHR FormData.
        // Any unsigned param sent to Cloudinary → "Invalid Signature" → network error.
        // We only send folder + timestamp, nothing else.
        const str = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
        const signature = crypto.createHash('sha256').update(str).digest('hex');

        res.json({
            signature,
            timestamp,
            folder,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
        });
    } catch (err) {
        console.error('Upload signature error:', err);
        res.status(500).json({ message: 'Could not generate upload signature' });
    }
});

// POST /api/posts - Create post (media URLs already uploaded to Cloudinary directly)
router.post('/', protect, createLimiter, async (req, res) => {
    try {
        const { content, postType, tags, media: mediaJson } = req.body;
        const user = req.user;

        // ── Daily post limit ──────────────────────────────────────────────────
        const todayCount = await countTodayPosts(user._id);
        if (todayCount >= DAILY_POST_LIMIT) {
            const tomorrow = startOfTodayUTC();
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            return res.status(429).json({
                message: `You've reached your daily limit of ${DAILY_POST_LIMIT} posts. You can post again after midnight (12:00 AM).`,
                dailyLimit: DAILY_POST_LIMIT,
                usedToday: todayCount,
                resetsAt: tomorrow.toISOString(),
            });
        }

        // Parse media array (sent as JSON string or array of {url, publicId, type})
        let media = [];
        if (mediaJson) {
            try {
                media = typeof mediaJson === 'string' ? JSON.parse(mediaJson) : mediaJson;
                if (!Array.isArray(media)) media = [];
            } catch { media = []; }
        }

        // Validate: Either content or media must be present
        if (!content?.trim() && media.length === 0) {
            return res.status(400).json({ message: 'Post must have content or media' });
        }

        // Validate content length
        if (content && content.length > 2200) {
            return res.status(400).json({ message: 'Post content cannot exceed 2200 characters' });
        }

        // Validate postType
        const VALID_POST_TYPES = ['general', 'service_needed', 'funding_needed', 'offering_service', 'offering_funding'];
        const safePostType = VALID_POST_TYPES.includes(postType) ? postType : 'general';

        // Sanitise and limit media items
        const safeMedia = media.slice(0, 10).map(item => ({
            url:       String(item.url || '').slice(0, 500),
            publicId:  String(item.publicId || '').slice(0, 200),
            type:      item.type === 'video' ? 'video' : 'image',
            width:     Number(item.width)  || null,
            height:    Number(item.height) || null,
            thumbnail: item.thumbnail ? String(item.thumbnail).slice(0, 500) : undefined,
        }));

        const parsedTags = tags
            ? (Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean))
            : [];

        const newPost = await Post.create({
            authorId:    user._id,
            authorName:  user.name,
            authorRole:  user.role,
            authorImage: user.profilePicture || '',
            content:     (content || '').trim(),
            postType:    safePostType,
            tags:        parsedTags.slice(0, 10),
            media:       safeMedia,
            mediaCount:  safeMedia.length,
        });

        // Fire-and-forget gamification points
        recordActivity(user._id, 'post').catch(e => console.error('Gamification post error:', e));

        res.status(201).json(newPost);
    } catch (error) {
        console.error('Create post error:', error);
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

        // Fetch a larger pool for engagement scoring + author diversity interleaving.
        // We need more than `limit` posts so the interleave algorithm has enough
        // posts from different authors to fill a full page without gaps.
        // Pool size: fetch enough to cover this page and the interleave buffer.
        // For page N: we need to re-score from scratch and re-interleave, so we
        // fetch ALL scored posts up to (skip + limit * 3) and slice after interleave.
        const poolSize = Math.min(skip + limit * 4, 200); // cap at 200 to limit DB load

        const rawPosts = await Post.aggregate([
            { $match: filter },
            {
                $addFields: {
                    engagementScore: {
                        $add: [
                            { $multiply: [{ $size: { $ifNull: ['$likes', []] } }, 3] },
                            { $ifNull: ['$viewCount', 0] },
                            {
                                $cond: {
                                    if: { $gte: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                                    then: 50,
                                    else: {
                                        $cond: {
                                            if: { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                                            then: 20,
                                            else: 0,
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            { $sort: { engagementScore: -1, createdAt: -1 } },
            { $limit: poolSize },  // No $skip here — we slice after interleave
            {
                $project: {
                    authorId: 1, authorName: 1, authorRole: 1, authorImage: 1,
                    content: 1, postType: 1, tags: 1, media: 1, mediaCount: 1,
                    createdAt: 1, likes: 1, viewCount: 1
                }
            }
        ]);

        // We'll do the verified-author lookup on this pool, then interleave,
        // then slice [skip .. skip+limit] for the correct page window.
        const posts = rawPosts; // rename for compatibility with code below

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

        // Boost verified authors using the authorIds already collected above.
        // Single indexed query: covered by verification_status index on users.
        // No extra round-trip — authorIds is already built.
        const verifiedAuthorIds = new Set();
        if (authorIds.length > 0) {
            const verifiedAuthors = await User.find(
                {
                    _id: { $in: authorIds },
                    isVerified: true,
                    verifiedSource: 'payment',
                    verifiedUntil: { $gt: new Date() },
                },
                { _id: 1 }   // projection-only, fastest possible read
            ).lean();
            verifiedAuthors.forEach(u => verifiedAuthorIds.add(u._id.toString()));
        }
        // Also check the current user (their own posts show badge if verified)
        if (req.user.isVerified && req.user.verifiedSource === 'payment' &&
            req.user.verifiedUntil && new Date(req.user.verifiedUntil) > new Date()) {
            verifiedAuthorIds.add(req.user._id.toString());
        }

        const boostedPosts = enrichedPosts
            .map(p => ({
                ...p,
                isAuthorVerified: verifiedAuthorIds.has(p.authorId?.toString())
            }))
            .sort((a, b) => {
                if (a.isAuthorVerified && !b.isAuthorVerified) return -1;
                if (!a.isAuthorVerified && b.isAuthorVerified) return 1;
                return 0;
            });

        // ── Author diversity interleave (Instagram-style) ──────────────────────
        // Prevents consecutive posts from the same author by round-robin
        // distributing posts across unique authors.
        //
        // Algorithm:
        //   1. Group posts by authorId into buckets (preserving score order within each bucket)
        //   2. Round-robin pick one post from each bucket in turn
        //   3. Result: A → B → C → A → B → C pattern, never A → A → A
        //
        // Verified authors' buckets are placed first so their posts get higher
        // slots in the round-robin, giving them natural priority without clustering.
        function interleaveByAuthor(posts) {
            if (posts.length === 0) return posts;

            // Build ordered bucket list — verified authors first
            const authorOrder = [];
            const buckets = {};
            for (const p of posts) {
                const aid = p.authorId?.toString() || 'unknown';
                if (!buckets[aid]) {
                    buckets[aid] = [];
                    authorOrder.push(aid);
                }
                buckets[aid].push(p);
            }

            // Sort author order: verified first, then by their best post score
            authorOrder.sort((a, b) => {
                const aVerified = buckets[a][0]?.isAuthorVerified ? 1 : 0;
                const bVerified = buckets[b][0]?.isAuthorVerified ? 1 : 0;
                return bVerified - aVerified;
            });

            // Round-robin interleave
            const result = [];
            let hasMore = true;
            while (hasMore) {
                hasMore = false;
                for (const aid of authorOrder) {
                    if (buckets[aid].length > 0) {
                        result.push(buckets[aid].shift());
                        if (buckets[aid].length > 0) hasMore = true;
                    }
                }
            }
            return result;
        }

        const diverseFeed = interleaveByAuthor(boostedPosts).slice(skip, skip + limit);

        res.json({
            posts: diverseFeed,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPosts / limit),
                totalPosts,
                hasMore: skip + diverseFeed.length < totalPosts
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
