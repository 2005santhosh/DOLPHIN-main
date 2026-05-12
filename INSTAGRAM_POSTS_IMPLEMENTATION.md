# Instagram-Like Posts System Implementation

## Overview
This document describes the complete Instagram-like posts system with image/video uploads, infinite scrolling, and optimized performance across all role-based interfaces (Founder, Investor, Provider).

## Features Implemented

### 1. **Media Upload (Images & Videos)**
- ✅ Support for multiple file uploads (up to 10 files per post)
- ✅ Image formats: JPEG, PNG, GIF, WebP
- ✅ Video formats: MP4, MOV, AVI, MKV, WebM
- ✅ Maximum file size: 100MB per file
- ✅ Real-time preview before posting
- ✅ Remove individual media items before posting
- ✅ File size and type validation

### 2. **Cloudinary Integration**
- ✅ Secure media storage with automatic optimization
- ✅ Automatic format conversion (WebP for images, optimized video encoding)
- ✅ Responsive image delivery (different sizes for different devices)
- ✅ Video thumbnail generation
- ✅ User-specific folders and watermarking
- ✅ Automatic cleanup on post deletion

### 3. **Instagram-Like Feed Algorithm**
- ✅ Role-based content filtering
  - **Founders**: See service/funding offers
  - **Investors**: See funding needs
  - **Providers**: See service needs
- ✅ Engagement-based sorting (likes + views + recency)
- ✅ View tracking for algorithm optimization
- ✅ Personalized "All Posts" vs "My Posts" tabs

### 4. **Infinite Scroll**
- ✅ Automatic loading as user scrolls
- ✅ Pagination with 20 posts per page
- ✅ Intersection Observer API for performance
- ✅ Loading indicator
- ✅ "No more posts" detection

### 5. **Performance Optimizations**
- ✅ Lazy loading for images
- ✅ GPU acceleration for animations
- ✅ Cloudinary automatic optimization (f_auto, q_auto)
- ✅ Responsive image sizing
- ✅ Video preload="metadata" for fast loading
- ✅ Efficient DOM manipulation with DocumentFragment
- ✅ Debounced scroll events

### 6. **Security Features**
- ✅ File type validation (server + client)
- ✅ File size limits
- ✅ XSS prevention with proper escaping
- ✅ User authentication required
- ✅ Author-only deletion
- ✅ Cloudinary signed uploads
- ✅ Rate limiting on all endpoints

### 7. **User Experience**
- ✅ Media lightbox viewer (click to expand)
- ✅ Video controls (play, pause, volume)
- ✅ Smooth animations and transitions
- ✅ Mobile-responsive design
- ✅ Dark theme support
- ✅ Real-time like updates
- ✅ Post deletion with confirmation

## File Structure

### Backend Files
```
backend/
├── models/Post.js                    # Updated with media fields
├── routes/posts.js                   # Media upload endpoints
├── config/cloudinary.js              # Cloudinary configuration
└── .env                              # Cloudinary credentials
```

### Frontend Files
```
frontend/
├── js/
│   ├── posts.js                      # Complete Instagram-like logic
│   └── api.js                        # Updated API methods
├── css/
│   └── feed.css                      # Instagram-like styling
└── [dashboard files]                 # Updated with media upload UI
    ├── dashboard.html                # Founder dashboard
    ├── investor-dashboard.html       # Investor dashboard
    └── provider-dashboard.html       # Provider dashboard
```

## API Endpoints

### POST `/api/posts`
Create a new post with optional media
- **Body**: FormData with `content`, `postType`, `tags`, and `media[]` files
- **Rate Limit**: 10 posts per hour
- **Response**: Created post object

### GET `/api/posts/feed`
Get paginated feed with Instagram algorithm
- **Query Params**: 
  - `filter`: 'all' | 'mine'
  - `page`: number (default: 1)
  - `limit`: number (default: 20)
- **Rate Limit**: 50 requests per minute
- **Response**: 
  ```json
  {
    "posts": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalPosts": 100,
      "hasMore": true
    }
  }
  ```

### POST `/api/posts/:id/like`
Toggle like on a post
- **Rate Limit**: 50 requests per minute
- **Response**: `{ isLikedByMe: boolean, likeCount: number }`

### POST `/api/posts/:id/view`
Track post view for algorithm
- **Response**: `{ success: true }`

### DELETE `/api/posts/:id`
Delete own post (with media cleanup)
- **Authorization**: Author only
- **Response**: `{ message: 'Post deleted successfully' }`

## Database Schema

