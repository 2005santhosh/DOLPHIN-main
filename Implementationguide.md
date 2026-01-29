# 🐬 Dolphin Platform - Real-time Notifications & Free AI Implementation Guide

## 📦 What You're Getting

This package includes:

### ✅ Real-time Notification System
- WebSocket-based instant notifications (Socket.io)
- Toast notifications with priority levels
- Notification center with history
- Badge counters
- Multi-device synchronization

### 🤖 Free AI Validation System  
- Google Gemini API integration (100% FREE)
- Automatic answer scoring
- Detailed feedback generation
- Fallback to heuristic scoring
- Rate limiting to respect API quotas

## 📁 Files Included

### Backend Files (Place in `backend/` directory)

**Services:**
- `socketService.js` - Socket.io server setup and management
- `notificationService.js` - Notification creation and delivery
- `geminiValidationService.js` - AI validation using Gemini API

**Models:**
- `Notification.js` - MongoDB notification schema

**Routes:**
- `notificationRoutes.js` - Notification API endpoints
- `founderRoutes.js` - Updated founder routes with notifications

**Configuration:**
- `server.js` - Updated server with Socket.io
- `package.json` - Updated dependencies
- `.env.example` - Environment variables template

### Frontend Files (Place in `frontend/` directory)

**JavaScript:**
- `socket-client.js` - Place in `frontend/js/`
  - Socket.io client connection
  - Real-time notification handling
  - Toast notification display
  - Badge counter updates

**CSS:**
- `notifications.css` - Place in `frontend/css/`
  - Toast notification styles
  - Notification list styles
  - Badge and indicator styles
  - Responsive design

### Documentation & Tools

- `README_NOTIFICATIONS.md` - Complete documentation
- `QUICK_START.md` - 5-minute setup guide
- `install.sh` - Automated installation script
- `testNotifications.js` - Test suite for verification

## 🚀 Installation Steps

### Step 1: Install Dependencies

```bash
cd backend
npm install socket.io
```

### Step 2: Get FREE Gemini API Key

1. Visit: **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click "Create API Key" button
4. Copy the generated API key

**Free Tier Benefits:**
- ✅ 15 requests per minute
- ✅ 1,500 requests per day
- ✅ No credit card required
- ✅ No expiration date
- ✅ Enough for ~150 validations/day

### Step 3: Copy Backend Files

Replace/add these files in your `backend/` directory:

```
backend/
├── services/
│   ├── socketService.js (NEW)
│   ├── notificationService.js (NEW)
│   └── geminiValidationService.js (NEW - replaces aiValidationService.js)
├── models/
│   └── Notification.js (NEW)
├── routes/
│   ├── notifications.js (NEW)
│   └── founder.js (REPLACE EXISTING)
├── server.js (REPLACE EXISTING)
└── package.json (UPDATE)
```

### Step 4: Copy Frontend Files

Add these files to your `frontend/` directory:

```
frontend/
├── js/
│   └── socket-client.js (NEW)
└── css/
    └── notifications.css (NEW)
```

### Step 5: Configure Environment

Create `backend/.env` from the template:

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your-actual-api-key-here
MONGODB_URI=mongodb://localhost:27017/dolphin
JWT_SECRET=your-secret-key
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Step 6: Update HTML Files

Add these lines to ALL your HTML dashboard files **BEFORE** the closing `</body>` tag:

**Example for `founderDashboard.html`:**

```html
  <!-- Socket.io Client Library -->
  <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
  
  <!-- Notification Styles -->
  <link rel="stylesheet" href="./css/notifications.css">
  
  <!-- Socket Client & Notification Handler -->
  <script src="./js/socket-client.js"></script>
  
</body>
</html>
```

Apply to these files:
- `founderDashboard.html`
- `adminDashboard.html`
- `investorDashboard.html`
- `providerDashboard.html`
- Any other dashboard pages

### Step 7: Start the Server

```bash
cd backend
npm run dev
```

You should see:
```
✓ MongoDB connected
✓ Server running on port 5000
✓ Real-time notifications enabled via Socket.io
```

## ✅ Verify Installation

### 1. Check Server Logs

Look for these messages when server starts:
```
✓ MongoDB connected
✓ Server running on port 5000
✓ Real-time notifications enabled via Socket.io
```

