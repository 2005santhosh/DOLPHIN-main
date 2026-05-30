/**
 * VerificationPayment — dedicated collection for all verification payment records.
 * Keeps User model clean and provides full audit trail.
 */
const mongoose = require('mongoose');

const verificationPaymentSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cashfreeOrderId:    { type: String, required: true },
  cashfreePaymentId:  { type: String, default: null },
  paymentSessionId:   { type: String, default: null },
  idempotencyKey:     { type: String, required: true },

  orderAmount:        { type: Number, required: true },
  orderCurrency:      { type: String, default: 'INR' },
  purpose:            { type: String, default: 'Dolphin Verified Badge' },
  gateway:            { type: String, default: 'cashfree' },

  // State machine: created → pending → paid | failed | expired
  status: {
    type: String,
    enum: ['created', 'pending', 'paid', 'failed', 'expired'],
    default: 'created',
    index: true,
  },

  paidAt:             { type: Date, default: null },
  expiresAt:          { type: Date, default: null },   // order TTL (not badge expiry)
  verifiedUntil:      { type: Date, default: null },   // badge expiry set on payment success

  // Webhook tracking
  lastWebhookAt:      { type: Date, default: null },
  processedEventIds:  [{ type: String }],              // idempotency for webhook events

  // Reminder/expiry notification tracking
  reminderSentAt:     { type: Date, default: null },
  expiredNotifiedAt:  { type: Date, default: null },

  failureReason:      { type: String, default: null },
  metadata:           { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Indexes for efficient queries
verificationPaymentSchema.index({ userId: 1, status: 1 });
verificationPaymentSchema.index({ cashfreeOrderId: 1 }, { unique: true });
verificationPaymentSchema.index({ idempotencyKey: 1 }, { unique: true });
verificationPaymentSchema.index({ verifiedUntil: 1 });

module.exports = mongoose.model('VerificationPayment', verificationPaymentSchema);
