const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto'); // IMPORT CRYPTO for hashing

/**
 * Helper to detect if request is from a browser or API client
 */
const isBrowserRequest = (req) => {
  const acceptHeader = req.get('Accept') || '';
  return acceptHeader.includes('text/html') || 
         !acceptHeader.includes('application/json') ||
         req.headers['content-type'] === undefined;
};

/**
 * Middleware to protect HTML pages with role-based access
 * Includes User-Agent Fingerprinting to prevent Token Copy-Paste attacks
 */
const securePage = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let token;
      
      // 1. Check for token in Cookies (Primary for HTML pages)
      if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }
      
      // 2. Check Authorization Header (Fallback for API/AJAX)
      if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      // 3. Check Query Params (Legacy/External Links - less secure)
      if (!token && req.query.token) {
        token = req.query.token;
      }
      
      // If no token found, redirect to login
      if (!token) {
        if (isBrowserRequest(req)) {
          return res.redirect('/login.html');
        }
        return res.status(401).json({ 
          message: 'Not authorized, no token',
          nextSteps: 'Please login first'
        });
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // --- SECURITY FIX: USER-AGENT FINGERPRINTING ---
      // This prevents a stolen token from being used on a different browser/device.
      if (decoded.userAgentHash) {
        const currentUserAgent = req.headers['user-agent'] || '';
        const currentHash = crypto.createHash('sha256').update(currentUserAgent).digest('hex');

        if (currentHash !== decoded.userAgentHash) {
          console.warn(`[Security Alert] User-Agent mismatch for User ${decoded.id}. Possible session hijacking attempt.`);
          
          // Clear the cookie to force re-login
          res.clearCookie('token');
          
          if (isBrowserRequest(req)) {
            return res.redirect('/login.html?error=session_invalid');
          }
          return res.status(401).json({ 
            message: 'Session invalid',
            reason: 'Security verification failed',
            nextSteps: 'Please login again'
          });
        }
      }
      // --- END SECURITY FIX ---

      // Check if user is in token blacklist (for logout)
      if (req.app.locals.tokenBlacklist && req.app.locals.tokenBlacklist.has(token)) {
        if (isBrowserRequest(req)) {
          res.clearCookie('token');
          return res.redirect('/login.html');
        }
        return res.status(401).json({ 
          message: 'Token has been revoked',
          nextSteps: 'Please login again'
        });
      }
      
      // Find user
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        if (isBrowserRequest(req)) {
          res.clearCookie('token');
          return res.redirect('/login.html');
        }
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Check if user is approved (for platform access)
      if (user.state === 'PENDING_APPROVAL' && req.path !== '/admin-dashboard.html') {
        if (isBrowserRequest(req)) {
          // Ideally you would render a specific page, but for now we send status
          return res.status(403).send('<h1>Access Denied</h1><p>Your account is pending admin approval.</p>');
        }
        return res.status(403).json({ 
          message: 'Access denied',
          reason: 'Your account is pending admin approval',
          nextSteps: 'Wait for admin approval to access the platform'
        });
      }
      
      // Check role-based access
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        if (isBrowserRequest(req)) {
          return res.status(403).send(`<h1>Access Denied</h1><p>You do not have permission to view this page. <a href="/login.html">Go back</a></p>`);
        }
        return res.status(403).json({ 
          message: 'Access denied',
          reason: `User role ${user.role} is not authorized for this page`,
          nextSteps: `Allowed roles: ${allowedRoles.join(', ')}`
        });
      }
      
      // Attach user to request
      req.user = user;
      req.token = token;
      
      next();
    } catch (error) {
      console.error('securePage middleware error:', error);
      
      if (isBrowserRequest(req)) {
        res.clearCookie('token');
        return res.redirect('/login.html');
      }
      
      res.status(401).json({ 
        message: 'Not authorized, token failed',
        reason: error.message,
        nextSteps: 'Please login again'
      });
    }
  };
};

module.exports = { securePage, isBrowserRequest };