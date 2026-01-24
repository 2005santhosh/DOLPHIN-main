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

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
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

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
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

// Logout
router.post('/logout', protect, (req, res) => {
  res.status(200).json({
    message: 'Logged out successfully',
    nextSteps: 'You can now safely close the browser'
  });
});

module.exports = router;