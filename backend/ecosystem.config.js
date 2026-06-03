/**
 * PM2 Ecosystem Config — production process management.
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * On Railway/Render: set start command to:
 *   npx pm2-runtime ecosystem.config.js --env production
 *
 * Why cluster mode:
 *   Node.js is single-threaded. cluster mode spawns one worker per CPU core,
 *   distributing incoming connections across all cores. On a 2-core Railway
 *   instance this doubles throughput and halves per-core load.
 */
module.exports = {
  apps: [
    {
      name: 'dolphin-api',
      script: 'server.js',

      // ── Concurrency ─────────────────────────────────────────────────────────
      // 'max' = one worker per CPU core (detected at runtime).
      // Use instances: 2 if you want a fixed count.
      instances: 'max',
      exec_mode: 'cluster',

      // ── Auto-restart on crash ────────────────────────────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',            // Process must stay up 10s to count as "started"
      restart_delay: 4000,          // Wait 4s between restarts to avoid rapid loops

      // ── Memory guard ─────────────────────────────────────────────────────────
      // Restart worker if it exceeds 512MB — prevents slow memory leaks from
      // degrading performance without full outage
      max_memory_restart: '512M',

      // ── Graceful shutdown ────────────────────────────────────────────────────
      // Give in-flight requests up to 10s to complete before killing the process
      kill_timeout: 10000,
      listen_timeout: 8000,         // Wait up to 8s for 'ready' signal from worker

      // ── Logging ──────────────────────────────────────────────────────────────
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,             // Merge logs from all workers into one file

      // ── Environment variables ────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 8080,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
        // All other secrets come from Railway/Render environment variables
        // Never put JWT_SECRET or DB credentials in this file
      },

      // ── Watch (dev only) ─────────────────────────────────────────────────────
      watch: false,                 // Never watch in production — it restarts on any file change

      // ── Node args ────────────────────────────────────────────────────────────
      node_args: [
        '--max-old-space-size=460', // Match max_memory_restart (512M - headroom)
      ],
    },
  ],
};
