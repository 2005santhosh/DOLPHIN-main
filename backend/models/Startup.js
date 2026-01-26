const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema({
  milestoneId: { type: mongoose.Schema.Types.ObjectId },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' },
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String },
  evidence: { type: String } // URL or file path
});

const investorInterestSchema = new mongoose.Schema({
  investorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String },
  expressedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['expressed', 'contacted', 'meeting', 'interested', 'passed'], default: 'expressed' }
});

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  order: { type: Number, required: true },
  taskSubmissions: [taskSubmissionSchema],
  submissionStatus: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' }
});

const ideaValidationSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String },
  score: { type: Number, min: 0, max: 100 }, // 0-100% score
  weight: { type: Number, min: 0.5, max: 1.0, default: 1.0 }, // Weight in calculation
  category: { type: String } // e.g., "problem", "market", "feasibility"
});

// Generic per-stage validation record (we fully implement stage "idea" today, but structure supports all stages).
const stageValidationSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 100, default: 0 },
  isValidated: { type: Boolean, default: false },
  answers: [ideaValidationSchema],
  completedAt: { type: Date }
}, { _id: false });

const startupSchema = new mongoose.Schema({
  founderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  thesis: { type: String, required: true },
  problemStatement: { type: String },
  targetUsers: { type: String },
  industry: { type: String },

  // Validation roadmap is 5 stages.
  currentStage: { type: Number, default: 1 },
  milestones: [milestoneSchema],

  // Overall (total) validation score across completed stages.
  // Investor dashboard uses this field (>= 70 means "potential good startup").
  validationScore: { type: Number, default: 0 },

  // Per-stage validation scores (future stages can be added without migrations).
  validationStages: {
    idea: stageValidationSchema,
    problem: stageValidationSchema,
    solution: stageValidationSchema,
    market: stageValidationSchema,
    business: stageValidationSchema
  },

  // Backwards-compatible fields for the existing Idea Validation UI.
  isIdeaValidated: { type: Boolean, default: false }, // True if Idea Validation score >= 70
  ideaValidationAnswers: [ideaValidationSchema],
  ideaValidationCompletedAt: { type: Date },

  investorInterests: [investorInterestSchema],
  auditLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Log' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Startup', startupSchema);