require('dotenv').config(); // Load variables from .env
const mongoose = require('mongoose');
const IntroRequest = require('./models/IntroRequest'); // Adjust path if needed

const fixRequests = async () => {
  try {
    // 1. Connect to Database
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin');
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // 2. Run the Update
    // This sets 'initiator' to 'founder' for all requests that don't have it
    const result = await IntroRequest.updateMany(
      { initiator: { $exists: false } }, 
      { $set: { initiator: 'founder' } }
    );

    console.log(`✅ Update Complete.`);
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixRequests();