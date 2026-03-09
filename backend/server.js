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
const supportRoutes = require('./routes/support');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server); 

// --- CRITICAL FIX 1: HELMET FIRST ---
// Helmet must be applied before routes and other middleware 
// to ensure headers are set correctly.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["*"], // Allow all connections for API
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

// --- CRITICAL FIX 2: CLEAN CORS SETUP ---
// Use the 'cors' package only. Do not use manual app.use headers for CORS 
// as it creates duplicates or conflicts.
const corsOptions = {
  origin: [
    "https://dolphin-main.vercel.app"
    // Add "http://localhost:3000" or similar for local testing if needed
  ],
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true // Important for cookies/auth headers
};

app.use(cors(corsOptions));

// Make io accessible to routes
app.set('socketio', io); 
app.locals.tokenBlacklist = new Set();

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// --- ROUTES ---

// Test Route (for checking if server is alive)
app.post("/test-cors", (req, res) => {
  res.json({ message: "CORS working" });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', chatRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/resources', require('./routes/resources'));
app.use('/api/founder', require('./routes/founder'));
app.use('/api/provider', require('./routes/provider'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin/admin-notifications', require('./routes/admin-notifications'));

// HTML Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/register.html'));
});
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketio: 'enabled'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Server error',
    reason: 'An unexpected error occurred',
    nextSteps: 'Try again later or contact support'
  });
});

// Notification Cleanup
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

// --- CRITICAL FIX 3: LISTEN ON 0.0.0.0 ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
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