### 2. Test Socket Connection

1. Open your browser and login
2. Open Developer Tools (F12)
3. Go to Console tab
4. Look for: `✓ Socket.io connected`

### 3. Test Notifications

1. Complete a validation stage
2. You should see:
   - ✅ Toast notification in top-right corner
   - ✅ Notification badge counter update
   - ✅ Console log: `📬 Received notification: ...`

### 4. Test AI Validation

Run the test script:

```bash
cd backend
node test/testNotifications.js
```

Expected output:
```
✓ Connected to MongoDB
✓ Notification model test passed
✓ AI Score: 85%
✓ All tests passed
```

## 🔧 Configuration Options

### Notification Types

Edit `notificationService.js` to customize notification types:

```javascript
const notification = await createNotification({
  userId: user._id,
  type: 'CUSTOM_TYPE',
  title: 'Custom Notification',
  message: 'Your custom message here',
  priority: 'high', // low, medium, high, urgent
  actionUrl: '/custom-page',
  actionText: 'Take Action'
});
```

### AI Validation Settings

In `geminiValidationService.js`, adjust rate limiting:

```javascript
const BATCH_SIZE = 3; // Questions per batch
const BATCH_DELAY = 15000; // Milliseconds between batches
```

### Notification Sound

Users can enable/disable notification sounds:

```javascript
localStorage.setItem('notificationSound', 'true'); // or 'false'
```

## 📊 API Endpoints

### Get Notifications
```http
GET /api/notifications
Authorization: Bearer <token>
Query: ?limit=50&skip=0&unreadOnly=false
```

### Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

### Mark as Read
```http
PUT /api/notifications/:notificationId/read
Authorization: Bearer <token>
```

### Mark All as Read
```http
PUT /api/notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification
```http
DELETE /api/notifications/:notificationId
Authorization: Bearer <token>
```

## 🎨 Customization

### Change Toast Position

Edit `notifications.css`:

```css
.notification-toast-container {
  top: 80px;     /* Change vertical position */
  right: 20px;   /* Change to 'left: 20px;' for left side */
}
```

### Change Toast Duration

Edit `socket-client.js`:

```javascript
setTimeout(() => {
  toast.classList.add('notification-toast-fade-out');
  setTimeout(() => toast.remove(), 300);
}, 5000); // Change 5000 to desired milliseconds
```

### Custom Notification Icons

Edit `socket-client.js` in the `getNotificationIcon()` function:

```javascript
function getNotificationIcon(type) {
  const icons = {
    'YOUR_CUSTOM_TYPE': '🎯',
    'ANOTHER_TYPE': '🚀',
    // ... add more
  };
  return icons[type] || '🔔';
}
```

## 🐛 Troubleshooting

### Problem: Socket.io not connecting

**Check:**
1. Is server running? `npm run dev`
2. Is JWT token present? `localStorage.getItem('token')`
3. Check browser console for errors
4. Verify Socket.io CDN loaded: `typeof io !== 'undefined'`

**Solution:**
```javascript
// Test in browser console
console.log('Token:', localStorage.getItem('token'));
console.log('Socket.io loaded:', typeof io !== 'undefined');
```

### Problem: Notifications not appearing

**Check:**
1. Socket connection status
2. Notification badge updating
3. Browser console for errors

**Solution:**
```javascript
// Test in browser console
updateNotificationBadge();
```

### Problem: Gemini API errors

**Check:**
1. API key is correct in `.env`
2. API quota at https://makersuite.google.com
3. Rate limiting (15 RPM, 1500 RPD)

**Solution:**
- System automatically falls back to heuristic scoring
- Check server logs for error messages
- Verify API key format

### Problem: Database errors

**Check:**
1. MongoDB is running: `mongod`
2. Connection string in `.env`
3. Notification model imported

**Solution:**
```bash
# Start MongoDB
mongod --dbpath /path/to/data

