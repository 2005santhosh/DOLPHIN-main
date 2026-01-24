const User = require('../models/User');
const Startup = require('../models/Startup');

const advanceStage = async (userId) => {
  const user = await User.findById(userId);
  const startup = await Startup.findOne({ founderId: userId });
  
  if (!startup) {
    throw new Error('Startup not found');
  }

  const currentStage = startup.milestones.findIndex(m => !m.isCompleted);
  
  if (currentStage === -1) {
    // All stages completed
    user.state = 'STAGE_3';
    user.stage = 3;
  } else {
    // Move to next stage
    user.state = `STAGE_${currentStage + 1}`;
    user.stage = currentStage + 1;
  }

  await user.save();
  return user;
};

module.exports = { advanceStage };