require('colors');
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // ── Connection pool ─────────────────────────────────────────────────────
      // Railway free tier has limited RAM. Default pool of 100 is wasteful.
      // 20 connections is enough for a single-instance Node app under normal load.
      // With PM2 cluster (4 workers × 20 = 80 total) — stay within Atlas free limits.
      maxPoolSize: 20,
      minPoolSize: 2,

      // ── Timeouts ────────────────────────────────────────────────────────────
      serverSelectionTimeoutMS: 8000,  // Give up trying to connect after 8s
      socketTimeoutMS:          45000, // Close idle sockets after 45s
      connectTimeoutMS:         10000, // Initial connection timeout

      // ── Heartbeat ───────────────────────────────────────────────────────────
      heartbeatFrequencyMS: 10000,     // Check server health every 10s

      // ── Compression (Atlas supports zlib) ───────────────────────────────────
      compressors: ['zlib'],
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);

    // Log connection pool events in development
    if (process.env.NODE_ENV !== 'production') {
      mongoose.connection.on('connected',    () => console.log('[DB] connected'));
      mongoose.connection.on('disconnected', () => console.warn('[DB] disconnected'));
      mongoose.connection.on('error',        (e) => console.error('[DB] error:', e.message));
    }

  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`.red.underline.bold);
    process.exit(1);
  }
};

module.exports = connectDB;