# Check connection
mongosh
> show dbs
```

## 📈 Performance Tips

### 1. Optimize Database Queries

Notification model already has indexes:
```javascript
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
```

### 2. Clean Old Notifications

Auto-cleanup runs daily. Adjust in `server.js`:

```javascript
setInterval(async () => {
  await Notification.deleteOldNotifications(30); // Days
}, 24 * 60 * 60 * 1000);
```

### 3. Rate Limit Socket Connections

Add in `socketService.js`:

```javascript
io.use((socket, next) => {
  // Add rate limiting logic
  next();
});
```

### 4. Compress Socket Data

Already enabled in Socket.io config:

```javascript
const io = socketIO(server, {
  compression: true
});
```

## 🔒 Security Considerations

### 1. JWT Authentication
- Socket connections require valid JWT
- Tokens are verified on connection

### 2. User Isolation
- Users only receive their own notifications
- Room-based isolation

### 3. Input Validation
- All notification data is validated
- XSS protection enabled

### 4. Rate Limiting
- AI API calls are rate-limited
- Socket connections are monitored

## 🚀 Production Deployment

### 1. Environment Variables

Set production values:
```env
NODE_ENV=production
JWT_SECRET=<strong-random-key>
FRONTEND_URL=https://your-domain.com
MONGODB_URI=<production-mongodb-url>
```

### 2. HTTPS Configuration

Socket.io requires HTTPS in production:

```javascript
const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);
```

### 3. Load Balancer Setup

Configure sticky sessions for WebSockets:

**Nginx:**
```nginx
upstream backend {
  ip_hash;
  server backend1:5000;
  server backend2:5000;
}
```

### 4. Monitoring

Add error logging:

```javascript
socket.on('error', (error) => {
  // Log to Sentry, LogRocket, etc.
  console.error('Socket error:', error);
});
```

## 📝 Migration Checklist

- [ ] Install Socket.io dependency
- [ ] Get Gemini API key
- [ ] Copy all backend files
- [ ] Copy all frontend files
- [ ] Configure .env file
- [ ] Update HTML files
- [ ] Start server
- [ ] Test socket connection
- [ ] Test notifications
- [ ] Test AI validation
- [ ] Run test suite
- [ ] Deploy to production

## 💡 Usage Examples

### Create Custom Notification

```javascript
const { createNotification } = require('./services/notificationService');

await createNotification({
  userId: req.user.id,
  type: 'CUSTOM',
  title: 'New Feature Available',
  message: 'Check out our new analytics dashboard!',
  priority: 'high',
  actionUrl: '/analytics',
  actionText: 'View Dashboard'
});
```

### Subscribe to Startup Updates

```javascript
// In frontend JavaScript
const startupId = 'startup-id-here';
subscribeToStartup(startupId);
```

### Manual Notification Check

```javascript
// Get latest notifications
async function fetchNotifications() {
  const response = await fetch('/api/notifications?limit=10', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  const data = await response.json();
  console.log('Notifications:', data.notifications);
}
```

## 🎓 Best Practices

### 1. Notification Frequency
- Don't spam users with notifications
- Batch similar notifications
- Use appropriate priority levels

### 2. Error Handling
- Always wrap Socket calls in try-catch
- Provide fallback UI if socket disconnects
- Show connection status to users

### 3. User Preferences
- Allow users to customize notification types
- Provide mute/unmute options
- Save preferences in localStorage

### 4. Testing
- Test across different browsers
- Test with slow network connections
- Test socket reconnection logic

## 📞 Support

If you encounter issues:

1. **Check Documentation:**
   - README_NOTIFICATIONS.md
   - QUICK_START.md

2. **Run Tests:**
   ```bash
   node test/testNotifications.js
   ```

3. **Check Logs:**
   - Server console output
   - Browser developer console
   - MongoDB logs

4. **Common Solutions:**
   - Clear browser cache
   - Restart server
   - Check MongoDB connection
   - Verify API key

## 📚 Additional Resources

- **Socket.io Docs:** https://socket.io/docs/
- **Gemini API Docs:** https://ai.google.dev/docs
- **MongoDB Docs:** https://docs.mongodb.com/
- **Express.js Docs:** https://expressjs.com/

---

## 🎉 Success Checklist

You're ready to go when you can check all these boxes:

- ✅ Server starts without errors
- ✅ Socket.io connects successfully
- ✅ Toast notifications appear
- ✅ Badge counter updates
- ✅ AI validation scores answers
- ✅ Notifications persist in database
- ✅ Mark as read functionality works
- ✅ Test suite passes

**Congratulations! Your real-time notification system is live! 🎊**

---

**Version:** 2.0.0  
**Last Updated:** January 2026  
**License:** MIT