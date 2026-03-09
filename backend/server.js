const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const { securePage } = require('./middleware/securePage');
const { initializeSocket } = require('./services/socketService');
const chatRoutes = require('./routes/chat');
const investorRoutes = require('./routes/investor'); 
dotenv.config();
const supportRoutes = require('./routes/support');
connectDB();

const app = express();
const server = http.createServer(app);

// Call the service function. It should return the 'io' instance.
const io = initializeSocket(server); 
// --- REFINED CORS CONFIGURATION ---
// We will log the origin to debug in Railway logs
const corsOptions = {
  origin: function (origin, callback) {
    // Log the origin to see what Railway sees
    console.log('Request Origin:', origin);

    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);

    // Check against your list OR any Vercel preview URL
    const allowedOrigins = ['https://dolphin-main.vercel.app'];
    const isVercelPreview = origin.endsWith('.vercel.app');
    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || isVercelPreview;

    if (isAllowed) {
      callback(null, true);
    } else {
      // Log why it failed but DON'T throw an error (throwing crashes the request)
      console.warn(`CORS blocked origin: ${origin}`);
      // Sending false allows the request to continue but strips CORS headers safely
      callback(null, false); 
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(corsOptions));

// Make io accessible to routes (CRITICAL)
// 2. Apply Helmet with Cross-Origin Policy
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["*"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'"],
      "script-src-attr": ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.set('socketio', io); 
app.locals.tokenBlacklist = new Set();
// Security middleware
app.use(express.json()); 

// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
app.use('/api/chat', chatRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/support', supportRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Public routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

// Protected HTML routes with role-based access
app.get('/dashboard.html', securePage(['founder']), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

app.get('/investor-dashboard.html', securePage(['investor']), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/investor-dashboard.html'));
});

app.get('/admin-dashboard.html', securePage(['admin', 'investor']), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin-dashboard.html'));
});

app.get('/provider-dashboard.html', securePage(['provider']), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/provider-dashboard.html'));
});

app.get('/marketplace.html', securePage(['founder', 'investor', 'provider']), (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/marketplace.html'));
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/founder', require('./routes/founder'));
app.use('/api/investor', require('./routes/investor'));
app.use('/api/provider', require('./routes/provider'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin/admin-notifications', require('./routes/admin-notifications'));


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketio: 'enabled'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Server error',
    reason: 'An unexpected error occurred',
    nextSteps: 'Try again later or contact support'
  });
});

// Cleanup old notifications daily
const Notification = require('./models/Notification');
setInterval(async () => {
  try {
    const result = await Notification.deleteOldNotifications(30);
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
    }
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }
}, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Real-time notifications enabled via Socket.io`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = server;