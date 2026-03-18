const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in Cookies (Primary method for HttpOnly cookies)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback: Check Authorization Header (for API clients)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Debug log to verify token detection
  console.log(`[Protect Middleware] Path: ${req.path} | Token Found: ${!!token}`);

  if (!token) {
    return res.status(401).json({ 
      message: 'Not authorized, no token',
      nextSteps: 'Please login again' 
    });
  }

  try {
    // Check if token is in blacklist (logged out)
    if (req.app.locals.tokenBlacklist && req.app.locals.tokenBlacklist.has(token)) {
      return res.status(401).json({ 
        message: 'Token has been revoked',
        reason: 'You have been logged out',
        nextSteps: 'Please login again'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');
    
    // Find user by ID
    req.user = await User.findById(decoded.id).select('-password');      
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: `User role ${req.user?.role || 'unknown'} is not authorized for this action`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };