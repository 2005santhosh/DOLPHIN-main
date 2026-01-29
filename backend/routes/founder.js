// backend/routes/founder.js
// UPDATED WITH NOTIFICATIONS AND GEMINI AI
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const checkStageAccess = require('../middleware/stageGating');
const Startup = require('../models/Startup');
const Log = require('../models/Log');
const { updateMilestone } = require('../services/milestoneService');
const { batchValidateStage } = require('../services/geminiValidationService'); // CHANGED TO GEMINI
const {
  notifyValidationComplete,
  notifyStageUnlocked,
  notifyTaskApproved,
  notifyMilestoneVerified
} = require('../services/notificationService');

// Get founder's startup
router.get('/my-startup', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const startup = await Startup.findOne({ founderId: req.user.id })
      .populate('auditLogs');
    
    if (!startup) {
      return res.status(404).json({ 
        message: 'No startup found',
        nextSteps: 'Create a startup first to access this feature'
      });
    }

    res.json(startup);
  } catch (error) {
    console.error('Error fetching startup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create startup
router.post('/', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const { name, thesis, industry } = req.body;

    if (!name || !thesis) {
      return res.status(400).json({ 
        message: 'Name and thesis are required',
        nextSteps: 'Provide a name and problem statement for your startup'
      });
    }

    const initialMilestones = [
      { title: 'Idea Validation', description: 'Evaluate your startup idea via a 10-question questionnaire (score ≥ 70% to pass).', isCompleted: false, verified: false, order: 1 },
      { title: 'Problem Definition', description: 'Clearly define the problem, target user, and evidence that the problem is real.', isCompleted: false, verified: false, order: 2 },
      { title: 'Solution Development', description: 'Define and test your proposed solution, differentiators, and feasibility.', isCompleted: false, verified: false, order: 3 },
      { title: 'Market Validation', description: 'Validate market size, distribution, and willingness-to-pay with data.', isCompleted: false, verified: false, order: 4 },
      { title: 'Business Model Validation', description: 'Validate pricing, unit economics, and repeatable go-to-market assumptions.', isCompleted: false, verified: false, order: 5 }
    ];

    const startup = await Startup.create({
      founderId: req.user.id,
      name,
      thesis,
      industry,
      milestones: initialMilestones,
      auditLogs: []
    });

    const log = await Log.create({
      userId: req.user.id,
      action: 'startup_created',
      details: { startupId: startup._id, name }
    });
    startup.auditLogs.push(log._id);
    await startup.save();

    const populatedStartup = await Startup.findById(startup._id).populate('auditLogs');
    res.status(201).json(populatedStartup);
  } catch (error) {
    console.error('Error creating startup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update startup profile
router.put('/my-startup', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { name, thesis, problemStatement, targetUsers, industry } = req.body;

    if (!name || !thesis) {
      return res.status(400).json({ 
        message: 'Name and thesis are required',
        nextSteps: 'Provide startup name and problem statement'
      });
    }

    const startup = await Startup.findOneAndUpdate(
      { founderId: req.user.id },
      {
        name,
        thesis,
        problemStatement,
        targetUsers,
        industry,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('auditLogs');

    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Create a startup first'
      });
    }

    const log = await Log.create({
      userId: req.user.id,
      action: 'startup_profile_updated',
      details: { startupId: startup._id }
    });
    startup.auditLogs.push(log._id);
    await startup.save();

    res.json(startup);
  } catch (error) {
    console.error('Error updating startup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit task for a milestone
router.post('/submit-task', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { milestoneId, title, description, evidence } = req.body;

    if (!milestoneId || !title) {
      return res.status(400).json({ 
        message: 'milestoneId and title are required',
        nextSteps: 'Select a milestone and provide task details'
      });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Create a startup first'
      });
    }

    const milestone = startup.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        message: 'Milestone not found',
        nextSteps: 'Select a valid milestone'
      });
    }

    const taskSubmission = {
      milestoneId,
      title,
      description,
      status: 'Submitted',
      submittedAt: new Date(),
      evidence
    };

    if (!milestone.taskSubmissions) {
      milestone.taskSubmissions = [];
    }
    milestone.taskSubmissions.push(taskSubmission);
    milestone.submissionStatus = 'Submitted';

    await startup.save();

    const log = await Log.create({
      userId: req.user.id,
      action: 'task_submitted',
      details: { startupId: startup._id, milestoneId, title }
    });
    startup.auditLogs.push(log._id);
    await startup.save();

    res.status(201).json({
      message: 'Task submitted successfully',
      startup: await Startup.findById(startup._id).populate('auditLogs'),
      nextSteps: 'Wait for admin review to get approval'
    });
  } catch (error) {
    console.error('Error submitting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get task submission status
router.get('/task-submissions', protect, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found',
        nextSteps: 'Create a startup first'
      });
    }

    const submissions = [];
    startup.milestones.forEach((milestone, idx) => {
      if (milestone.taskSubmissions) {
        milestone.taskSubmissions.forEach((task) => {
          submissions.push({
            ...task.toObject(),
            milestoneIndex: idx,
            milestoneName: milestone.title
          });
        });
      }
    });

    res.json(submissions);
  } catch (error) {
    console.error('Error fetching task submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update milestone
router.put('/milestones', protect, checkStageAccess, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const { milestoneId, isCompleted } = req.body;

    if (!milestoneId || isCompleted === undefined) {
      return res.status(400).json({ 
        message: 'milestoneId and isCompleted are required',
        nextSteps: 'Select a milestone and mark it as completed'
      });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ 
        message: 'Startup not found or access denied',
        nextSteps: 'Create a startup first or check your permissions'
      });
    }

    const updatedStartup = await updateMilestone(
      startup._id, 
      milestoneId, 
      isCompleted, 
      req.user.id
    );

    res.json(updatedStartup);
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(400).json({ 
      message: error.message,
      nextSteps: error.message.includes('previous milestone') 
        ? 'Complete and verify the previous milestone first'
        : 'Check your milestone selection and try again'
    });
  }
});

// ============= VALIDATION STAGES WITH NOTIFICATIONS =============

const VALIDATION_STAGE_KEYS = ['idea', 'problem', 'solution', 'market', 'business'];
const VALIDATION_STAGE_ORDER = {
  idea: 1,
  problem: 2,
  solution: 3,
  market: 4,
  business: 5
};

const VALIDATION_STAGE_TITLES = {
  idea: 'Idea Validation',
  problem: 'Problem Definition',
  solution: 'Solution Development',
  market: 'Market Validation',
  business: 'Business Model Validation'
};

const getStageQuestions = (stageKey) => {
  switch (stageKey) {
    case 'idea':
      return [
        { id: 1, question: 'Does your idea solve a critical pain point?', hint: 'Be specific about the problem and how painful it is', category: 'problem', weight: 1.0 },
        { id: 2, question: 'Have you validated this with potential customers?', hint: 'How many customers did you talk to? What did they say?', category: 'validation', weight: 1.0 },
        { id: 3, question: 'What is the addressable market size?', hint: 'TAM - Total Addressable Market (in dollars or units)', category: 'market', weight: 0.9 },
        { id: 4, question: 'What is your competitive advantage?', hint: 'What makes you different from competitors?', category: 'competition', weight: 0.9 },
        { id: 5, question: 'Do you have a clear business model?', hint: 'How will you make money? (e.g., B2B, B2C, subscription)', category: 'business', weight: 0.8 },
        { id: 6, question: 'Have you identified key metrics to measure success?', hint: 'What KPIs matter most? (e.g., CAC, LTV, growth rate)', category: 'metrics', weight: 0.8 },
        { id: 7, question: 'Do you have domain expertise in this area?', hint: 'Experience, background, or deep knowledge', category: 'expertise', weight: 0.7 },
        { id: 8, question: 'Is your idea technically feasible?', hint: 'Can it be built? Any major technical challenges?', category: 'feasibility', weight: 0.8 },
        { id: 9, question: 'Have you built an MVP or prototype?', hint: 'What version exists? What feedback did you get?', category: 'mvp', weight: 0.9 },
        { id: 10, question: 'Are you committed to this idea?', hint: 'Will you dedicate full-time effort? Quit your job?', category: 'commitment', weight: 0.7 }
      ];

    case 'problem':
      return [
        { id: 1, question: 'Who is the target user persona?', hint: 'Be specific (role, context, segment).', category: 'persona', weight: 1.0 },
        { id: 2, question: 'What is the exact problem statement?', hint: 'Write it as: "User has problem because..."', category: 'problem', weight: 1.0 },
        { id: 3, question: 'How frequently does this problem occur?', hint: 'Daily/weekly/monthly and in what context?', category: 'frequency', weight: 0.9 },
        { id: 4, question: 'How painful is the problem today?', hint: 'Quantify impact: time, money, risk, frustration.', category: 'severity', weight: 0.9 },
        { id: 5, question: 'What alternatives do users use today?', hint: 'Competitors, workarounds, spreadsheets, doing nothing.', category: 'alternatives', weight: 0.8 },
        { id: 6, question: 'What evidence do you have that this is a real problem?', hint: 'Interviews, surveys, waitlist, usage data, inbound demand.', category: 'evidence', weight: 0.8 },
        { id: 7, question: 'What is the core insight that others miss?', hint: 'What did you learn that changes the approach?', category: 'insight', weight: 0.7 },
        { id: 8, question: 'What is the smallest measurable outcome to prove the problem?', hint: 'Define a metric you can improve.', category: 'metric', weight: 0.8 },
        { id: 9, question: 'What constraints make this problem hard to solve?', hint: 'Regulatory, technical, workflow, timing.', category: 'constraints', weight: 0.9 },
        { id: 10, question: 'Why are you the right team to solve this problem?', hint: 'Unfair advantage: access, domain, distribution.', category: 'advantage', weight: 0.7 }
      ];

    case 'solution':
      return [
        { id: 1, question: 'What is the solution in one sentence?', hint: 'Explain like to a new user.', category: 'solution', weight: 1.0 },
        { id: 2, question: 'What are the top 3 user workflows your solution enables?', hint: 'List the steps a user takes.', category: 'workflow', weight: 1.0 },
        { id: 3, question: 'What is the key differentiator vs alternatives?', hint: 'Speed, accuracy, cost, UX, integration, trust.', category: 'differentiation', weight: 0.9 },
        { id: 4, question: 'What is your MVP scope (what is NOT included)?', hint: 'Define the smallest shippable product.', category: 'mvp', weight: 0.9 },
        { id: 5, question: 'What is the expected time-to-value for the user?', hint: 'How quickly will they see benefit?', category: 'value', weight: 0.8 },
        { id: 6, question: 'What evidence suggests the solution will work?', hint: 'Prototype feedback, experiments, pilots, demos.', category: 'evidence', weight: 0.8 },
        { id: 7, question: 'What is the biggest technical risk?', hint: 'Name it and how you will mitigate it.', category: 'risk', weight: 0.7 },
        { id: 8, question: 'How will you measure solution success?', hint: 'Define 1-3 KPIs.', category: 'kpi', weight: 0.8 },
        { id: 9, question: 'What integrations or dependencies are required?', hint: 'APIs, data sources, platforms.', category: 'dependencies', weight: 0.9 },
        { id: 10, question: 'What user objections do you anticipate?', hint: 'Trust, switching costs, pricing, complexity.', category: 'objections', weight: 0.7 }
      ];

    case 'market':
      return [
        { id: 1, question: 'What market are you targeting?', hint: 'Define category + segment.', category: 'market', weight: 1.0 },
        { id: 2, question: 'What is your beachhead segment?', hint: 'The smallest segment to win first.', category: 'segment', weight: 1.0 },
        { id: 3, question: 'What is your TAM/SAM/SOM?', hint: 'Quantify with sources/assumptions.', category: 'sizing', weight: 0.9 },
        { id: 4, question: 'What is your distribution strategy?', hint: 'How will you reach users? (channels)', category: 'distribution', weight: 0.9 },
        { id: 5, question: 'What willingness-to-pay evidence do you have?', hint: 'Pricing tests, LOIs, preorders.', category: 'pricing', weight: 0.8 },
        { id: 6, question: 'Who are the key competitors and why will you win?', hint: 'Positioning and wedge.', category: 'competition', weight: 0.8 },
        { id: 7, question: 'What is your retention story?', hint: 'Why users come back / keep paying.', category: 'retention', weight: 0.7 },
        { id: 8, question: 'What is your go-to-market experiment plan?', hint: '3 experiments you will run.', category: 'experiments', weight: 0.8 },
        { id: 9, question: 'What are the main adoption barriers?', hint: 'Procurement, trust, data migration, habits.', category: 'barriers', weight: 0.9 },
        { id: 10, question: 'What is the timeline to first revenue or traction?', hint: 'Be realistic with milestones.', category: 'timeline', weight: 0.7 }
      ];

    case 'business':
      return [
        { id: 1, question: 'How do you make money (business model)?', hint: 'Subscription, usage, marketplace, services, etc.', category: 'model', weight: 1.0 },
        { id: 2, question: 'What is your pricing strategy?', hint: 'Tiers, value metric, packaging.', category: 'pricing', weight: 1.0 },
        { id: 3, question: 'What is your expected CAC and why?', hint: 'Estimate based on channel assumptions.', category: 'cac', weight: 0.9 },
        { id: 4, question: 'What is your expected LTV and why?', hint: 'Retention + ARPA + gross margin.', category: 'ltv', weight: 0.9 },
        { id: 5, question: 'What is your gross margin model?', hint: 'COGS: hosting, support, labor, vendor fees.', category: 'margins', weight: 0.8 },
        { id: 6, question: 'What are the key unit economics risks?', hint: 'High CAC, low retention, heavy support.', category: 'risk', weight: 0.8 },
        { id: 7, question: 'What is your operational plan for delivery?', hint: 'How you will fulfill and support users.', category: 'ops', weight: 0.7 },
        { id: 8, question: 'What metrics will you report monthly?', hint: 'MRR, churn, activation, revenue, CAC.', category: 'metrics', weight: 0.8 },
        { id: 9, question: 'What is your go-to-market scaling plan?', hint: 'What happens after the first 10 customers?', category: 'scale', weight: 0.9 },
        { id: 10, question: 'What is your 12-month milestone plan?', hint: 'Product, GTM, revenue, team.', category: 'plan', weight: 0.7 }
      ];

    default:
      return null;
  }
};

