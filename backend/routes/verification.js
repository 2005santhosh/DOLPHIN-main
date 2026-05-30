/**
 * routes/verification.js
 * Production-grade Cashfree Checkout integration for Dolphin Verified Badge.
 *
 * Architecture:
 *   POST /create-order  → backend creates Cashfree order → returns payment_session_id
 *   Frontend opens Cashfree Checkout with payment_session_id
 *   POST /webhook       → Cashfree notifies backend → badge activated
 *   GET  /status        → frontend polls for current verification state
 *
 * Security:
 *   - Amount fixed server-side, never trusted from client
 *   - Webhook signature verified with HMAC-SHA256 + timing-safe compare
 *   - Replay protection via timestamp tolerance
 *   - Idempotency on order creation and webhook processing
 *   - Founder verified users permanently protected
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const User     = require('../models/User');
const VerificationPayment = require('../models/VerificationPayment');
const sendEmail = require('../utils/sendEmail');
const { createNotification } = require('../services/notificationService');

// ─── Config ───────────────────────────────────────────────────────────────────
const CF_APP_ID    = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET    = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV       = (process.env.CASHFREE_ENV        || 'production').trim();
const CF_API_VER   = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();
const AMOUNT       = Number(process.env.VERIFICATION_AMOUNT || 99);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.dolphinorg.in').trim();
const BACKEND_URL  = (process.env.BACKEND_URL  || 'https://api.dolphinorg.in').trim();
// Reject webhooks older than this many seconds (replay protection)
const WEBHOOK_TOLERANCE_SEC = Number(process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS || 300);
// Pending order TTL in minutes — after this, a new order can be created
const PENDING_TTL_MIN = Number(process.env.VERIFICATION_PENDING_TTL_MINUTES || 30);

const CF_BASE = CF_ENV === 'sandbox'
  ? 'https://sandbox.cashfree.com/pg'
  : 'https://api.cashfree.com/pg';

// Rate limiter for order creation
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { message: 'Too many payment attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Is the user's badge currently active? */
function isBadgeActive(user) {
  if (!user.isVerified) return false;
  // Founder verified = lifetime, never expires
  if (user.isFounderVerified) return true;
  // Legacy: verified before monthly system (no verifiedUntil) = treat as founder/lifetime
  if (!user.verifiedUntil) return true;
  // Monthly paid badge — check expiry
  return new Date(user.verifiedUntil) > new Date();
}

/** Auto-upgrade legacy verified users to isFounderVerified on first status check */
async function ensureFounderBadgeForLegacyUsers(user) {
  // Any user with isVerified=true but isFounderVerified=false and no verifiedUntil
  // was verified before the monthly payment system — give them lifetime badge
  if (user.isVerified && !user.isFounderVerified && !user.verifiedUntil) {
    user.isFounderVerified = true;
    await user.save();
    console.log(`[Verification] Auto-upgraded legacy verified user ${user.email} to isFounderVerified`);
    return true;
  }
  return false;
}
function canPurchase(user) {
  if (user.isFounderVerified) return { ok: false, reason: 'founder_verified' };
  if (isBadgeActive(user)) return { ok: false, reason: 'already_active' };
  return { ok: true };
}

/** Timing-safe HMAC-SHA256 signature verification */
function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!CF_SECRET || !signature || !timestamp) return false;
  const payload = timestamp + rawBody;
  const expected = crypto
    .createHmac('sha256', CF_SECRET)
    .update(payload)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'base64'),
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}

