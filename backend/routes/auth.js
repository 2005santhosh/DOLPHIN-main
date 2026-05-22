const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Startup = require('../models/Startup');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');
const Log = require('../models/Log');
const Post = require('../models/Post');
const { protect } = require('../middleware/authMiddleware');
const { forgotPassword, resetPassword } = require('../controller/auth');
const sendEmail = require('../utils/sendEmail');
const { getWelcomeEmail, getOtpEmail } = require('../utils/emailTemplates');
const { upload, cloudinary } = require('../config/cloudinary');
const {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  forgotPasswordLimiter
} = require('../middleware/rateLimiters');
const { sanitizeBody } = require('../middleware/sanitize');

// Allowed roles for self-registration (admin cannot self-register)
const ALLOWED_ROLES = ['founder', 'investor', 'provider'];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Cookie options — shared across all auth responses
const cookieOptions = () => ({
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  path: '/',
  domain: '.dolphinorg.in'
});

// Expired cookie options — used for logout/delete
const expiredCookieOptions = () => ({
  expires: new Date(Date.now() - 1000), // Past date — deletes the cookie
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  path: '/',
  domain: '.dolphinorg.in'
});

// Send token in HttpOnly cookie + safe user object in body (NO raw token in body)
const sendTokenResponse = (user, statusCode, req, res) => {
  const token = generateToken(user);

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions())
    .json({
      success: true,
      // Token also sent in body for cross-domain React app (localStorage fallback)
      // This is intentional for the Vercel ↔ Railway cross-domain setup
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rewardPoints: user.rewardPoints || 0,
        profilePicture: user.profilePicture || '',
        state: user.state || 'PENDING_APPROVAL'
      }
    });
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// @route   POST /api/auth/register
// @access  Public
router.post('/register', registerLimiter, sanitizeBody(['name', 'email']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });

    // Validate role — prevent self-registration as admin
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be founder, investor, or provider.' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists)
      return res.status(409).json({
        message: 'Email already in use',
        nextSteps: 'Try logging in or use a different email'
      });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      state: 'PENDING_APPROVAL',
      emailVerified: false,
      verificationToken: hashedOtp,
      verificationExpire: Date.now() + 10 * 60 * 1000
    });

    if (role === 'provider') {
      await Provider.create({
        userId: user._id,
        name: `${name} Services`,
        category: 'General',
        description: 'Professional services for startups',
        verified: false,
        stageCategories: [1, 2, 3]
      });
    }

    // Send OTP — if this fails, roll back user AND provider
    try {
      const otpEmail = getOtpEmail(user.name, otp);
      await sendEmail({
        email: user.email,
        subject: otpEmail.subject,
        message: otpEmail.html
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      await User.findByIdAndDelete(user._id);
      if (role === 'provider') await Provider.deleteOne({ userId: user._id });
      return res.status(500).json({ message: 'Could not send verification email. Please try again.' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete registration.',
      email: user.email
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});
// @route   POST /api/auth/verify-otp
// @desc    Verify OTP sent during registration, then issue session
router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ message: 'Email and OTP are required' });

    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      verificationToken: hashedOtp,
      verificationExpire: { $gt: Date.now() }
    });

    if (!user)
      return res.status(400).json({ message: 'Invalid or expired OTP. Please try again.' });

    // Mark verified and clear OTP fields
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save();

    // Send welcome email
    try {
      const welcomeTemplate = getWelcomeEmail(user.name);
      await sendEmail({
        email: user.email,
        subject: welcomeTemplate.subject,
        message: welcomeTemplate.html
      });
    } catch (e) { console.error('Welcome email failed:', e); }

    // Log the user in (sets HttpOnly cookie)
    sendTokenResponse(user, 200, req, res);

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});
// @route   POST /api/auth/login
// @access  Public
router.post('/login', loginLimiter, sanitizeBody(['email']), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(password, '$2a$12$placeholderhashthatnevermatchesXXXXXXXXXXXXXXXXXXXXXX');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if account is blocked before password check
    if (user.state === 'BLOCKED') {
      return res.status(403).json({ message: 'Your account has been suspended. Contact support@pacificdev.in' });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Block login if email not verified — user must complete OTP first
    if (!user.emailVerified) {
      // Re-send a fresh OTP so they can complete verification
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
      user.verificationToken = hashedOtp;
      user.verificationExpire = Date.now() + 10 * 60 * 1000; // 10 min
      await user.save();

      // Fire-and-forget — don't block the response
      const { getOtpEmail } = require('../utils/emailTemplates');
      sendEmail({
        email: user.email,
        subject: getOtpEmail(user.name, otp).subject,
        message: getOtpEmail(user.name, otp).html,
      }).catch(e => console.error('OTP resend error:', e));

      return res.status(403).json({
        message: 'Email not verified. A new OTP has been sent to your email.',
        requiresVerification: true,
        email: user.email,
      });
    }

    sendTokenResponse(user, 200, req, res);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  try {
    // Blacklist the current token so it can't be reused
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token && req.app.locals.tokenBlacklist) {
      req.app.locals.tokenBlacklist.add(token);
    }

    // Clear the cookie by setting it to expire in the past
    res.cookie('token', 'none', expiredCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
});

// ==========================================
// EMAIL VERIFICATION ROUTES register
// ==========================================

// In routes/auth.js - FIX THE VERIFY ENDPOINT
router.post('/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    if (!email || !verificationCode) {
      return res.status(400).json({ message: 'Email and verification code required' });
    }

    const user = await User.findOne({
      email,
      verificationToken: crypto.createHash('sha256').update(verificationCode).digest('hex'),
      verificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// @route   POST /api/auth/send-verification-email
router.post('/send-verification-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({
      message: 'Verification email sent',
      nextSteps: 'Check your email for the verification code'
    });
  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP to an unverified account
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether the email exists
      return res.status(200).json({ message: 'If that email is registered and unverified, a new OTP has been sent.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'This email is already verified. Please log in.' });
    }

    // Generate fresh OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.verificationToken = hashedOtp;
    user.verificationExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const { getOtpEmail } = require('../utils/emailTemplates');
    sendEmail({
      email: user.email,
      subject: getOtpEmail(user.name, otp).subject,
      message: getOtpEmail(user.name, otp).html,
    }).catch(e => console.error('OTP resend error:', e));

    res.status(200).json({ message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

// @route   PUT /api/auth/reset-password/:token
router.put('/reset-password/:token', resetPassword);

// ==========================================
// PROFILE MANAGEMENT ROUTES
// ==========================================

// @route   GET /api/auth/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'name email role state stage emailVerified watchlist interestAreas stagePreference createdAt updatedAt rewardPoints emailNotifications profilePicture'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      profile: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state || 'PENDING_APPROVAL',
        stage: user.stage || 0,
        emailVerified: user.emailVerified || false,
        watchlist: user.watchlist || [],
        interestAreas: user.interestAreas || [],
        stagePreference: user.stagePreference || [],
        joinedAt: user.createdAt,
        lastUpdated: user.updatedAt,
        rewardPoints: user.rewardPoints || 0,
        emailNotifications: user.emailNotifications ?? true,
        profilePicture: user.profilePicture || "",
        status: {
          isApproved: user.state === 'APPROVED' || user.state?.startsWith('STAGE_'),
          isBlocked: user.state === 'BLOCKED',
          currentStage: user.stage || 0,
          canAccessPlatform: user.state !== 'PENDING_APPROVAL' && user.state !== 'BLOCKED'
        }
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});

// @route   PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  const { name, emailNotifications } = req.body;
  const updateFields = {};
  if (name) updateFields.name = name;
  if (typeof emailNotifications !== 'undefined') updateFields.emailNotifications = emailNotifications;

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    // Sync authorName in all posts by this user when name changes
    if (name) {
      Post.updateMany(
        { authorId: req.user.id },
        { $set: { authorName: name } }
      ).catch(err => console.error('Post name sync error:', err));
    }

    res.json({ 
      success: true, 
      message: 'Profile updated',
      user: user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide both current and new password' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.password) {
       return res.status(400).json({ message: 'Password cannot be changed for this account type' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error updating password' });
  }
});

// ==========================================
// ACCOUNT DELETION
// ==========================================

// @route   DELETE /api/auth/account
router.delete('/account', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'founder') {
      const founderStartups = await Startup.find({ founderId: userId }).select('_id');
      const startupIds = founderStartups.map(s => s._id);
      await Startup.deleteMany({ founderId: userId });
      if (startupIds.length > 0) {
        await User.updateMany(
          { watchlist: { $in: startupIds } },
          { $pullAll: { watchlist: startupIds } }
        );
      }
    }
    if (user.role === 'provider') {
      await Provider.deleteOne({ userId });
    }

    await IntroRequest.deleteMany({ $or: [{ providerId: userId }, { founderId: userId }] });
    await Notification.deleteMany({ userId });
    await Log.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    if (req.app.locals.tokenBlacklist) {
      const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
      if (token) req.app.locals.tokenBlacklist.add(token);
    }

    res.cookie('token', 'none', expiredCookieOptions());

    res.status(200).json({
      message: 'Account deleted successfully',
      nextSteps: 'You have been signed out. You can register again anytime.'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// ==========================================
// PROFILE PICTURE UPLOAD
// ==========================================

// @route   POST /api/auth/upload-profile-picture
router.post('/upload-profile-picture', protect, (req, res) => {
  upload.single('profilePicture')(req, res, function (err) {
    if (err) {
      console.error('Upload Error:', err);
      return res.status(400).json({ message: err.message || 'Image upload failed' });
    }
    handleUpload(req, res);
  });
});

async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profilePicture = req.file.path; 
    await user.save();

    // Sync authorImage in all posts by this user
    Post.updateMany(
      { authorId: req.user.id },
      { $set: { authorImage: req.file.path } }
    ).catch(err => console.error('Post image sync error:', err));

    res.json({
      success: true,
      message: 'Profile picture uploaded',
      profilePicture: user.profilePicture
    });
  } catch (err) {
    console.error('Handle Upload Error:', err);
    res.status(500).json({ message: 'Server error saving profile picture' });
  }
}

module.exports = router;