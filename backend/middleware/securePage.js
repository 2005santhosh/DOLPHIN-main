const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect HTML pages (Server-Side Rendering Protection)
const securePage = (roles = []) => {
  return async (req, res, next) => {
    // 1. Get token from HttpOnly Cookie
    const token = req.cookies.token;

    // 2. If no token, redirect to login immediately
    if (!token) {
      console.log('SecurePage: No token found in cookie. Redirecting to login.');
      return res.redirect('/login.html');
    }

    try {
      // 3. Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey');

      // 4. Find the user
      const user = await User.findById(decoded.id);

      if (!user) {
        console.log('SecurePage: User not found. Redirecting.');
        res.clearCookie('token');
        return res.redirect('/login.html');
      }

      // 5. Check Role Authorization
      if (roles.length && !roles.includes(user.role)) {
        console.log(`SecurePage: Role mismatch. Required: ${roles}, User: ${user.role}`);
        return res.status(403).send('<h1>403 Forbidden</h1><p>You do not have access to this page.</p>');
      }

      // 6. Attach user to request and proceed
      req.user = user;
      next();
    } catch (err) {
      console.error('SecurePage Verification Error:', err.message);
      res.clearCookie('token');
      return res.redirect('/login.html');
    }
  };
};

module.exports = { securePage };