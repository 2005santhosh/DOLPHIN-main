const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const { protect } = require('./middleware/authMiddleware');

dotenv.config();
connectDB();

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "https:", "http:", "ws:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'"],
      "script-src-attr": ["'self'", "'unsafe-inline'"], // Allow inline event handlers
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper: Check if request is likely from browser (wants HTML)
function isBrowserRequest(req) {
  const accept = req.headers.accept || '';
  return accept.includes('text/html') || accept === '*/*';
}

// Custom page protection with redirect to home (index.html) for browsers
const securePage = (file, allowedRole = null) => (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // No token → redirect to home for browser requests
  if (!token) {
    if (isBrowserRequest(req)) {
      return res.redirect('/');
    }
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Role check (if restricted)
    if (allowedRole && req.user.role !== allowedRole) {
      if (isBrowserRequest(req)) {
        return res.redirect('/');
      }
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // All good → serve the HTML file
    res.sendFile(path.join(__dirname, `../frontend/${file}`));
  } catch (err) {
    // Invalid/expired token → redirect to home for browsers
    if (isBrowserRequest(req)) {
      return res.redirect('/');
    }
    return res.status(401).json({ message: 'Token is not valid or has expired' });
  }
};

// ────────────────────────────────────────────────
// Public pages (no auth required)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/register.html'));
});

// ────────────────────────────────────────────────
// Protected HTML pages → redirect to / if no valid auth
app.get('/dashboard', securePage('dashboard.html', 'founder'));
app.get('/provider-dashboard', securePage('provider-dashboard.html', 'provider'));
app.get('/investor-dashboard', securePage('investor-dashboard.html', 'investor'));
app.get('/marketplace', securePage('marketplace.html')); // no role restriction
app.get('/admin-dashboard', securePage('admin-dashboard.html', 'investor'));

// ────────────────────────────────────────────────
// API Routes (keep JSON errors – APIs should return JSON)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/startups', require('./routes/startup'));
app.use('/api/providers', require('./routes/provider'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));

// Global error handler (for unexpected crashes)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (isBrowserRequest(req)) {
    res.redirect('/');
  } else {
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});