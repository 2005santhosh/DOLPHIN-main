/**
 * requestLogger.js — Structured request/response timing middleware.
 *
 * Logs every API request with:
 *   - HTTP method + path
 *   - Response status code
 *   - Exact duration in ms
 *   - User ID (if authenticated)
 *   - Slow request warning (>500ms highlighted)
 *
 * In production this output is captured by Railway/PM2 and can be
 * piped to Datadog, Papertrail, or any log drain.
 *
 * Kept intentionally simple — no external dependency (pino/winston
 * can be added later without changing the interface).
 */

const SLOW_REQUEST_THRESHOLD_MS = 500;

module.exports = function requestLogger(req, res, next) {
  // Skip logging for health checks to keep logs clean
  if (req.path === '/api/health' || req.path === '/') return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const slow       = durationMs >= SLOW_REQUEST_THRESHOLD_MS;
    const userId     = req.user?._id?.toString() || '-';
    const status     = res.statusCode;

    const level = status >= 500 ? 'ERROR'
                : status >= 400 ? 'WARN'
                : slow          ? 'SLOW'
                :                 'INFO';

    const line = `[${level}] ${req.method} ${req.path} → ${status} | ${durationMs.toFixed(1)}ms | user=${userId}`;

    if (level === 'ERROR' || level === 'SLOW') {
      console.warn(line);
    } else {
      console.log(line);
    }
  });

  next();
};
