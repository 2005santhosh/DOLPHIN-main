const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser'); // 1. IMPORT COOKIE PARSER

const connectDB = require('./config/db');
const { securePage } = require('./middleware/securePage');
const { initializeSocket } = require('./services/socketService');
const chatRoutes = require('./routes/chat');
const investorRoutes = require('./routes/investor'); 
const supportRoutes = require('./routes/support');

dotenv.config();

// --- CRITICAL FIX: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥');
  console.error(err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥');
  console.error(err);
});

connectDB();
app.set('trust proxy', 1);
const app = express();
const server = http.createServer(app);

// --- CORS SETUP (Defined BEFORE Socket Initialization) --- samesite
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any Vercel preview or production URL
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow localhost for local development
    if (origin.startsWith('http://localhost')) {
       return callback(null, true);
    }

    // FIX: Allow your new custom domain (checks string presence)
    if (origin.includes('dolphinorg.in')) {
       return callback(null, true);
    }

    // Reject other origins
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true // IMPORTANT: Allow cookies/authorization headers
};

// Initialize Socket.io WITH the CORS options
const io = initializeSocket(server, corsOptions); 

// Apply CORS to Express
app.use(cors(corsOptions));
app.use(compression());

// 2. USE COOKIE PARSER (Enables reading HTTP-only cookies for security)
app.use(cookieParser());

app.post("/test-cors", (req, res) => {
  res.json({ message: "CORS working" });
});

// Make io accessible to routes (CRITICAL)
app.set('socketio', io); 
app.locals.tokenBlacklist = new Set();

// 3. Apply Helmet with Cross-Origin Policy
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["*"], // Ensure this is open for Socket connections
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

// Security middleware
app.use(express.json()); 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// --- API ROUTES ---
// Consolidated API routes here
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

// --- PUBLIC HTML ROUTES ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

// --- PROTECTED HTML ROUTES ---
// SECURITY FIX: These must be defined BEFORE express.static
// This forces the securePage middleware to run before the file is served
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

// --- STATIC FILES ---
// SECURITY FIX: Moved to BOTTOM. 
// If a user requests /dashboard.html, it hits the route above first.
// If they request /images/logo.png, it hits this static handler.
app.use(express.static(path.join(__dirname, '../frontend')));

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

// --- CRITICAL FIX: LISTEN ON 0.0.0.0 ---
const PORT = process.env.PORT || 8080;
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