const assertStageKey = (stageKey) => {
  if (!VALIDATION_STAGE_KEYS.includes(stageKey)) {
    const err = new Error('Invalid stage');
    err.statusCode = 400;
    throw err;
  }
};

const recomputeTotalValidationScore = (startup) => {
  const stageRecords = VALIDATION_STAGE_KEYS.map(k => startup.validationStages?.[k]);
  const allCompleted = stageRecords.every(v => v && v.completedAt);
  if (!allCompleted) return 0;

  const scores = stageRecords.map(v => v.score || 0);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
};

const submitStageValidation = async (stageKey, req, res) => {
  try {
    assertStageKey(stageKey);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        message: 'Invalid request format',
        nextSteps: 'Please submit answers array with { id, answer } objects'
      });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({
        message: 'No startup found',
        nextSteps: 'Create a startup first'
      });
    }

    const stageOrder = VALIDATION_STAGE_ORDER[stageKey];

    // Enforce sequential gating
    if (stageOrder > (startup.currentStage || 1)) {
      return res.status(403).json({
        message: 'Access denied',
        reason: `Stage ${stageOrder} is locked`,
        nextSteps: `Complete and validate Stage ${startup.currentStage || 1} first`
      });
    }

    if (stageOrder > 1) {
      const prevKey = VALIDATION_STAGE_KEYS[stageOrder - 2];
      const prev = startup.validationStages?.[prevKey];
      if (!prev?.isValidated) {
        return res.status(403).json({
          message: 'Access denied',
          reason: `${VALIDATION_STAGE_TITLES[prevKey]} must be validated first`,
          nextSteps: `Complete ${VALIDATION_STAGE_TITLES[prevKey]} (score ≥ 70%) to unlock this stage`
        });
      }
    }

    // GEMINI AI VALIDATION
    console.log(`🤖 Processing ${answers.length} answers for ${stageKey} using Gemini AI...`);
    const questions = getStageQuestions(stageKey);
    const { processedAnswers, stageScore, overallFeedback } = await batchValidateStage(questions, answers);
    console.log(`✓ Gemini AI scored ${stageKey}: ${stageScore}%`);

    const isValidated = stageScore >= 70;
    const completedAt = new Date();

    startup.validationStages = startup.validationStages || {};
    startup.validationStages[stageKey] = {
      score: stageScore,
      isValidated,
      answers: processedAnswers,
      completedAt,
      overallFeedback
    };

    // Backwards compatibility
    if (stageKey === 'idea') {
      startup.isIdeaValidated = isValidated;
      startup.ideaValidationAnswers = processedAnswers;
      startup.ideaValidationCompletedAt = completedAt;
    }

    // Unlock milestone if validated
    if (isValidated) {
      const title = VALIDATION_STAGE_TITLES[stageKey];
      const milestone = startup.milestones?.find(m => m.order === stageOrder) ||
        startup.milestones?.find(m => new RegExp(title, 'i').test(m.title || ''));

      if (milestone) {
        milestone.isCompleted = true;
        milestone.verified = true;
      }

      const MAX_STAGE = 5;
      const newStage = Math.min(MAX_STAGE, stageOrder + 1);
      if (newStage > (startup.currentStage || 1)) {
        startup.currentStage = newStage;
        
        // Send notification for unlocked stage
        if (newStage <= MAX_STAGE) {
          const nextKey = VALIDATION_STAGE_KEYS[newStage - 1];
          if (nextKey) {
            await notifyStageUnlocked(req.user.id, nextKey, startup._id);
          }
        }
      }
    }

    startup.validationScore = recomputeTotalValidationScore(startup);
    startup.updatedAt = completedAt;
    await startup.save();

    await Log.create({
      userId: req.user.id,
      action: `${stageKey}_validation_completed`,
      details: {
        stage: stageKey,
        stageScore,
        totalValidationScore: startup.validationScore,
        isValidated,
        questionsAnswered: answers.length,
        startupId: startup._id,
        aiEngine: 'gemini'
      }
    });

    // Send notification
    await notifyValidationComplete(req.user.id, stageKey, stageScore, isValidated, startup._id);

    res.json({
      success: true,
      stage: stageKey,
      message: isValidated
        ? `🎉 Congratulations! ${VALIDATION_STAGE_TITLES[stageKey]} is VALIDATED (${stageScore}%)`
        : `${VALIDATION_STAGE_TITLES[stageKey]} score is ${stageScore}%. Need 70% to validate.`,
      validationScore: stageScore,
      totalValidationScore: startup.validationScore,
      isValidated,
      overallFeedback,
      aiGenerated: true
    });
  } catch (error) {
    console.error('Error validating stage:', error);
    res.status(error.statusCode || 500).json({
      message: 'Server error during validation',
      error: error.message
    });
  }
};