/** Call Cashfree Create Order API */
async function createCashfreeOrder({ orderId, amount, customerId, customerName, customerPhone, customerEmail }) {
  const frontendBase = FRONTEND_URL.startsWith('http') ? FRONTEND_URL : `https://${FRONTEND_URL}`;

  const payload = {
    order_id:       orderId,
    order_amount:   amount,
    order_currency: 'INR',
    order_note:     'Dolphin Verified Badge – ₹99/month',
    customer_details: {
      customer_id:    customerId,
      customer_name:  customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
    },
    order_meta: {
      return_url:  `${frontendBase}/dashboard?order_id={order_id}&order_status={order_status}`,
      notify_url:  `${BACKEND_URL}/api/verification/webhook`,
    },
  };

  const res = await fetch(`${CF_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-version':   CF_API_VER,
      'x-client-id':     CF_APP_ID,
      'x-client-secret': CF_SECRET,
      'x-idempotency-key': orderId, // idempotent order creation
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Cashfree order creation failed'), { cfData: data, status: res.status });
  return data; // { order_id, payment_session_id, order_status, ... }
}

/** Verify payment status server-to-server (used as extra confirmation) */
async function getCashfreeOrderStatus(orderId) {
  const res = await fetch(`${CF_BASE}/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'x-api-version':   CF_API_VER,
      'x-client-id':     CF_APP_ID,
      'x-client-secret': CF_SECRET,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch order status');
  return data;
}

/** Activate badge and send notifications */
async function activateBadge(user, payment, cashfreePaymentId) {
  const now          = new Date();
  const verifiedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Update payment record
  payment.status           = 'paid';
  payment.cashfreePaymentId = cashfreePaymentId || '';
  payment.paidAt           = now;
  payment.verifiedUntil    = verifiedUntil;
  await payment.save();

  // Update user
  user.isVerified    = true;
  user.verifiedAt    = now;
  user.verifiedUntil = verifiedUntil;
  user.activeVerificationPaymentId = payment._id;
  await user.save();

  console.log(`[Verification] ✅ ${user.email} verified until ${verifiedUntil.toISOString()}`);

  // In-app notification (fire-and-forget)
  createNotification({
    userId:    user._id,
    type:      'SUCCESS',
    title:     '🎉 Profile Verified!',
    message:   `Your Dolphin profile is now verified until ${verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Enjoy boosted visibility!`,
    priority:  'high',
    actionUrl: '#settings',
    actionText: 'View Badge',
  }).catch(() => {});

  // Email (fire-and-forget)
  sendEmail({
    email:   user.email,
    subject: '🎉 Your Dolphin profile is now Verified!',
    message: buildVerifiedEmail(user, verifiedUntil),
  }).catch(e => console.error('[Verification] Email error:', e));
}

// ─── POST /api/verification/create-order ─────────────────────────────────────
router.post('/create-order', protect, createOrderLimiter, async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;

    // Input validation
    if (!fullName?.trim()) return res.status(400).json({ message: 'Full name is required' });
    if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, '')))
      return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number' });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Enter a valid email address' });

    if (!CF_APP_ID || !CF_SECRET)
      return res.status(503).json({ message: 'Payment service not configured. Contact support@pacificdev.in' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Eligibility checks
    const { ok, reason } = canPurchase(user);
    if (!ok) {
      if (reason === 'founder_verified')
        return res.status(400).json({ message: 'You have a lifetime verified badge as an early supporter!' });
      if (reason === 'already_active')
        return res.status(400).json({ message: 'Your verified badge is still active.', verifiedUntil: user.verifiedUntil });
    }

    // Check for a valid pending order (within TTL) — reuse instead of creating duplicate
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MIN * 60 * 1000);
    const existingPending = await VerificationPayment.findOne({
      userId: user._id,
      status: { $in: ['created', 'pending'] },
      createdAt: { $gte: pendingCutoff },
    }).sort({ createdAt: -1 });

    if (existingPending?.paymentSessionId) {
      return res.json({
        success:           true,
        order_id:          existingPending.cashfreeOrderId,
        payment_session_id: existingPending.paymentSessionId,
        reused:            true,
      });
    }

    // Generate unique order ID and idempotency key
    const shortUserId = req.user._id.toString().slice(-8);
    const ts          = Date.now().toString(36);
    const orderId     = `dlphn_${shortUserId}_${ts}`;
    const idempotencyKey = `${req.user._id}_${ts}`;

    // Create Cashfree order (server-side)
    let cfOrder;
    try {
      cfOrder = await createCashfreeOrder({
        orderId,
        amount:        AMOUNT,
        customerId:    req.user._id.toString(),
        customerName:  fullName.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
      });
    } catch (cfErr) {
      console.error('[Verification] Cashfree order error:', cfErr.message, cfErr.cfData);
      return res.status(502).json({
        message: cfErr.cfData?.message || `Payment gateway error. Please try again or contact support@pacificdev.in`,
      });
    }

    // Persist payment record
    const payment = await VerificationPayment.create({
      userId:           user._id,
      cashfreeOrderId:  cfOrder.order_id,
      paymentSessionId: cfOrder.payment_session_id,
      idempotencyKey,
      orderAmount:      AMOUNT,
      status:           'pending',
      expiresAt:        new Date(Date.now() + PENDING_TTL_MIN * 60 * 1000),
    });

    res.json({
      success:           true,
      order_id:          cfOrder.order_id,
      payment_session_id: cfOrder.payment_session_id,
    });
  } catch (err) {
    console.error('[Verification] create-order error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/verification/webhook ──────────────────────────────────────────
// Raw body required for signature verification — bypass global JSON parser
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody  = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);
    const signature = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];

    // 1. Signature verification
    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.warn('[Webhook] Invalid or missing signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // 2. Replay protection — reject stale webhooks
    const webhookAge = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (webhookAge > WEBHOOK_TOLERANCE_SEC) {
      console.warn(`[Webhook] Stale webhook rejected (age: ${webhookAge}s)`);
      return res.status(400).json({ message: 'Webhook timestamp too old' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type || '';
    const eventId   = event.data?.payment?.cf_payment_id || event.data?.order?.cf_order_id || '';

    // 3. Only process terminal success events
    const SUCCESS_EVENTS = ['PAYMENT_SUCCESS_WEBHOOK', 'ORDER_PAID'];
    if (!SUCCESS_EVENTS.includes(eventType)) {
      // Acknowledge non-success events without processing
      return res.status(200).json({ received: true, processed: false });
    }

    const cfOrderId    = event.data?.order?.order_id || event.data?.payment?.order_id;
    const cfPaymentId  = event.data?.payment?.cf_payment_id;
    const orderStatus  = event.data?.order?.order_status || event.data?.payment?.payment_status;

    if (!cfOrderId) {
      console.warn('[Webhook] No order_id in event');
      return res.status(200).json({ received: true });
    }

    // 4. Find payment record
    const payment = await VerificationPayment.findOne({ cashfreeOrderId: cfOrderId });
    if (!payment) {
      console.warn(`[Webhook] No payment record for order ${cfOrderId}`);
      return res.status(200).json({ received: true });
    }

    // 5. Idempotency — skip if already processed
    if (payment.status === 'paid') {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }
    if (eventId && payment.processedEventIds.includes(eventId)) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    // 6. Mark event as seen
    payment.lastWebhookAt = new Date();
    if (eventId) payment.processedEventIds.push(eventId);

    // 7. Verify payment state is genuinely successful
    // Accept PAID / SUCCESS from webhook; optionally do S2S verification
    const isSuccess = ['PAID', 'SUCCESS'].includes((orderStatus || '').toUpperCase());
    if (!isSuccess) {
      payment.status = 'failed';
      payment.failureReason = `Webhook status: ${orderStatus}`;
      await payment.save();
      return res.status(200).json({ received: true, processed: false });
    }

    // 8. Optional: server-to-server order status verification
    try {
      const cfOrderData = await getCashfreeOrderStatus(cfOrderId);
      const s2sStatus = (cfOrderData.order_status || '').toUpperCase();
      if (s2sStatus !== 'PAID') {
        console.warn(`[Webhook] S2S verification mismatch for ${cfOrderId}: ${s2sStatus}`);
        payment.status = 'failed';
        payment.failureReason = `S2S status: ${s2sStatus}`;
        await payment.save();
        return res.status(200).json({ received: true, processed: false });
      }
    } catch (s2sErr) {
      // S2S check failed — proceed with webhook data (log for monitoring)
      console.error('[Webhook] S2S verification error (proceeding):', s2sErr.message);
    }

    // 9. Find user and activate badge
    const user = await User.findById(payment.userId);
    if (!user) {
      console.error(`[Webhook] User not found for payment ${payment._id}`);
      return res.status(200).json({ received: true });
    }

    // Founder verified users are permanently protected
    if (user.isFounderVerified) {
      return res.status(200).json({ received: true, founderProtected: true });
    }

    // Activate badge
    await activateBadge(user, payment, cfPaymentId);

    res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err);
    // Always return 200 to prevent Cashfree retries on server errors
    res.status(200).json({ received: true, error: 'internal' });
  }
});

