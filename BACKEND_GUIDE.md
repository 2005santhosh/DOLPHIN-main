# 🚀 Backend Guide - How It Runs

## Quick Start

### Starting the Backend

```bash
# Navigate to backend folder
cd backend

# Install dependencies (first time only)
npm install

# Start the server
npm start
```

**Expected Output:**
```
MongoDB Connected: dolphin-database.lkfeyv9.mongodb.net
Server running on port 8080
Socket.IO initialized
```

---

## 📁 Backend Structure

```
backend/
├── server.js              # Main entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (secrets)
├── config/
│   ├── db.js             # MongoDB connection
│   └── cloudinary.js     # Image upload config
├── models/               # Database schemas
│   ├── User.js
│   ├── Startup.js
│   ├── Post.js
│   ├── Message.js
│   └── ...
├── routes/               # API endpoints
│   ├── auth.js          # /api/auth/*
│   ├── founder.js       # /api/founder/*
│   ├── investor.js      # /api/investor/*
│   ├── provider.js      # /api/provider/*
│   ├── posts.js         # /api/posts/*
│   └── ...
├── middleware/          # Request processing
│   ├── authMiddleware.js
│   ├── roleAccess.js
│   └── securePage.js
├── services/            # Business logic
│   ├── socketService.js
│   ├── notificationService.js
│   └── ...
└── utils/               # Helper functions
    ├── sendEmail.js
    └── validation.js
```

---

## 🔧 How It Works

### 1. Server Startup Flow

```
1. Load environment variables (.env)
   ↓
2. Connect to MongoDB database
   ↓
3. Create Express app
   ↓
4. Setup middleware (CORS, security, etc.)
   ↓
5. Mount API routes
   ↓
6. Initialize Socket.IO (real-time chat)
   ↓
7. Start listening on port 8080
```

### 2. Request Flow

```
Client Request (e.g., POST /api/auth/login)
        ↓
Express receives request
        ↓
CORS middleware (check origin)
        ↓
Body parser (parse JSON)
        ↓
Route handler (routes/auth.js)
        ↓
Authentication middleware (if protected)
        ↓
Controller function (controller/auth.js)
        ↓
Database query (MongoDB)
        ↓
Response sent back to client
```

### 3. Database Connection

```javascript
// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
```

**Connection String**: `mongodb+srv://dolphin_users:password@dolphin-database.lkfeyv9.mongodb.net/`

---

## 🌐 API Endpoints

### Base URL
- **Development**: `http://localhost:8080/api`
- **Production**: `https://api.dolphinorg.in/api`

### Authentication Routes (`/api/auth`)
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login user
GET    /api/auth/profile           # Get current user
PUT    /api/auth/profile           # Update profile
POST   /api/auth/forgot-password   # Request password reset
POST   /api/auth/reset-password    # Reset password
POST   /api/auth/logout            # Logout user
```

### Founder Routes (`/api/founder`)
```
POST   /api/founder                # Create startup
GET    /api/founder/my-startup     # Get my startup
PUT    /api/founder/my-startup     # Update startup
PUT    /api/founder/milestones     # Update milestone
GET    /api/founder/investors      # Get investors list
GET    /api/founder/providers      # Get providers list
POST   /api/founder/send-request   # Send connection request
GET    /api/founder/analytics      # Get analytics data
```

### Posts Routes (`/api/posts`)
```
GET    /api/posts/feed             # Get feed posts
POST   /api/posts                  # Create post
POST   /api/posts/:id/like         # Like/unlike post
POST   /api/posts/:id/view         # Track view
DELETE /api/posts/:id              # Delete post
```

### Chat Routes (`/api/chat`)
```
GET    /api/chat/conversations     # Get all conversations
GET    /api/chat/:partnerId        # Get messages with partner
POST   /api/chat/send              # Send message
```

### Notifications Routes (`/api/notifications`)
```
GET    /api/notifications          # Get notifications
PUT    /api/notifications/read-all # Mark all as read
DELETE /api/notifications/clear    # Clear all
```

---

## 🔐 Environment Variables

### Required Variables (`.env` file)

```env
# Server
PORT=8080

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Authentication
JWT_SECRET=your_secret_key_here

# Cloudinary (Image Upload)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_smtp_password

# AI Validation
GEMINI_API_KEY=your_gemini_api_key

# Frontend URL (for CORS)
FRONTEND_URL=https://dolphin-main.vercel.app
```

---

## 🔒 Security Features

### 1. CORS (Cross-Origin Resource Sharing)
```javascript
// Only allows requests from dolphinorg.in domains
const corsOptions = {
  origin: /^https:\/\/([a-zA-Z0-9-]+\.)?dolphinorg\.in$/,
  credentials: true
};
```

### 2. Helmet (Security Headers)
```javascript
// Sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      // ... more security policies
    }
  }
}));
```

### 3. Rate Limiting
```javascript
// Limits requests to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### 4. JWT Authentication
```javascript
// Protects routes with JWT tokens
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  next();
};
```

