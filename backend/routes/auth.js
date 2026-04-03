const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Needed for hashing
const User = require('../models/User');
const Provider = require('../models/Provider');
const Startup = require('../models/Startup');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');
const { forgotPassword, resetPassword } = require('../controller/auth');
const sendEmail = require('../utils/sendEmail');
const { getWelcomeEmail } = require('../utils/emailTemplates');
// ✅ IMPORT CLOUDINARY CONFIG
const { upload, cloudinary } = require('../config/cloudinary');

// ==========================================
// HELPER FUNCTIONS FOR SECURITY await
// ==========================================
// Helper to generate token with User-Agent Binding
// Simplified generateToken
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '30d' }
  );
};

// Helper: Send Cookie Response (Environment Aware)
const sendTokenResponse = (user, statusCode, req, res) => {
  const token = generateToken(user, req.headers['user-agent'] || '');
  const options = {
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  httpOnly: true,
  // secure: false,
  secure: true,                      // must stay true in prod
  sameSite: 'None',
  // sameSite: 'Lax',
  path: '/',
  // ← add this line (lowercase 'p')
  // domain: 'localhost'
  domain: '.dolphinorg.in'        //strongly recommended – see below
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

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Name, email and password are required',
        nextSteps: 'Please fill in all required fields'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long',
        nextSteps: 'Choose a stronger password'
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ 
        message: 'Email already in use',
        reason: 'This email is already registered',
        nextSteps: 'Try logging in or use a different email'
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      state: 'PENDING_APPROVAL'
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

    // Use secure helper to set cookie
    sendTokenResponse(user, 201, req, res);
          // Send Welcome Email
    try {
        const welcomeTemplate = getWelcomeEmail(user.name);
        await sendEmail({
          email: user.email,
          subject: welcomeTemplate.subject,
          message: welcomeTemplate.html
        });
    } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
  // Do not block registration if email fails
    }

  } catch (error) {
    res.status(500).json({ 
      message: 'Server error during registration',
      reason: error.message,
      nextSteps: 'Try again or contact support'
    });
  }
});

// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Use secure helper to set cookie
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
   const options = {
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  httpOnly: true,
  secure: true,                      // must stay true in prod
  sameSite: 'None',
  path: '/',
                   // ← add this line (lowercase 'p')
  domain: '.dolphinorg.in'        // strongly recommended – see below
};

    res.cookie('token', 'none', options);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      nextSteps: 'You can now safely close the browser'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error during logout',
      reason: error.message
    });
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
      // Assuming you add a verificationToken field to your User model
      verificationToken: crypto.createHash('sha256').update(verificationCode).digest('hex'),
      verificationExpire: { $gt: Date.now() } // Ensure code hasn't expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.emailVerified = true;
    user.verificationToken = undefined; // Clear the token
    user.verificationExpire = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during email verification', reason: error.message });
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
    res.status(500).json({
      message: 'Error sending verification email',
      reason: error.message
    });
  }
});

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

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
      const token = req.headers.authorization?.split(' ')[1];
      if (token) req.app.locals.tokenBlacklist.add(token);
    }
    
    const options = {
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  httpOnly: true,
  secure: true,                      // must stay true in prod
  sameSite: 'None',
  path: '/',
                   // ← add this line (lowercase 'p')
  domain: '.dolphinorg.in'        // strongly recommended – see below
};

    res.cookie('token', 'none', options);

    res.status(200).json({
      message: 'Account deleted successfully',
      nextSteps: 'You have been signed out. You can register again anytime.'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      message: 'Failed to delete account',
      reason: error.message
    });
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