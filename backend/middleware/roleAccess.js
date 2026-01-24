const authorizeRole = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: `This dashboard is for ${requiredRole}s only`,
        nextSteps: 'Contact admin if you believe this is an error'
      });
    }
    next();
  };
};

module.exports = authorizeRole;