### Post Model
```javascript
{
  authorId: ObjectId,
  authorName: String,
  authorRole: 'founder' | 'provider' | 'investor',
  authorImage: String,
  content: String (max 2200 chars),
  postType: 'service_needed' | 'funding_needed' | 'offering_service' | 'offering_funding',
  tags: [String],
  likes: [ObjectId],
  media: [{
    url: String,
    publicId: String,
    type: 'image' | 'video',
    width: Number,
    height: Number,
    duration: Number,
    thumbnail: String
  }],
  mediaCount: Number,
  viewCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Usage Guide

### For Users

#### Creating a Post with Media
1. Navigate to the "Posts" page
2. Type your content (optional if adding media)
3. Click "Add Photos/Videos" button
4. Select up to 10 images/videos
5. Preview appears - remove any unwanted files
6. Select post type and add tags
7. Click "Post" button

#### Viewing Posts
- Scroll through the feed - new posts load automatically
- Click on images to view full size
- Click play button on videos to watch
- Like posts by clicking the heart icon
- Connect with users via the "Connect" button

#### Managing Your Posts
1. Switch to "My Posts" tab
2. Click "Delete" button on any of your posts
3. Confirm deletion (media is automatically removed)

### For Developers

#### Adding Media Upload to New Pages
```html
<!-- Add to HTML -->
<div class="media-upload-section">
    <input type="file" id="post-media-input" accept="image/*,video/*" multiple>
    <button type="button" id="upload-media-btn">Add Photos/Videos</button>
    <div id="media-preview-container"></div>
</div>
```

#### Customizing the Algorithm
Edit `backend/routes/posts.js` - modify the filter logic:
```javascript
// Example: Show all posts to everyone
filter = {}; // Remove role-based filtering
```

#### Adjusting Performance Settings
```javascript
// In frontend/js/posts.js
const MAX_FILES = 10;              // Max files per post
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// In backend/routes/posts.js
const limit = 20;                  // Posts per page
```

## Security Considerations

### File Upload Security
1. **Server-side validation**: File type and size checked on backend
2. **Cloudinary signed uploads**: Prevents unauthorized uploads
3. **User context**: Each upload tagged with user ID
4. **Rate limiting**: Prevents abuse (20 uploads per hour)

### Content Security
1. **XSS Prevention**: All user content is escaped
2. **CSRF Protection**: Credentials-based authentication
3. **Authorization**: Only authors can delete their posts
4. **Input validation**: Content length limits enforced

### Media Security
1. **Secure URLs**: HTTPS-only Cloudinary delivery
2. **Access control**: Public read, authenticated write
3. **Automatic cleanup**: Orphaned media removed on post deletion
4. **Watermarking**: User context embedded in metadata

## Performance Metrics

### Load Times (Target)
- Initial feed load: < 2 seconds
- Infinite scroll load: < 1 second
- Image lazy load: < 500ms
- Video thumbnail: < 300ms

### Optimization Techniques
1. **Cloudinary transformations**: Automatic format and quality optimization
2. **Lazy loading**: Images load only when visible
3. **Intersection Observer**: Efficient scroll detection
4. **GPU acceleration**: Smooth animations
5. **DocumentFragment**: Batch DOM updates

## Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Known Limitations
1. Maximum 10 files per post
2. Maximum 100MB per file
3. Videos limited to 60 seconds (configurable)
4. No video editing features
5. No image filters/effects

## Future Enhancements
- [ ] Image cropping and filters
- [ ] Video trimming
- [ ] Multiple image carousel
- [ ] Comments on posts
- [ ] Share/repost functionality
- [ ] Hashtag search
- [ ] User mentions (@username)
- [ ] Post analytics (views, engagement)
- [ ] Save/bookmark posts
- [ ] Report inappropriate content

## Troubleshooting

### Media Not Uploading
1. Check file size (< 100MB)
2. Verify file format (JPEG, PNG, GIF, WebP, MP4, MOV, etc.)
3. Check Cloudinary credentials in `.env`
4. Verify rate limits not exceeded

### Infinite Scroll Not Working
1. Check browser console for errors
2. Verify `#scroll-sentinel` element exists
3. Check network tab for API calls
4. Ensure `hasMore` flag is correct

### Images Not Loading
1. Check Cloudinary URL format
2. Verify CORS settings
3. Check browser network tab
4. Try clearing browser cache

### Performance Issues
1. Reduce `limit` in API calls (default: 20)
2. Enable Cloudinary auto-optimization
3. Check for memory leaks in DevTools
4. Verify GPU acceleration is working

## Testing

### Manual Testing Checklist
- [ ] Upload single image
- [ ] Upload multiple images
- [ ] Upload video
- [ ] Upload mixed media
- [ ] Delete post with media
- [ ] Infinite scroll loads more posts
- [ ] Like/unlike posts
- [ ] View post in lightbox
- [ ] Mobile responsive design
- [ ] Dark theme compatibility

### Load Testing
```bash
# Test feed endpoint
ab -n 1000 -c 10 https://api.dolphinorg.in/api/posts/feed

# Test upload endpoint (requires auth)
# Use tools like k6 or Artillery for authenticated requests
```

## Support
For issues or questions, contact the development team or create an issue in the repository.

## License
This implementation is part of the Dolphin platform and follows the project's license terms.
