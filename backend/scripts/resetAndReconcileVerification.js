/**
 * resetAndReconcileVerification.js
 * Run ONCE to:
 *   1. Strip all existing verified badges from all users
 *   2. Re-apply ONLY from confirmed successful Cashfree payments
 *
 * Usage:
 *   node backend/scripts/resetAndReconcileVerification.js
 *
 * Safe to re-run (idempotent).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const VerificationPayment = require('../models/VerificationPayment');

const CF_APP_ID  = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET  = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV     = (process.env.CASHFREE_ENV        || 'production').trim();
const CF_API_VER = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();
const CF_BASE    = CF_ENV === 'sandbox' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg';

async function getCashfreeOrderPayments(orderId) {
  try {
    const res = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
      headers: { 'x-api-version': CF_API_VER, 'x-client-id': CF_APP_ID, 'x-client-secret': CF_SECRET },
    });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // ── STEP 1: Reset ALL users ──────────────────────────────────────────────
  console.log('\n[Step 1] Resetting all user verification fields...');
  const resetResult = await User.updateMany({}, {
    $set: {
      isVerified:        false,
      isFounderVerified: false,
      isAdminVerified:   false,
      verifiedSource:    null,
      verifiedAt:        null,
      verifiedUntil:     null,
      activeVerificationPaymentId: null,
    },
  });
  console.log(`  Reset ${resetResult.modifiedCount} users`);

  // ── STEP 2: Reconcile from paid payment records ──────────────────────────
  console.log('\n[Step 2] Reconciling from VerificationPayment records...');
  const paidPayments = await VerificationPayment.find({ status: 'paid' })
    .sort({ paidAt: -1 });

  console.log(`  Found ${paidPayments.length} paid payment records`);

  const processedUserIds = new Set();
  let activated = 0;
  let skipped = 0;
  let s2sVerified = 0;

  for (const payment of paidPayments) {
    const userId = payment.userId?.toString();
    if (!userId) { skipped++; continue; }

    // Only process the most recent paid payment per user
    if (processedUserIds.has(userId)) { skipped++; continue; }
    processedUserIds.add(userId);

    // Determine verifiedUntil
    const paidAt = payment.paidAt || payment.updatedAt || new Date();
    let verifiedUntil = payment.verifiedUntil;
    if (!verifiedUntil) {
      verifiedUntil = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Skip if already expired
    if (new Date(verifiedUntil) <= new Date()) {
      console.log(`  SKIP (expired): ${payment.cashfreeOrderId}`);
      skipped++;
      continue;
    }

    // Optional: S2S verify with Cashfree if credentials available
    if (CF_APP_ID && CF_SECRET && payment.cashfreeOrderId) {
      const cfPayments = await getCashfreeOrderPayments(payment.cashfreeOrderId);
      const successPayment = cfPayments.find(p => (p.payment_status || '').toUpperCase() === 'SUCCESS');
      if (!successPayment) {
        console.log(`  SKIP (no SUCCESS in Cashfree): ${payment.cashfreeOrderId}`);
        skipped++;
        continue;
      }
      // Update payment record with CF payment ID if missing
      if (!payment.cashfreePaymentId && successPayment.cf_payment_id) {
        await VerificationPayment.findByIdAndUpdate(payment._id, {
          cashfreePaymentId: successPayment.cf_payment_id,
        });
      }
      s2sVerified++;
    }

    // Apply verification
    await User.findByIdAndUpdate(payment.userId, {
      $set: {
        isVerified:    true,
        verifiedSource: 'payment',
        verifiedAt:    paidAt,
        verifiedUntil,
        activeVerificationPaymentId: payment._id,
      },
    });

    console.log(`  ACTIVATED: userId=${userId} until=${verifiedUntil.toISOString().split('T')[0]}`);
    activated++;
  }

  console.log(`\n[Done] Activated: ${activated}, Skipped: ${skipped}, S2S verified: ${s2sVerified}`);
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
