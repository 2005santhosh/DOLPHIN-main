const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Needed for generating token
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');

// Helper: Generate Token with User-Agent Binding
const generateToken = (user, userAgent) => {
  // 1. Create a hash of the User-Agent to bind the session
  const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');

  // 2. Sign the token with the hash included
  return jwt.sign(
    { id: user._id, role: user.role, userAgentHash }, 
    process.env.JWT_SECRET, 
    { expiresIn: '30d' }
  );
};

// Helper: Send Cookie Response
const sendTokenResponse = (user, statusCode, req, res) => {
  const token = generateToken(user, req.headers['user-agent'] || '');

  // CRITICAL: These settings MUST match securePage.js
  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: true,             // REQUIRED for cross-origin
    sameSite: 'none',         // REQUIRED for cross-origin
    domain: '.dolphinorg.in'  // REQUIRED to share between www and api
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({ 
      success: true, 
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      } 
    });
};
// @desc    Register User
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({ name, email, password, role });
    await user.save();

    // Automatically log them in (set cookie)
    sendTokenResponse(user, 200, req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate email & password
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide an email and password' });
    }

    // 2. Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 4. Send Token Response (Sets HTTP-Only Cookie)
    sendTokenResponse(user, 200, req, res);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Log User Out / Clear Cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  // req.user is set by the securePage or protect middleware
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    data: user
  });
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    // Security: Always return success even if user not found
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists in our system, a reset link has been sent.' });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // FIX: Hardcoded your production domain
    const baseUrl = 'https://dolphinorg.in';
    const resetUrl = `${baseUrl}/reset-password.html?token=${resetToken}`;

    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" clicktracking=off style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
        <p style="font-size: 12px; color: #777;">This link is valid for 10 minutes.</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Dolphin Password Reset Token',
        message
      });

      res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (err) {
      console.error('Email sending error:', err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ message: 'Email could not be sent' });
    }

  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // 1. Hash token from URL to compare with DB
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // 2. Find user by token and check expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // 3. Set new password (Mongoose pre-save hook will hash it automatically if you have it, 
    // otherwise manually hash it here. Assuming model handles it or manual hash below)
    const { password } = req.body;
    
    // Manual Hash (Safe approach if model hook is missing)
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // 4. Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // 5. SECURITY FIX: Automatically log the user in (Set the cookie)
    // This uses the same secure logic as the login function
    sendTokenResponse(user, 200, req, res);

  } catch (err) {
    console.error(err);
    next(err);
  }
};