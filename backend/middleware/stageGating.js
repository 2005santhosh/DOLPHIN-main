const User = require('../models/User');
const Startup = require('../models/Startup');

const checkStageAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const startup = await Startup.findOne({ founderId: req.user.id });
    
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Create a startup first to access this feature'
      });
    }

    // Check if user is in APPROVED state
    if (user.state !== 'APPROVED') {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: `User state is ${user.state}, must be APPROVED`,
        nextSteps: 'Wait for admin approval to access the platform'
      });
    }

    // Check if user can access the requested stage
    const currentStage = startup.milestones.findIndex(m => !m.isCompleted);
    const requestedStage = parseInt(req.body.stage) || 0;
    
    if (requestedStage > 0 && currentStage >= 0 && requestedStage > currentStage + 1) {
      return res.status(403).json({ 
        message: 'Access denied',
        reason: 'Complete previous stages before accessing this stage',
        nextSteps: `Complete stage ${currentStage + 1} first`
      });
    }

    next();
  } catch (error) {
    console.error('Stage gating error:', error);
    res.status(500).json({ message: 'Server error during stage validation' });
  }
};

module.exports = checkStageAccess;