/**
 * tokenBlacklist.js — Time-bounded in-memory token blacklist.
 *
 * Problem with the original Set approach:
 *   - Grows unbounded (memory leak for high-logout traffic)
 *   - Resets on process restart → logged-out tokens become valid again
 *
 * This implementation:
 *   - Stores token → expiresAt mapping
 *   - Auto-prunes expired entries every 10 minutes (no memory leak)
 *   - Still resets on restart, but JWT expiry (30 days) is the safety net —
 *     a restarted process won't accept a token that's expired anyway
 *   - Production upgrade path: swap the Map for a Redis SET with TTL
 *
 * Usage:
 *   const blacklist = require('./utils/tokenBlacklist');
 *   blacklist.add(token, jwtPayload.exp);
 *   blacklist.has(token);  // → true/false
 */

const jwt = require('jsonwebtoken');

// Map<token, expiresAtMs>
const store = new Map();

// Prune expired entries every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of store) {
    if (expiresAt <= now) store.delete(token);
  }
}, 10 * 60 * 1000).unref(); // .unref() so this timer doesn't prevent process exit

const blacklist = {
  /**
   * Add a token to the blacklist until its JWT expiry.
   * @param {string} token  - Raw JWT string
   */
  add(token) {
    if (!token) return;
    try {
      // Decode without verifying — we only need the exp claim
      const decoded = jwt.decode(token);
      const exp = decoded?.exp
        ? decoded.exp * 1000          // JWT exp is in seconds
        : Date.now() + 30 * 24 * 60 * 60 * 1000; // fallback: 30d
      store.set(token, exp);
    } catch {
      // Non-JWT strings — store with 30d expiry
      store.set(token, Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },

  /**
   * Check if a token is blacklisted and still within its validity window.
   * @param {string} token
   * @returns {boolean}
   */
  has(token) {
    if (!token) return false;
    const expiresAt = store.get(token);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      store.delete(token); // lazy cleanup
      return false;
    }
    return true;
  },

  /** Current size — useful for monitoring */
  get size() { return store.size; },
};

module.exports = blacklist;
