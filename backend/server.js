const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
// build: 2026-06-03-cache-bust
const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { securePage } = require('./middleware/securePage');
const { initializeSocket } = require('./services/socketService');
const requestLogger = require('./middleware/requestLogger');
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

// Persistent token blacklist (time-bounded Map, auto-prunes expired entries)
const tokenBlacklist = require('./utils/tokenBlacklist');
app.locals.tokenBlacklist = tokenBlacklist;

// Wire up indexes after DB connects (idempotent — safe to run on every boot)
const ensureIndexes = require('./config/indexes');
mongoose.connection.once('connected', () => {
  ensureIndexes().catch(err => console.error('[Indexes] Failed:', err.message));
});

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

// 3. Apply Helmet with strict but practical CSP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      // Removed 'unsafe-eval' — it weakens XSS protection significantly.
      // If a third-party library requires eval, isolate it or replace it.
      scriptSrc:      [
        "'self'",
        "'unsafe-inline'",   // Required for Vite HMR in dev; consider nonce-based CSP in future
        'https://sdk.cashfree.com',       // Cashfree payment SDK
        'https://cdn.socket.io',
        'https://cdn.jsdelivr.net',
      ],
      imgSrc:         ["'self'", 'data:', 'https:'],
      fontSrc:        ["'self'", 'https:', 'data:'],
      connectSrc:     [
        "'self'",
        'https://api.dolphinorg.in',
        'wss://api.dolphinorg.in',
        'https://sdk.cashfree.com',
        'https://api.cashfree.com',
      ],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      frameAncestors: ["'none'"],
      // Allow Cashfree checkout iframe
      frameSrc:       ['https://sdk.cashfree.com', 'https://payments.cashfree.com'],
      workerSrc:      ["'self'", 'blob:'],
      childSrc:       ["'self'", 'blob:'],
      manifestSrc:    ["'self'"],
      mediaSrc:       ["'self'", 'https:'],
      'script-src-attr': ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Security middleware — single JSON parser with size limit
// Note: /api/verification/webhook uses raw body for signature verification
app.use((req, res, next) => {
  if (req.path === '/api/verification/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/api/verification/webhook') return next();
  express.urlencoded({ extended: true, limit: '2mb' })(req, res, next);
});
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again in a few minutes.' },
  handler: (req, res, next, options) => {
    // Add Retry-After so clients know exactly when to retry instead of hammering
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
    res.status(options.statusCode).json(options.message);
  },
  skip: (req) => req.path === '/health' || req.path === '/',
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

// Structured request timing logger (after auth so req.user is available)
app.use('/api/', requestLogger);

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
app.use('/api/opportunities', require('./routes/opportunities'));
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

// Health check — reports real DB state
app.get('/api/health', (req, res) => {
  const dbState  = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  const healthy  = dbState === 1;
  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'ok' : 'degraded',
    db:        dbStatus,
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    pid:       process.pid,
  });
});

// Readiness probe — used by Railway/PM2 to decide if a new deploy is safe to receive traffic.
// Returns 503 until the DB is connected and startup migrations have run.
let startupComplete = false;
setTimeout(() => { startupComplete = true; }, 8000); // generous grace period

app.get('/api/ready', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  if (dbReady && startupComplete) {
    return res.status(200).json({ status: 'ready' });
  }
  res.status(503).json({
    status: 'not ready',
    db:     dbReady ? 'connected' : 'connecting',
    startup: startupComplete ? 'done' : 'pending',
  });
});

// Global error handling middleware — never leak stack traces in production
app.use((err, req, res, next) => {
  // Log full error internally
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Validation failed', errors: messages });
  }
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `${field} already in use` });
  }
  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large. Profile pictures must be under 10MB. For post videos up to 500MB, use the post create button which uploads directly.' });
  }
  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request payload too large' });
  }

  // Generic server error — never expose internals in production
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : (err.message || 'Server error'),
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

// Startup migration: reset all non-payment verified badges, then reconcile from paid records
const User = require('./models/User');

const runMigrations = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => mongoose.connection.once('connected', resolve));
    }
    // Reset all legacy/founder/admin verified badges — payment-only going forward
    const reset = await User.updateMany(
      { $or: [{ isFounderVerified: true }, { isAdminVerified: true }, { verifiedSource: { $in: ['founder', 'admin'] } }] },
      { $set: { isVerified: false, isFounderVerified: false, isAdminVerified: false, verifiedSource: null, verifiedAt: null, verifiedUntil: null, activeVerificationPaymentId: null } }
    );
    if (reset.modifiedCount > 0) console.log(`[Migration] Reset ${reset.modifiedCount} legacy verified users`);

    // Reconcile from paid payment records
    const VerificationPayment = require('./models/VerificationPayment');
    const paidPayments = await VerificationPayment.find({ status: 'paid' }).sort({ paidAt: -1 });
    const seen = new Set();
    let activated = 0;
    for (const p of paidPayments) {
      const uid = p.userId?.toString();
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const verifiedUntil = p.verifiedUntil || new Date((p.paidAt || new Date()).getTime() + 30 * 24 * 60 * 60 * 1000);
      if (new Date(verifiedUntil) <= new Date()) continue;
      await User.findByIdAndUpdate(p.userId, { $set: { isVerified: true, verifiedSource: 'payment', verifiedAt: p.paidAt || new Date(), verifiedUntil, activeVerificationPaymentId: p._id } });
      activated++;
    }
    if (activated > 0) console.log(`[Migration] Reconciled ${activated} paid verified users`);
  } catch (e) {
    console.error('[Migration] Error:', e.message);
  }
};
setTimeout(runMigrations, 5000);

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
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
console.log("🔥SUCCESSFULLY");
module.exports = server;