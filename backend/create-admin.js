// backend/create-admin.js

// Require dependencies
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Load environment variables
require('dotenv').config();

// Ensure this URI matches your config/db.js
// Note: Your path suggests 'dolphin'. Ensure the .env file is correct.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dolphin';

const ADMIN_DATA = {
  name: 'Super Admin',
  email: 'admin@dolphin.com',
  // 1. CHANGE THIS to the actual password you want to type at login
  password: 'Admin@123', 
  role: 'admin',
  state: 'APPROVED',
  emailVerified: true
};

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const User = require('./models/User');
    await User.init();

    const existingAdmin = await User.findOne({ email: ADMIN_DATA.email });
    if (existingAdmin) {
      console.log(`⚠️  Admin already exists. Delete the user in DB and re-run if you want to reset the password.`);
      return;
    }

    // 2. Hash the PLAIN TEXT password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, salt);

    const admin = new User({
      name: ADMIN_DATA.name,
      email: ADMIN_DATA.email,
      password: hashedPassword, // Save the correctly hashed password
      role: ADMIN_DATA.role,
      state: ADMIN_DATA.state,
      emailVerified: ADMIN_DATA.emailVerified
    });

    await admin.save();
    console.log('✅ Admin User Created Successfully');
    console.log(`Email: ${ADMIN_DATA.email}`);
    console.log(`Password: ${ADMIN_DATA.password}`); // Log the plain text for you to see

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the function
createAdmin();