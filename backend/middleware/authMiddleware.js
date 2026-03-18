const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect API routes
exports.protect = async (req, res, next) => {
  let token;

  // 1. Check for token in HttpOnly Cookie (Primary Method)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } 
  // 2. Fallback: Check Authorization header (for legacy support or Postman)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 3. If no token found
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized to access this route (No Token)' 
    });
  }

  try {
    // 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');

    // 5. Get user from DB
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // 6. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized to access this route (Invalid Token)' 
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};