---

## 💾 Database Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (founder/investor/provider/admin),
  state: String (pending/active/blocked),
  stage: String (idea/problem/solution/market/business),
  rewardPoints: Number,
  profilePicture: String,
  createdAt: Date
}
```

### Startup Model
```javascript
{
  founderId: ObjectId (ref: User),
  name: String,
  description: String,
  industry: String,
  stage: String,
  validationScore: Number,
  validationStages: {
    idea: { isValidated: Boolean, score: Number },
    problem: { isValidated: Boolean, score: Number },
    // ... more stages
  },
  milestones: Array,
  createdAt: Date
}
```

### Post Model
```javascript
{
  userId: ObjectId (ref: User),
  content: String,
  media: [String], // Cloudinary URLs
  likes: [ObjectId], // User IDs who liked
  views: Number,
  createdAt: Date
}
```

---

## 🔄 Real-Time Features (Socket.IO)

### Chat System
```javascript
// Server-side (services/socketService.js)
io.on('connection', (socket) => {
  // User joins their room
  socket.on('join', (userId) => {
    socket.join(userId);
  });
  
  // Send message
  socket.on('sendMessage', async (data) => {
    // Save to database
    const message = await Message.create(data);
    
    // Emit to receiver
    io.to(data.receiverId).emit('newMessage', message);
  });
});
```

### Client-side Connection
```javascript
// Frontend connects to Socket.IO
const socket = io('http://localhost:8080');

socket.on('connect', () => {
  socket.emit('join', userId);
});

socket.on('newMessage', (message) => {
  // Update chat UI
});
```

---

## 🚀 Running the Backend

### Development Mode

```bash
cd backend
npm start
```

**What happens:**
1. Loads `.env` variables
2. Connects to MongoDB
3. Starts Express server on port 8080
4. Initializes Socket.IO for real-time chat
5. Listens for incoming requests

### Production Mode

**Deployed on**: Render.com or similar service

**Environment Variables**: Set in hosting platform dashboard

**URL**: `https://api.dolphinorg.in`

---

## 🧪 Testing the Backend

### Using Browser
```
http://localhost:8080/api/auth/profile
```

### Using cURL
```bash
# Test health endpoint
curl http://localhost:8080/api/health

# Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Using Postman
1. Create new request
2. Set method to POST
3. URL: `http://localhost:8080/api/auth/login`
4. Body: JSON
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

---

## 📊 Monitoring

### Server Logs
```bash
# View logs in terminal
cd backend
npm start

# You'll see:
# - MongoDB connection status
# - Incoming requests
# - Errors (if any)
# - Socket.IO connections
```

### Database Monitoring
```bash
# Connect to MongoDB
mongo "mongodb+srv://dolphin_users:password@dolphin-database.lkfeyv9.mongodb.net/"

# List databases
show dbs

# Use database
use dolphin

# List collections
show collections

# Query users
db.users.find()
```

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to MongoDB"

**Solution**:
1. Check internet connection
2. Verify `MONGO_URI` in `.env`
3. Check MongoDB Atlas whitelist (allow all IPs: 0.0.0.0/0)
4. Verify database user credentials

### Issue: "Port 8080 already in use"

**Solution**:
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Or change port in .env
PORT=8081
```

### Issue: "JWT_SECRET not defined"

**Solution**:
1. Create `.env` file in backend folder
2. Add: `JWT_SECRET=your_secret_key_here`
3. Restart server

### Issue: "CORS error"

**Solution**:
1. Check frontend URL is allowed in CORS config
2. For development, add `http://localhost:5173` to allowed origins
3. Restart backend server

---

## 🔄 Backend + Frontend Together

### Full Stack Setup

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Running on http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd frontend-react
npm run dev
# Running on http://localhost:5173
```

### How They Connect

```
Frontend (localhost:5173)
        ↓
API Request: POST /api/auth/login
        ↓
Backend (localhost:8080)
        ↓
MongoDB Database
        ↓
Response: { user, token }
        ↓
Frontend stores token
        ↓
Future requests include token in headers
```

---

## 📝 Summary

### To Run Backend:
```bash
cd backend
npm install  # First time only
npm start    # Every time
```

### Backend Provides:
- ✅ REST API endpoints
- ✅ Authentication (JWT)
- ✅ Database operations (MongoDB)
- ✅ File uploads (Cloudinary)
- ✅ Real-time chat (Socket.IO)
- ✅ Email notifications (SMTP)
- ✅ AI validation (Gemini API)

### Backend Runs On:
- **Development**: `http://localhost:8080`
- **Production**: `https://api.dolphinorg.in`

### Frontend Connects To:
- API URL configured in `frontend-react/.env`
- Default: `VITE_API_URL=https://api.dolphinorg.in/api`

**That's it! The backend is the brain of the application, handling all data, authentication, and business logic.** 🚀
