/**
 * validation.js — Shared input validation helpers.
 * Used by route handlers to validate request data before processing.
 */

const mongoose = require('mongoose');

/**
 * Returns true if the string is a valid MongoDB ObjectId.
 * Prevents CastError 500s when user-supplied IDs are invalid.
 */
function isValidObjectId(id) {
  if (!id) return false;
  try {
    return mongoose.Types.ObjectId.isValid(id) &&
      String(new mongoose.Types.ObjectId(id)) === String(id);
  } catch {
    return false;
  }
}

/**
 * Returns true if the string looks like a valid email address.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Clamps a number between min and max (inclusive).
 */
function clamp(value, min, max) {
  const n = Number(value);
  if (isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/**
 * Truncates a string to maxLength characters.
 */
function truncate(str, maxLength) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength);
}

/**
 * Express middleware: validates that req.params.id is a valid ObjectId.
 * Returns 400 if invalid, otherwise calls next().
 */
function validateParamId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: `Invalid ${paramName}: must be a valid ID` });
    }
    next();
  };
}

/**
 * Express middleware: validates an array of body field names are non-empty strings.
 * Returns 400 with a specific message if any required field is missing.
 */
function requireFields(...fields) {
  return (req, res, next) => {
    for (const field of fields) {
      const val = req.body?.[field];
      if (val === undefined || val === null || String(val).trim() === '') {
        return res.status(400).json({ message: `${field} is required` });
      }
    }
    next();
  };
}

module.exports = {
  isValidObjectId,
  isValidEmail,
  clamp,
  truncate,
  validateParamId,
  requireFields,
};
