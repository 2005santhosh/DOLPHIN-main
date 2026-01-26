const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const { securePage } = require('./middleware/securePage');

dotenv.config();
connectDB();

const app = express();

// Initialize token blacklist
app.locals.tokenBlacklist = new Set();

// Security middleware
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
      "script-src-attr": ["'self'", "'unsafe-inline'"],
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

// Public routes (no authentication required)
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

app.get('/admin-dashboard.html', securePage(['investor']), (req, res) => {
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
app.use('/api/founder', require('./routes/founder'));
app.use('/api/investor', require('./routes/investor'));
app.use('/api/provider', require('./routes/provider'));
app.use('/api/admin', require('./routes/admin'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Server error',
    reason: 'An unexpected error occurred',
    nextSteps: 'Try again later or contact support'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});