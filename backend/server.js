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
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const { securePage } = require('./middleware/securePage');
const { initializeSocket } = require('./services/socketService');
const chatRoutes = require('./routes/chat');
const investorRoutes = require('./routes/investor'); 
const supportRoutes = require('./routes/support');
// Add these lines near your other routes
const postRoutes = require('./routes/posts');
const connectionRoutes = require('./routes/connections');
dotenv.config();
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

// Startup diagnostics — log key env var presence (never log values)
console.log('[Config] JWT_SECRET:', process.env.JWT_SECRET ? '✓ set' : '✗ MISSING');
console.log('[Config] BREVO_API_KEY:', process.env.BREVO_API_KEY?.trim() ? '✓ set' : '✗ MISSING');
console.log('[Config] GEMINI_API_KEY:', process.env.GEMINI_API_KEY?.trim() ? '✓ set' : '✗ MISSING');
console.log('[Config] MONGO_URI:', process.env.MONGO_URI ? '✓ set' : '✗ MISSING');
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

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// --- CORS SETUP (Defined BEFORE Socket Initialization) --- samesite
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow server-to-server/curl

    // Allow dolphinorg.in subdomains, localhost, and Vercel deployments
    const allowedRegex = /^https:\/\/([a-zA-Z0-9-]+\.)?dolphinorg\.in$/;
    const vercelRegex  = /^https:\/\/[a-zA-Z0-9-]+(\.vercel\.app)$/;

    if (
      allowedRegex.test(origin) ||
      vercelRegex.test(origin) ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return callback(null, true);
    }

    return callback(new Error('CORS blocked'), false);
  },
  credentials: true
};

// Initialize Socket.io WITH the CORS options
const io = initializeSocket(server, corsOptions); 
app.use(mongoSanitize({ replaceWith: '_' }));
// Apply CORS to Express
app.use(cors(corsOptions));
app.use(compression());

// 2. USE COOKIE PARSER (Enables reading HTTP-only cookies for security)
app.use(cookieParser());
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
      connectSrc: ["'self'", "https://api.dolphinorg.in", "wss://api.dolphinorg.in", "https://cdn.socket.io"], // Ensure this is open for Socket connections
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

// Security middleware — single JSON parser with size limit
// Note: /api/verification/webhook uses raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/verification/webhook') return next();
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/api/verification/webhook') return next();
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                  // 500 requests per 15 min per IP — enough for normal usage
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again in a few minutes.' },
  skip: (req) => {
    // Skip rate limiting for static assets and health checks
    return req.path === '/health' || req.path === '/';
  },
});
app.use('/api/', limiter);

// Add security headers for all API responses
app.use('/api/', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});

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
app.use('/api/posts', postRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/gamification', require('./routes/gamification'));
app.use('/api/verification', require('./routes/verification'));
// --- PUBLIC HTML ROUTES ---
// Only serve old HTML frontend if the files actually exist (not on Railway when using React frontend)
const frontendDir = path.join(__dirname, '../frontend');
const fs = require('fs');
const hasFrontend = fs.existsSync(path.join(frontendDir, 'index.html'));

if (hasFrontend) {
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
  app.get('/login.html', (req, res) => {
    res.sendFile(path.join(frontendDir, 'login.html'));
  });
  app.get('/register.html', (req, res) => {
    res.sendFile(path.join(frontendDir, 'register.html'));
  });
  app.get('/dashboard.html', securePage(['founder']), (req, res) => {
    res.sendFile(path.join(frontendDir, 'dashboard.html'));
  });
  app.get('/investor-dashboard.html', securePage(['investor']), (req, res) => {
    res.sendFile(path.join(frontendDir, 'investor-dashboard.html'));
  });
  app.get('/admin-dashboard.html', securePage(['admin', 'investor']), (req, res) => {
    res.sendFile(path.join(frontendDir, 'admin-dashboard.html'));
  });
  app.get('/provider-dashboard.html', securePage(['provider']), (req, res) => {
    res.sendFile(path.join(frontendDir, 'provider-dashboard.html'));
  });
  app.get('/marketplace.html', securePage(['founder', 'investor', 'provider']), (req, res) => {
    res.sendFile(path.join(frontendDir, 'marketplace.html'));
  });
  app.use(express.static(frontendDir));
} else {
  // React frontend is on Vercel — backend is API-only
  app.get('/', (req, res) => {
    res.json({ status: 'Dolphin API', version: '2.0', frontend: 'https://www.dolphinorg.in' });
  });
}

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

// Auto-run founder badge migration after DB connects (idempotent — safe to run every time)
const User = require('./models/User');
const mongoose = require('mongoose');

const runFounderBadgeMigration = async () => {
  try {
    // Wait for DB to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    }
    const result = await User.updateMany(
      { isVerified: true, isFounderVerified: { $ne: true } },
      { $set: { isFounderVerified: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Migration] ✅ Granted lifetime founder badge to ${result.modifiedCount} existing verified users`);
    }
  } catch (e) {
    console.error('[Migration] Founder badge migration error:', e.message);
  }
};

// Run after a short delay to ensure DB connection is established
setTimeout(runFounderBadgeMigration, 5000);

// Daily streak loss processing — runs at 2am UTC
const { processStreakLosses } = require('./services/gamificationService');
const { processVerificationExpiry } = require('./routes/verification');
const scheduleStreakCron = () => {
  const now = new Date();
  const next2am = new Date();
  next2am.setUTCHours(2, 0, 0, 0);
  if (next2am <= now) next2am.setUTCDate(next2am.getUTCDate() + 1);
  const msUntil2am = next2am - now;

  setTimeout(async () => {
    try {
      const count = await processStreakLosses();
      console.log(`[Gamification] Daily streak cron: reset ${count} streaks`);
    } catch (e) {
      console.error('[Gamification] Streak cron error:', e);
    }
    // Also run verification expiry check
    try {
      const r = await processVerificationExpiry();
      console.log(`[Verification] Daily cron: expired=${r.expired}, reminded=${r.reminded}`);
    } catch (e) {
      console.error('[Verification] Expiry cron error:', e);
    }
    // Re-schedule for next day
    setInterval(async () => {
      try {
        const count = await processStreakLosses();
        console.log(`[Gamification] Daily streak cron: reset ${count} streaks`);
      } catch (e) {
        console.error('[Gamification] Streak cron error:', e);
      }
      try {
        const r = await processVerificationExpiry();
        console.log(`[Verification] Daily cron: expired=${r.expired}, reminded=${r.reminded}`);
      } catch (e) {
        console.error('[Verification] Expiry cron error:', e);
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntil2am);

  console.log(`[Gamification] Streak cron scheduled in ${Math.round(msUntil2am / 60000)} minutes`);
};
scheduleStreakCron();

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
console.log("🔥SUCCESSFULLY");
module.exports = server;