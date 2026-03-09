const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @desc    Forgot Password - Generate Token & Send Email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // We return a generic success message to prevent email enumeration attacks
      return res.status(200).json({ success: true, message: 'If that email exists in our system, a reset link has been sent.' });
    }

    // Get reset token (using the method we added to the model)
    const resetToken = user.getResetPasswordToken();

    // Save the user with the hashed token
    await user.save({ validateBeforeSave: false });

    // Create reset url (Adjust the URL to match your frontend route)
    // Example: http://localhost:5000/reset-password.html?token=xyz
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #4f46e5;">Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" clicktracking=off style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
        <p style="font-size: 12px; color: #777;">This link is valid for 10 minutes. If you did not request this, please ignore this email.</p>
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
      // Clear the token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ message: 'Email could not be sent' });
    }

  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password - Update password using token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // Find user by token and check if expired
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    const { password } = req.body;
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // Clear the reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    // Optionally: Log them in automatically by sending a token, or just say success
    res.status(200).json({ success: true, message: 'Password updated successfully' });

  } catch (err) {
    next(err);
  }
};