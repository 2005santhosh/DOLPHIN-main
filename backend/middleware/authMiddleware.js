const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect API routes
exports.protect = async (req, res, next) => {
  let token;

  // 1. Check for token in HttpOnly Cookie (Primary Method)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback: Check Authorization header (for API clients / cross-domain React app)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 3. If no token found
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  // 4. Check token blacklist (logged-out tokens)
  const blacklist = req.app && req.app.locals && req.app.locals.tokenBlacklist;
  if (blacklist && blacklist.has(token)) {
    return res.status(401).json({
      success: false,
      message: 'Token has been invalidated. Please log in again.'
    });
  }

  try {
    // 5. Verify token — NO fallback secret; crash-fail if JWT_SECRET is missing
    if (!process.env.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET not set');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 6. Get user from DB (fresh read to catch state changes like blocks)
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    // 7. Block check — blocked users cannot authenticate
    if (user.state === 'BLOCKED') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support@pacificdev.in'
      });
    }

    // 8. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    // Do NOT leak error details to the client
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};
