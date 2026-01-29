# Dolphin Platform - Real-time Notifications & AI Validation

## 🚀 New Features

### ✅ Real-time Notifications
- **WebSocket-based** instant notifications using Socket.io
- **Toast notifications** for immediate feedback
- **Notification center** with history and management
- **Badge counters** showing unread notifications
- **Multi-device sync** - notifications across all logged-in sessions

### 🤖 Free AI Validation (Google Gemini)
- Switched from Claude API to **Google Gemini API** (100% FREE)
- **No token limits** on free tier for reasonable usage
- **15 requests/minute**, 1500 requests/day limit
- **Automatic fallback** to heuristic scoring if API unavailable
- **Batch processing** with rate limiting to respect API limits

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `socket.io` - Real-time WebSocket connections
- All existing dependencies (express, mongoose, etc.)

### 2. Get FREE Gemini API Key

1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

**Free Tier Includes:**
- ✅ 15 requests per minute
- ✅ 1,500 requests per day
- ✅ No credit card required
- ✅ No expiration

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your-actual-gemini-api-key-here
```

### 4. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 5. Update Frontend HTML

Add these scripts to your HTML files (e.g., `founderDashboard.html`):

```html
<!-- Add Socket.io client BEFORE your custom scripts -->
<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>

<!-- Add notification styles -->
<link rel="stylesheet" href="./css/notifications.css">

<!-- Add socket client -->
<script src="./js/socket-client.js"></script>
```

## 📁 File Structure

```
backend/
├── services/
│   ├── socketService.js              # Socket.io server setup
│   ├── notificationService.js        # Notification creation & management
│   ├── geminiValidationService.js    # NEW: Gemini AI validation
│   └── aiValidationService.js        # OLD: Claude AI (deprecated)
├── models/
│   └── Notification.js               # Notification database model
├── routes/
│   ├── notifications.js              # Notification API endpoints
│   └── founder.js                    # Updated with notifications
└── server.js                         # Updated with Socket.io

frontend/
├── js/
│   └── socket-client.js              # Socket.io client & notification UI
└── css/
    └── notifications.css             # Notification styles
```

## 🔔 Notification Types

The system supports these notification types:

| Type | Description | Priority |
|------|-------------|----------|
| `VALIDATION_COMPLETE` | Stage validation finished | High |
| `STAGE_UNLOCKED` | New stage available | High |
| `TASK_APPROVED` | Task approved by admin | Medium |
| `TASK_REJECTED` | Task needs revision | High |
| `MILESTONE_VERIFIED` | Milestone verified | High |
| `ADMIN_MESSAGE` | Message from admin | High |
| `SYSTEM_UPDATE` | System announcement | Medium |
| `PROVIDER_MATCHED` | Service provider match | Medium |
| `INVESTOR_INTEREST` | Investor showed interest | High |
| `FEEDBACK_RECEIVED` | New feedback available | Medium |

## 🛠️ API Endpoints

### Notifications

#### Get User Notifications
```http
GET /api/notifications
Authorization: Bearer <token>
Query params:
  - limit (default: 50)
  - skip (default: 0)
  - unreadOnly (default: false)
```

#### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /api/notifications/:notificationId/read
Authorization: Bearer <token>
```

#### Mark All as Read
```http
PUT /api/notifications/read-all
Authorization: Bearer <token>
```

#### Delete Notification
```http
DELETE /api/notifications/:notificationId
Authorization: Bearer <token>
```

## 🎨 Frontend Integration

### Initialize Socket Connection

```javascript
// Automatically connects when user is logged in
// Connection is established in socket-client.js
```

### Subscribe to Startup Updates

```javascript
// Subscribe to specific startup notifications
subscribeToStartup(startupId);

// Unsubscribe
unsubscribeFromStartup(startupId);
```

### Manually Create Notification

```javascript
const { createNotification } = require('./services/notificationService');

await createNotification({
  userId: 'user-id',
  type: 'ADMIN_MESSAGE',
  title: 'Welcome to Dolphin!',
  message: 'Get started by creating your startup profile.',
  priority: 'high',
  actionUrl: '/profile',
  actionText: 'Create Profile'
});
```

## 🔒 Security Features

- ✅ **JWT Authentication** - Socket connections require valid JWT token
- ✅ **User Isolation** - Users only receive their own notifications
- ✅ **Rate Limiting** - Gemini API calls are rate-limited
- ✅ **Input Validation** - All notification data is validated
- ✅ **XSS Protection** - Notification content is sanitized

## ⚡ Performance Optimizations

- **Batch Processing** - AI validation processes questions in batches
- **Rate Limiting** - Respects Gemini API limits (15 RPM)
- **Automatic Cleanup** - Old notifications are deleted after 30 days
- **Fallback Scoring** - Heuristic scoring if AI API is unavailable
- **Connection Pooling** - Efficient database connections
- **WebSocket Compression** - Reduces bandwidth usage

## 🐛 Troubleshooting

### Socket.io Not Connecting

1. Check browser console for errors
2. Verify JWT token is present in localStorage
3. Check if server is running
4. Verify CORS settings in server.js

### Notifications Not Appearing

1. Check Socket.io connection status
2. Verify notification badge is updating
3. Check browser console for errors
4. Test with `updateNotificationBadge()` in console

### Gemini API Errors

1. Verify API key is correct in .env
2. Check API quota at https://makersuite.google.com
3. Monitor rate limiting (15 RPM, 1500 RPD)
4. System will fallback to heuristic scoring automatically

### Database Issues

1. Ensure MongoDB is running
2. Check MONGODB_URI in .env
3. Verify Notification model is imported
4. Check server logs for errors

## 📊 Monitoring

### Check Socket.io Status

```javascript
// In browser console
console.log('Socket connected:', isConnected);
```

### Check Notification Count

```javascript
// Get unread count
fetch('/api/notifications/unread-count', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(r => r.json())
.then(d => console.log('Unread:', d.count));
```

### Monitor AI Validation

```javascript
// Server logs will show:
// "🤖 Processing 10 answers for idea using Gemini AI..."
// "✓ Gemini AI scored idea: 78%"
```

## 🎯 Testing Checklist

- [ ] User receives notification after validation
- [ ] Toast appears in top-right corner
- [ ] Notification badge updates correctly
- [ ] Clicking notification navigates to correct page
- [ ] Mark as read functionality works
- [ ] Notifications persist across page reloads
- [ ] Socket reconnects after disconnect
- [ ] AI scoring completes successfully
- [ ] Rate limiting prevents API abuse
- [ ] Fallback scoring works without API key

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in .env
2. Use strong JWT_SECRET
3. Configure proper CORS origins
4. Enable HTTPS for Socket.io
5. Set up MongoDB Atlas or similar
6. Monitor API usage at https://makersuite.google.com
7. Set up error logging (e.g., Sentry)
8. Configure load balancer for WebSocket support

## 📝 Migration Notes

### From Claude API to Gemini

The validation service has been completely replaced:

**Old:** `aiValidationService.js` (Claude API)
**New:** `geminiValidationService.js` (Gemini API)

Changes made:
- API endpoint changed to Gemini
- Request format updated for Gemini
- Response parsing adjusted
- Rate limiting implemented
- Batch processing added

No database changes required - scoring format remains the same.

## 🤝 Support

For issues or questions:
1. Check troubleshooting guide above
2. Review server logs for errors
3. Test with example code snippets
4. Check Gemini API status page

## 📄 License

MIT

---

**Version:** 2.0.0
**Last Updated:** January 2026
**Author:** Dolphin Team