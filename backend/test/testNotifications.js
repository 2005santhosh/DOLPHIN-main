// backend/test/testNotifications.js
// Test script for real-time notifications and AI validation

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Startup = require('../models/Startup');
const Notification = require('../models/Notification');
const { createNotification, notifyValidationComplete } = require('../services/notificationService');
const { scoreAnswer } = require('../services/geminiValidationService');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dolphin');
    log('✓ Connected to MongoDB', 'green');
    return true;
  } catch (error) {
    log(`✗ MongoDB connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function testNotificationModel() {
  log('\n=== Testing Notification Model ===', 'blue');
  
  try {
    // Find a test user
    const user = await User.findOne();
    if (!user) {
      log('✗ No users found in database. Create a user first.', 'red');
      return false;
    }
    
    log(`✓ Found test user: ${user.email}`, 'green');
    
    // Create test notification
    const notification = await Notification.create({
      userId: user._id,
      type: 'SYSTEM_UPDATE',
      title: 'Test Notification',
      message: 'This is a test notification created by the test script.',
      priority: 'medium'
    });
    
    log(`✓ Created notification: ${notification._id}`, 'green');
    
    // Get unread count
    const unreadCount = await Notification.getUnreadCount(user._id);
    log(`✓ Unread notifications: ${unreadCount}`, 'green');
    
    // Mark as read
    await notification.markAsRead();
    log('✓ Marked notification as read', 'green');
    
    // Delete test notification
    await Notification.deleteOne({ _id: notification._id });
    log('✓ Deleted test notification', 'green');
    
    return true;
  } catch (error) {
    log(`✗ Notification model test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testNotificationService() {
  log('\n=== Testing Notification Service ===', 'blue');
  
  try {
    const user = await User.findOne();
    if (!user) {
      log('✗ No users found', 'red');
      return false;
    }
    
    // Test createNotification
    const notification = await createNotification({
      userId: user._id,
      type: 'TEST',
      title: 'Service Test',
      message: 'Testing notification service',
      priority: 'low',
      sendRealtime: false // Don't send via socket for test
    });
    
    log(`✓ Created notification via service: ${notification._id}`, 'green');
    
    // Cleanup
    await Notification.deleteOne({ _id: notification._id });
    log('✓ Cleaned up test notification', 'green');
    
    return true;
  } catch (error) {
    log(`✗ Notification service test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testGeminiAI() {
  log('\n=== Testing Gemini AI Validation ===', 'blue');
  
  if (!process.env.GEMINI_API_KEY) {
    log('⚠️  GEMINI_API_KEY not set in .env', 'yellow');
    log('   Skipping AI tests. Set API key to test AI validation.', 'yellow');
    return true;
  }
  
  try {
    const question = {
      id: 1,
      question: 'What problem does your startup solve?',
      hint: 'Be specific about the pain point',
      category: 'problem',
      weight: 1.0
    };
    
    const answer = 'My startup helps small businesses automate their inventory management. Currently, they use spreadsheets which are error-prone and time-consuming. We provide a cloud-based solution that automatically tracks stock levels, predicts demand, and generates purchase orders. This saves them 10+ hours per week and reduces stockouts by 50%.';
    
    log('Testing AI scoring with sample answer...', 'yellow');
    
    const result = await scoreAnswer(question, answer);
    
    log(`✓ AI Score: ${result.score}%`, 'green');
    log(`✓ Feedback: ${result.feedback}`, 'green');
    log(`✓ Strengths: ${result.strengths.join(', ')}`, 'green');
    log(`✓ Improvements: ${result.improvements.join(', ')}`, 'green');
    
    return true;
  } catch (error) {
    log(`✗ Gemini AI test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testFullFlow() {
  log('\n=== Testing Full Validation Flow ===', 'blue');
  
  try {
    const user = await User.findOne();
    if (!user) {
      log('✗ No users found', 'red');
      return false;
    }
    
    const startup = await Startup.findOne({ founderId: user._id });
    if (!startup) {
      log('✗ No startup found for user', 'red');
      return false;
    }
    
    log(`✓ Found startup: ${startup.name}`, 'green');
    
    // Test validation completion notification
    await notifyValidationComplete(
      user._id,
      'idea',
      85,
      true,
      startup._id
    );
    
    log('✓ Sent validation completion notification', 'green');
    
    // Check if notification was created
    const notification = await Notification.findOne({
      userId: user._id,
      type: 'VALIDATION_COMPLETE'
    }).sort({ createdAt: -1 });
    
    if (notification) {
      log(`✓ Notification created: "${notification.title}"`, 'green');
      
      // Cleanup
      await Notification.deleteOne({ _id: notification._id });
      log('✓ Cleaned up test notification', 'green');
    } else {
      log('⚠️  Notification not found in database', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`✗ Full flow test failed: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('🧪 Dolphin Platform - Test Suite', 'blue');
  log('================================\n', 'blue');
  
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }
  
  const results = {
    notificationModel: await testNotificationModel(),
    notificationService: await testNotificationService(),
    geminiAI: await testGeminiAI(),
    fullFlow: await testFullFlow()
  };
  
  // Summary
  log('\n=== Test Summary ===', 'blue');
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result ? '✓' : '✗';
    const color = result ? 'green' : 'red';
    log(`${status} ${name}`, color);
  });
  
  log(`\n${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  // Cleanup
  await mongoose.connection.close();
  log('\n✓ Disconnected from MongoDB', 'green');
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});