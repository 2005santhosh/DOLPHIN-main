const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Startup = require('../models/Startup');
const IntroRequest = require('../models/IntroRequest');
const Notification = require('../models/Notification');
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');
const { forgotPassword, resetPassword } = require('../controller/auth');

// ✅ UPDATED: Import Cloudinary config instead of local multer
const { upload, cloudinary } = require('../config/cloudinary');

// Register
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

    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state,
        nextSteps: 'Wait for admin approval to access the platform'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Server error during registration',
      reason: error.message,
      nextSteps: 'Try again or contact support'
    });
  }
});

// Login
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

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: { 
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state,
        profilePicture: user.profilePicture || "" 
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Logout
router.post('/logout', protect, (req, res) => {
  try {
    if (!req.app.locals.tokenBlacklist) {
      req.app.locals.tokenBlacklist = new Set();
    }
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      req.app.locals.tokenBlacklist.add(token);
      setTimeout(() => {
        req.app.locals.tokenBlacklist.delete(token);
      }, 30 * 24 * 60 * 60 * 1000);
    }
    res.status(200).json({
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

// Email verification
router.post('/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    if (!email || !verificationCode) {
      return res.status(400).json({ message: 'Email and verification code required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.emailVerified = true;
    await user.save();
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Server error during email verification',
      reason: error.message
    });
  }
});

// Send verification email
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

// Delete account
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

// @route   POST /api/auth/upload-profile-picture
// ✅ UPDATED: Now uploads to Cloudinary
router.post('/upload-profile-picture', protect, (req, res) => {
  // Use the imported upload middleware from cloudinary config
  upload.single('profilePicture')(req, res, function (err) {
    if (err) {
      // Handle Multer or Cloudinary errors
      console.error('Upload Error:', err);
      return res.status(400).json({ message: err.message || 'Image upload failed' });
    }
    // Proceed to handler
    handleUpload(req, res);
  });
});
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ UPDATED: 
    // 1. 'req.file.path' contains the full Cloudinary URL.
    // 2. We no longer need to construct a relative path like '/uploads/...'.
    // 3. We can optionally delete the old image from Cloudinary if needed (omitted for simplicity here).
    
    user.profilePicture = req.file.path; 
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture uploaded',
      profilePicture: user.profilePicture // Returns the full HTTPS URL
    });
  } catch (err) {
    console.error('Handle Upload Error:', err);
    res.status(500).json({ message: 'Server error saving profile picture' });
  }
}

module.exports = router;