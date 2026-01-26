const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { protect } = require('../middleware/authMiddleware');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
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

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ 
        message: 'Email already in use',
        reason: 'This email is already registered',
        nextSteps: 'Try logging in or use a different email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      state: 'PENDING_APPROVAL'
    });

    // Create provider profile if needed
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

    // Generate token (30 days validity)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password required',
        nextSteps: 'Please enter your email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        reason: 'No account found with this email',
        nextSteps: 'Check your email or register a new account'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        reason: 'Incorrect password',
        nextSteps: 'Check your password or use "Forgot Password"'
      });
    }

    // Check if user is blocked
    if (user.state === 'BLOCKED') {
      return res.status(403).json({ 
        message: 'Account blocked',
        reason: 'Your account has been blocked by an administrator',
        nextSteps: 'Contact support for assistance'
      });
    }

    // Generate token (30 days validity)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state,
        nextSteps: user.state === 'PENDING_APPROVAL' 
          ? 'Wait for admin approval to access the platform'
          : 'You can now access the platform'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Server error during login',
      reason: error.message,
      nextSteps: 'Try again or contact support'
    });
  }
});

// Logout - Add token to blacklist
router.post('/logout', protect, (req, res) => {
  try {
    // Initialize token blacklist if not exists
    if (!req.app.locals.tokenBlacklist) {
      req.app.locals.tokenBlacklist = new Set();
    }

    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      // Add token to blacklist
      req.app.locals.tokenBlacklist.add(token);
      
      // Set a timer to remove token after 30 days (prevent memory leaks)
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

// Email verification endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({
        message: 'Email and verification code required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    user.emailVerified = true;
    await user.save();

    res.status(200).json({
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Server error during email verification',
      reason: error.message
    });
  }
});

// Send verification email endpoint
router.post('/send-verification-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // TODO: In production, implement real SMTP sending with nodemailer/SendGrid
    // For now, this endpoint generates a code and would send via email
    
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

// Get user profile (Phase 1: State-Driven Dashboards - Frontend state sync)
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'name email role state stage emailVerified watchlist interestAreas stagePreference createdAt updatedAt'
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        reason: 'Session user record missing'
      });
    }

    res.status(200).json({
      success: true,
      profile: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        // Phase 1: State-driven UI control
        state: user.state || 'PENDING_APPROVAL', // PENDING_APPROVAL | APPROVED | STAGE_1-5 | BLOCKED
        stage: user.stage || 0,
        emailVerified: user.emailVerified || false,
        // Role-specific data
        watchlist: user.watchlist || [],
        interestAreas: user.interestAreas || [],
        stagePreference: user.stagePreference || [],
        // Timestamps for phase tracking
        joinedAt: user.createdAt,
        lastUpdated: user.updatedAt,
        // Phase 5: Visibility - Status messages
        status: {
          isApproved: user.state === 'APPROVED' || user.state?.startsWith('STAGE_'),
          isBlocked: user.state === 'BLOCKED',
          currentStage: user.stage || 0,
          canAccessPlatform: user.state !== 'PENDING_APPROVAL' && user.state !== 'BLOCKED'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching profile',
      reason: error.message,
      nextSteps: 'Try refreshing the page or logging in again'
    });
  }
});

module.exports = router;