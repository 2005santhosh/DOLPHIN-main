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

// --- MAIN STARTUP FUNCTION ---
const startServer = async () => {
  try {
    // 1. Connect to Database
    console.log("Attempting to connect to Database...");
    await connectDB();
    console.log("Database connection established.");

    const app = express();
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = initializeSocket(server); 

    // --- SECURITY & MIDDLEWARE ---
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

    // --- CORS SETUP ---
    const corsOptions = {
      origin: [
        "https://dolphin-main.vercel.app"
      ],
      methods: ["GET","POST","PUT","DELETE","OPTIONS"],
      allowedHeaders: ["Content-Type","Authorization"],
      credentials: true
    };
    app.use(cors(corsOptions));

    // Make io accessible
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

    // --- CRITICAL: HEALTH CHECK ENDPOINT ---
    // This must be defined BEFORE express.static to ensure it replies instantly
    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Static files
    // Note: Ensure your build process copies the 'frontend' folder correctly
    app.use(express.static(path.join(__dirname, '../frontend')));

    // --- ROUTES ---
    app.post("/test-cors", (req, res) => {
      res.json({ message: "CORS working" });
    });

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

    // HTML Page Routes (Fallback for SPA or specific pages)
    app.get('/', (req, res) => {
      // Simple 200 response for health checks if hitting root
      res.send("Backend is Running");
    });
    
    // Keep your specific HTML routes if needed
    app.get('/login.html', (req, res) => { res.sendFile(path.join(__dirname, '../frontend/login.html')); });
    app.get('/register.html', (req, res) => { res.sendFile(path.join(__dirname, '../frontend/register.html')); });
    app.get('/dashboard.html', securePage(['founder']), (req, res) => { res.sendFile(path.join(__dirname, '../frontend/dashboard.html')); });
    app.get('/investor-dashboard.html', securePage(['investor']), (req, res) => { res.sendFile(path.join(__dirname, '../frontend/investor-dashboard.html')); });
    app.get('/admin-dashboard.html', securePage(['admin', 'investor']), (req, res) => { res.sendFile(path.join(__dirname, '../frontend/admin-dashboard.html')); });
    app.get('/provider-dashboard.html', securePage(['provider']), (req, res) => { res.sendFile(path.join(__dirname, '../frontend/provider-dashboard.html')); });
    app.get('/marketplace.html', securePage(['founder', 'investor', 'provider']), (req, res) => { res.sendFile(path.join(__dirname, '../frontend/marketplace.html')); });

    // Error handling
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ message: 'Server error' });
    });

    // --- START SERVER ---
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on port ${PORT}`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down...');
      server.close(() => {
        const mongoose = require('mongoose');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    });

  } catch (err) {
    console.error("!!!!!!!!!! FATAL STARTUP ERROR !!!!!!!!!!");
    console.error(err);
    process.exit(1);
  }
};

startServer();