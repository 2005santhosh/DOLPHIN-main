const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
 * Unlike API protection, this redirects browser users to login instead of returning JSON
 */
const securePage = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      let token;
      
      // Check if authorization header exists
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      
      // Also check for token in cookies or query params
      if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }
      
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
      
      // Find user
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        if (isBrowserRequest(req)) {
          res.clearCookie('token');
          return res.redirect('/login.html');
        }
        return res.status(401).json({ message: 'User not found' });
      }
      
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
      
      // Check if user is approved (for platform access)
      if (user.state === 'PENDING_APPROVAL' && req.path !== '/admin-dashboard.html') {
        if (isBrowserRequest(req)) {
          return res.status(403).render('approval-pending', { 
            message: 'Your account is pending admin approval',
            email: user.email
          });
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
          return res.status(403).render('access-denied', {
            message: 'You do not have access to this page',
            userRole: user.role,
            requiredRoles: allowedRoles
          });
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