// ─── GET /api/verification/status ────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('isVerified verifiedAt verifiedUntil isFounderVerified activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-upgrade legacy verified users to lifetime founder badge
    const wasUpgraded = await ensureFounderBadgeForLegacyUsers(user);

    // Use in-memory value (may have just been upgraded above)
    const effectiveIsFounderVerified = user.isFounderVerified || false;
    const active = isBadgeActive(user);

    // Auto-expire: clear stale isVerified flag (only for monthly paid badges)
    if (user.isVerified && !active && !user.isFounderVerified) {
      user.isVerified = false;
      await user.save();
    }

    // Check for pending payment (only relevant if not already verified)
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MIN * 60 * 1000);
    const pendingPayment = active ? null : await VerificationPayment.findOne({
      userId: user._id,
      status: { $in: ['created', 'pending'] },
      createdAt: { $gte: pendingCutoff },
    }).select('cashfreeOrderId status createdAt').lean();

    const daysLeft = (user.verifiedUntil && !user.isFounderVerified)
      ? Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000))
      : null;

    res.json({
      isVerified:        active,
      isFounderVerified: effectiveIsFounderVerified,
      verifiedAt:        user.verifiedAt,
      verifiedUntil:     effectiveIsFounderVerified ? null : user.verifiedUntil,
      daysLeft,
      activePlan:        active ? (effectiveIsFounderVerified ? 'lifetime' : 'monthly') : null,
      pendingPayment:    pendingPayment ? {
        orderId:   pendingPayment.cashfreeOrderId,
        status:    pendingPayment.status,
        createdAt: pendingPayment.createdAt,
      } : null,
    });
  } catch (err) {
    console.error('[Verification] status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/verification/refresh-status ────────────────────────────────────
// Called by frontend after returning from Cashfree checkout.
// Actively checks Cashfree order status server-side and activates badge if paid.
// This handles the case where the webhook hasn't fired yet.
router.get('/refresh-status', protect, async (req, res) => {
  try {
    const { order_id } = req.query;

    const user = await User.findById(req.user._id)
      .select('isVerified verifiedAt verifiedUntil isFounderVerified activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-upgrade legacy users
    await ensureFounderBadgeForLegacyUsers(user);

    // If already verified, just return current status
    if (isBadgeActive(user)) {
      return res.json({
        isVerified: true,
        isFounderVerified: user.isFounderVerified || false,
        verifiedAt: user.verifiedAt,
        verifiedUntil: user.isFounderVerified ? null : user.verifiedUntil,
        justActivated: false,
      });
    }

    // If order_id provided, check that specific order
    if (order_id) {
      // Security: ensure this order belongs to the logged-in user
      const payment = await VerificationPayment.findOne({
        cashfreeOrderId: order_id,
        userId: req.user._id, // CRITICAL: prevent cross-user activation
      });

      if (!payment) {
        return res.json({ isVerified: false, message: 'Order not found for this user' });
      }

      // Already paid — activate if not yet done
      if (payment.status === 'paid' && !isBadgeActive(user)) {
        await activateBadge(user, payment, payment.cashfreePaymentId);
        return res.json({
          isVerified: true,
          isFounderVerified: false,
          verifiedAt: user.verifiedAt,
          verifiedUntil: user.verifiedUntil,
          justActivated: true,
        });
      }

      // Check Cashfree order status server-to-server
      if (payment.status !== 'paid' && CF_APP_ID && CF_SECRET) {
        try {
          const cfOrder = await getCashfreeOrderStatus(order_id);
          const orderStatus = (cfOrder.order_status || '').toUpperCase();

          if (orderStatus === 'PAID') {
            // Get payment ID from Cashfree payments list
            let cfPaymentId = '';
            try {
              const paymentsRes = await fetch(`${CF_BASE}/orders/${order_id}/payments`, {
                headers: {
                  'x-api-version':   CF_API_VER,
                  'x-client-id':     CF_APP_ID,
                  'x-client-secret': CF_SECRET,
                },
              });
              const paymentsData = await paymentsRes.json();
              const successPayment = Array.isArray(paymentsData)
                ? paymentsData.find(p => p.payment_status === 'SUCCESS')
                : null;
              cfPaymentId = successPayment?.cf_payment_id || '';
            } catch { /* ignore — activate anyway */ }

            await activateBadge(user, payment, cfPaymentId);
            return res.json({
              isVerified: true,
              isFounderVerified: false,
              verifiedAt: user.verifiedAt,
              verifiedUntil: user.verifiedUntil,
              justActivated: true,
            });
          }

          // Payment not yet confirmed
          return res.json({
            isVerified: false,
            orderStatus,
            message: orderStatus === 'ACTIVE' ? 'Payment pending confirmation' : `Order status: ${orderStatus}`,
          });
        } catch (cfErr) {
          console.error('[refresh-status] Cashfree check error:', cfErr.message);
        }
      }
    }

    // No order_id or couldn't confirm — return current status
    res.json({ isVerified: false });
  } catch (err) {
    console.error('[refresh-status] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
async function processVerificationExpiry() {
  const now = new Date();

  // 1. Expire paid badges whose verifiedUntil has passed
  const expiredUsers = await User.find({
    isVerified:        true,
    isFounderVerified: { $ne: true },
    verifiedUntil:     { $lt: now },
  }).select('_id name email verifiedUntil');

  for (const u of expiredUsers) {
    await User.findByIdAndUpdate(u._id, { isVerified: false });

    createNotification({
      userId:    u._id,
      type:      'WARNING',
      title:     'Verified Badge Expired',
      message:   'Your Dolphin verified badge has expired. Renew for ₹99/month to keep your boosted visibility.',
      priority:  'high',
      actionUrl: '#settings',
      actionText: 'Renew Now',
    }).catch(() => {});

    sendEmail({
      email:   u.email,
      subject: '⚠️ Your Dolphin Verified Badge has expired',
      message: buildExpiredEmail(u),
    }).catch(() => {});
  }

  // 2. Send 2-day reminder (exactly once per badge cycle)
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringSoon = await User.find({
    isVerified:        true,
    isFounderVerified: { $ne: true },
    verifiedUntil:     { $gte: twoDaysFromNow, $lt: threeDaysFromNow },
  }).select('_id name email verifiedUntil activeVerificationPaymentId');

  for (const u of expiringSoon) {
    // Check if reminder already sent for this badge cycle
    if (u.activeVerificationPaymentId) {
      const payment = await VerificationPayment.findById(u.activeVerificationPaymentId)
        .select('reminderSentAt');
      if (payment?.reminderSentAt) continue; // already reminded

      // Mark reminder sent
      await VerificationPayment.findByIdAndUpdate(u.activeVerificationPaymentId, {
        reminderSentAt: now,
      });
    }

    createNotification({
      userId:    u._id,
      type:      'WARNING',
      title:     '⏰ Verified Badge Expiring in 2 Days',
      message:   `Your Dolphin verified badge expires on ${new Date(u.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Renew now to keep your boosted visibility!`,
      priority:  'high',
      actionUrl: '#settings',
      actionText: 'Renew Badge',
    }).catch(() => {});

    sendEmail({
      email:   u.email,
      subject: '⏰ Your Dolphin Verified Badge expires in 2 days',
      message: buildReminderEmail(u),
    }).catch(() => {});
  }

  console.log(`[Verification] Cron: expired=${expiredUsers.length}, reminded=${expiringSoon.length}`);
  return { expired: expiredUsers.length, reminded: expiringSoon.length };
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildVerifiedEmail(user, verifiedUntil) {
  const expiryStr = verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
    <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
    <div style="text-align:center;margin-bottom:24px;"><div style="width:72px;height:72px;background:linear-gradient(135deg,#84CC16,#16A34A);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;">✓</div></div>
    <h2 style="color:#111827;text-align:center;">Your profile is now Verified!</h2>
    <p style="color:#374151;line-height:1.7;text-align:center;">Hi <strong>${user.name}</strong>, your Dolphin profile has been verified until <strong>${expiryStr}</strong>.</p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:20px;margin:20px 0;">
      <h3 style="color:#065F46;margin:0 0 12px;">What you've unlocked:</h3>
      <ul style="color:#374151;line-height:2;margin:0;padding-left:20px;">
        <li>✅ Verified badge beside your profile name</li>
        <li>📈 Boosted profile visibility in searches</li>
        <li>⭐ Priority visibility in posts and networking feed</li>
        <li>🤝 Higher chances of getting connections</li>
        <li>🔒 Better trust and credibility</li>
      </ul>
    </div>
    <p style="color:#6B7280;font-size:0.875rem;text-align:center;">Your badge is valid for 30 days. Renew anytime from Settings.</p>
    <div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">View Your Profile</a></div>
    <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
  </div>`;
}

function buildReminderEmail(user) {
  const expiryStr = new Date(user.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
    <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:2.5rem;margin-bottom:8px;">⏰</div>
      <h2 style="color:#92400E;margin:0;">Your Verified Badge expires in 2 days</h2>
      <p style="color:#92400E;margin:8px 0 0;">Expiry date: <strong>${expiryStr}</strong></p>
    </div>
    <p style="color:#374151;line-height:1.7;">Hi <strong>${user.name}</strong>, your Dolphin verified badge is expiring soon. Renew for just <strong>₹99/month</strong> to keep your boosted visibility.</p>
    <div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a></div>
    <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
  </div>`;
}

function buildExpiredEmail(user) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
    <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:2.5rem;margin-bottom:8px;">😢</div>
      <h2 style="color:#DC2626;margin:0;">Your Verified Badge has expired</h2>
    </div>
    <p style="color:#374151;line-height:1.7;">Hi <strong>${user.name}</strong>, your Dolphin verified badge has expired. Renew for just <strong>₹99/month</strong> to restore your boosted visibility.</p>
    <div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a></div>
    <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
  </div>`;
}

module.exports = router;
module.exports.processVerificationExpiry = processVerificationExpiry;
