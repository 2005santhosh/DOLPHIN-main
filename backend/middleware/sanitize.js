/**
 * Input sanitization middleware
 * Strips HTML tags and dangerous characters from string fields
 * to prevent XSS attacks.
 */

// Strip HTML tags and script-injection patterns from a string
const stripHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/javascript:/gi, '')       // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '')         // Remove event handlers (onclick=, etc.)
    .replace(/data:/gi, '')             // Remove data: URIs
    .trim();
};

// Sanitize specific fields in req.body
const sanitizeBody = (fields) => {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          req.body[field] = stripHtml(req.body[field]);
        }
      });
    }
    next();
  };
};

// General sanitizer for all string fields in req.body
const sanitizeAll = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeObj = (obj) => {
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'string') {
          obj[key] = stripHtml(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObj(obj[key]);
        }
      });
    };
    sanitizeObj(req.body);
  }
  next();
};

module.exports = { sanitizeBody, sanitizeAll, stripHtml };