const getStageStatus = async (stageKey, req, res) => {
  try {
    assertStageKey(stageKey);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const startup = await Startup.findOne({ founderId: req.user.id });
    if (!startup) {
      return res.status(404).json({ message: 'No startup found' });
    }

    const stageRecord = startup.validationStages?.[stageKey];

    const fallbackIdea = stageKey === 'idea'
      ? {
          isValidated: startup.isIdeaValidated,
          score: startup.validationScore,
          completedAt: startup.ideaValidationCompletedAt,
          answers: startup.ideaValidationAnswers
        }
      : null;

    const rec = stageRecord || fallbackIdea;

    res.json({
      success: true,
      status: {
        stage: stageKey,
        isValidated: rec?.isValidated || false,
        validationScore: rec?.score ?? 0,
        totalValidationScore: startup.validationScore,
        completedAt: rec?.completedAt,
        answerCount: (rec?.answers || []).length,
        previousAnswers: rec?.answers || [],
        overallFeedback: rec?.overallFeedback
      }
    });
  } catch (error) {
    console.error('Error fetching validation status:', error);
    res.status(error.statusCode || 500).json({ message: 'Failed to fetch validation status' });
  }
};

const getStageQuestionsHandler = (stageKey, req, res) => {
  try {
    assertStageKey(stageKey);
    const questions = getStageQuestions(stageKey);

    res.json({
      success: true,
      stage: stageKey,
      questions,
      message: `Answer these questions to validate: ${VALIDATION_STAGE_TITLES[stageKey]}`,
      note: 'Your answers will be scored by Gemini AI. No manual scoring required.'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: 'Failed to load questions' });
  }
};

// Generic endpoints for all 5 stages
router.get('/validate-stage/:stageKey/questions', protect, (req, res) => {
  return getStageQuestionsHandler(req.params.stageKey, req, res);
});

router.post('/validate-stage/:stageKey', protect, (req, res) => {
  return submitStageValidation(req.params.stageKey, req, res);
});

router.get('/validate-stage/:stageKey/status', protect, (req, res) => {
  return getStageStatus(req.params.stageKey, req, res);
});

// Backwards-compatible idea routes
router.get('/validate-idea/questions', protect, (req, res) => {
  return getStageQuestionsHandler('idea', req, res);
});

router.post('/validate-idea', protect, (req, res) => {
  return submitStageValidation('idea', req, res);
});

router.get('/validate-idea/status', protect, (req, res) => {
  return getStageStatus('idea', req, res);
});

module.exports = router;