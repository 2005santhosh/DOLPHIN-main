// Run in mongo shell or create a file: backend/scripts/createAdmin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI);

const User = require('../models/User');

async function createAdmin() {
  const email = 'admin@dolphin.com';
  const exists = await User.findOne({ email });

  if (exists) {
    console.log('Admin already exists');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash('Admin@1234', 10);

  const admin = await User.create({
    name: 'Platform Admin',
    email: email,
    password: hashedPassword,
    role: 'admin',        // <-- this is the key field
    state: 'STAGE_1',
    stage: 1
  });

  console.log('Admin created successfully');
  console.log('Email:', admin.email);
  console.log('Password: Admin@1234');
  console.log('Role:', admin.role);

  mongoose.disconnect();
}

createAdmin();