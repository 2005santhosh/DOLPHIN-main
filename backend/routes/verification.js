/**
 * routes/verification.js — Unified verification system for Dolphin.
 * All profile types (founder, provider, investor) can be verified.
 * Three verification sources: founder-lifetime, admin-manual, paid-monthly.
 * Single source of truth: verificationService.isUserActuallyVerified(user)
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
const {
  isUserActuallyVerified,
  canPurchaseVerification,
  buildVerificationStatus,
  migrateLegacyVerifiedUsers,
} = require('../services/verificationService');

// ─── Config ───────────────────────────────────────────────────────────────────
const CF_APP_ID  = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET  = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV     = (process.env.CASHFREE_ENV        || 'production').trim();
const CF_API_VER = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();
const AMOUNT     = Number(process.env.VERIFICATION_AMOUNT || 99);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.dolphinorg.in').trim();
const BACKEND_URL  = (process.env.BACKEND_URL  || 'https://api.dolphinorg.in').trim();
const WEBHOOK_TOLERANCE_SEC = Number(process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS || 300);
const PENDING_TTL_MIN = Number(process.env.VERIFICATION_PENDING_TTL_MINUTES || 30);

const CF_BASE = CF_ENV === 'sandbox'
  ? 'https://sandbox.cashfree.com/pg'
  : 'https://api.cashfree.com/pg';

const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Too many payment attempts. Please wait 15 minutes.' },
});

// ─── Cashfree helpers ─────────────────────────────────────────────────────────
async function createCashfreeOrder({ orderId, amount, customerId, customerName, customerPhone, customerEmail }) {
  const base = FRONTEND_URL.startsWith('http') ? FRONTEND_URL : `https://${FRONTEND_URL}`;
  const payload = {
    order_id: orderId, order_amount: amount, order_currency: 'INR',
    order_note: 'Dolphin Verified Badge – ₹99/month',
    customer_details: { customer_id: customerId, customer_name: customerName, customer_phone: customerPhone, customer_email: customerEmail },
    order_meta: {
      return_url: `${base}/dashboard?order_id={order_id}&order_status={order_status}`,
      notify_url: `${BACKEND_URL}/api/verification/webhook`,
    },
  };
  const res = await fetch(`${CF_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-version': CF_API_VER, 'x-client-id': CF_APP_ID, 'x-client-secret': CF_SECRET, 'x-idempotency-key': orderId },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Cashfree order creation failed'), { cfData: data });
  return data;
}

async function getCashfreeOrderStatus(orderId) {
  const res = await fetch(`${CF_BASE}/orders/${orderId}`, {
    headers: { 'x-api-version': CF_API_VER, 'x-client-id': CF_APP_ID, 'x-client-secret': CF_SECRET },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to fetch order status');
  return data;
}

async function getCashfreeOrderPayments(orderId) {
  const res = await fetch(`${CF_BASE}/orders/${orderId}/payments`, {
    headers: { 'x-api-version': CF_API_VER, 'x-client-id': CF_APP_ID, 'x-client-secret': CF_SECRET },
  });
  const data = await res.json();
  if (!res.ok) return [];
  return Array.isArray(data) ? data : [];
}

function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!CF_SECRET || !signature || !timestamp) return false;
  const expected = crypto.createHmac('sha256', CF_SECRET).update(timestamp + rawBody).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(signature, 'base64')); }
  catch { return false; }
}

// ─── Badge activation ─────────────────────────────────────────────────────────
async function activatePaidBadge(user, payment, cashfreePaymentId) {
  // Idempotency: skip if already paid
  if (payment.status === 'paid') return false;

  const now = new Date();
  const verifiedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  payment.status = 'paid';
  payment.cashfreePaymentId = cashfreePaymentId || '';
  payment.paidAt = now;
  payment.verifiedUntil = verifiedUntil;
  await payment.save();

  user.isVerified = true;
  user.verifiedAt = now;
  user.verifiedUntil = verifiedUntil;
  user.verifiedSource = 'payment';
  user.activeVerificationPaymentId = payment._id;
  await user.save();

  console.log(`[Verification] ✅ ${user.email} (${user.role}) paid-verified until ${verifiedUntil.toISOString()}`);

  // In-app notification
  createNotification({
    userId: user._id, type: 'SUCCESS', title: '🎉 Profile Verified!',
    message: `Your Dolphin profile is now verified until ${verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Enjoy boosted visibility!`,
    priority: 'high', actionUrl: '#settings', actionText: 'View Badge',
  }).catch(() => {});

  // Confirmation email + invoice (fire-and-forget)
  sendVerificationSuccessEmail(user, verifiedUntil, payment).catch(e => console.error('[Verification] Email error:', e));

  return true;
}

async function sendVerificationSuccessEmail(user, verifiedUntil, payment) {
  const expiryStr = verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Save invoice number
  if (payment && !payment.invoiceNumber) {
    await VerificationPayment.findByIdAndUpdate(payment._id, {
      invoiceNumber: invoiceNum, invoiceSentAt: new Date(),
    }).catch(() => {});
  }

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
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
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"/>
    <h3 style="color:#374151;margin:0 0 12px;">Payment Receipt</h3>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
      <tr><td style="padding:6px 0;color:#6B7280;">Invoice Number</td><td style="padding:6px 0;text-align:right;font-weight:600;">${invoiceNum}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Invoice Date</td><td style="padding:6px 0;text-align:right;">${invoiceDate}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Customer</td><td style="padding:6px 0;text-align:right;">${user.name}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Email</td><td style="padding:6px 0;text-align:right;">${user.email}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Plan</td><td style="padding:6px 0;text-align:right;">Verified Badge Monthly Plan</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#16A34A;">₹${payment?.orderAmount || 99} INR</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Order ID</td><td style="padding:6px 0;text-align:right;font-size:0.78rem;">${payment?.cashfreeOrderId || 'N/A'}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Valid Until</td><td style="padding:6px 0;text-align:right;font-weight:600;">${expiryStr}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">View Your Profile</a></div>
    <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">Questions? Contact support@pacificdev.in &middot; &copy; 2026 Dolphin</p>
  </div>`;

  await sendEmail({ email: user.email, subject: '🎉 Your Dolphin profile is now Verified! + Receipt', message: html });
}

// ─── POST /api/verification/create-order ─────────────────────────────────────
router.post('/create-order', protect, createOrderLimiter, async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ message: 'Full name is required' });
    if (!phone?.trim() || !/^[6-9]\d{9}$/.test(phone.replace(/\s/g, '')))
      return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number' });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Enter a valid email address' });
    if (!CF_APP_ID || !CF_SECRET)
      return res.status(503).json({ message: 'Payment service not configured. Contact support@pacificdev.in' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { ok, reason } = canPurchaseVerification(user);
    if (!ok) {
      const msgs = {
        founder_lifetime: 'You have a lifetime verified badge as an early supporter!',
        admin_verified: 'Your profile is already verified by Dolphin.',
        already_active: 'Your verified badge is still active.',
        ineligible_profile_type: 'Your profile type is not eligible for paid verification.',
      };
      return res.status(400).json({ message: msgs[reason] || 'Cannot purchase verification.', reason });
    }

    // Reuse valid pending order
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MIN * 60 * 1000);
    const existing = await VerificationPayment.findOne({
      userId: user._id, status: { $in: ['created', 'pending'] }, createdAt: { $gte: pendingCutoff },
    }).sort({ createdAt: -1 });
    if (existing?.paymentSessionId) {
      return res.json({ success: true, order_id: existing.cashfreeOrderId, payment_session_id: existing.paymentSessionId, reused: true });
    }

    const shortId = req.user._id.toString().slice(-8);
    const ts = Date.now().toString(36);
    const orderId = `dlphn_${shortId}_${ts}`;

    let cfOrder;
    try {
      cfOrder = await createCashfreeOrder({
        orderId, amount: AMOUNT, customerId: req.user._id.toString(),
        customerName: fullName.trim(), customerPhone: phone.trim(), customerEmail: email.trim(),
      });
    } catch (cfErr) {
      console.error('[Verification] Cashfree order error:', cfErr.message, cfErr.cfData);
      return res.status(502).json({ message: cfErr.cfData?.message || 'Payment gateway error. Please try again.' });
    }

    await VerificationPayment.create({
      userId: user._id, cashfreeOrderId: cfOrder.order_id,
      paymentSessionId: cfOrder.payment_session_id,
      idempotencyKey: `${req.user._id}_${ts}`,
      orderAmount: AMOUNT, status: 'pending',
      expiresAt: new Date(Date.now() + PENDING_TTL_MIN * 60 * 1000),
    });

    res.json({ success: true, order_id: cfOrder.order_id, payment_session_id: cfOrder.payment_session_id });
  } catch (err) {
    console.error('[Verification] create-order error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── GET /api/verification/status ────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('role isVerified verifiedAt verifiedUntil isFounderVerified isAdminVerified verifiedSource activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-expire stale paid badges
    if (user.isVerified && !user.isFounderVerified && !user.isAdminVerified && user.verifiedUntil && new Date(user.verifiedUntil) <= new Date()) {
      user.isVerified = false;
      await user.save();
    }

    const status = await buildVerificationStatus(user);
    res.json(status);
  } catch (err) {
    console.error('[Verification] status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET /api/verification/refresh-status ────────────────────────────────────
// Called by frontend after returning from Cashfree checkout.
// Actively verifies payment server-side and activates badge immediately.
router.get('/refresh-status', protect, async (req, res) => {
  try {
    const { order_id } = req.query;
    const user = await User.findById(req.user._id)
      .select('role isVerified verifiedAt verifiedUntil isFounderVerified isAdminVerified verifiedSource activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Already verified — return current status
    if (isUserActuallyVerified(user)) {
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }

    if (!order_id) {
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }

    // SECURITY: ensure this order belongs to the logged-in user
    const payment = await VerificationPayment.findOne({
      cashfreeOrderId: order_id,
      userId: req.user._id,
    });
    if (!payment) {
      return res.json({ isVerified: false, message: 'Order not found for this user' });
    }

    // Already paid in our DB — activate if not yet reflected on user
    if (payment.status === 'paid') {
      if (!isUserActuallyVerified(user)) {
        user.isVerified = true;
        user.verifiedAt = payment.paidAt || new Date();
        user.verifiedUntil = payment.verifiedUntil;
        user.verifiedSource = 'payment';
        user.activeVerificationPaymentId = payment._id;
        await user.save();
      }
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: true });
    }

    // Check Cashfree server-to-server
    if (!CF_APP_ID || !CF_SECRET) {
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }

    try {
      const cfOrder = await getCashfreeOrderStatus(order_id);
      const orderStatus = (cfOrder.order_status || '').toUpperCase();

      if (orderStatus === 'PAID') {
        // Get the successful payment ID
        let cfPaymentId = '';
        try {
          const payments = await getCashfreeOrderPayments(order_id);
          const success = payments.find(p => (p.payment_status || '').toUpperCase() === 'SUCCESS');
          cfPaymentId = success?.cf_payment_id || '';
          // Idempotency: check if this payment ID was already processed
          if (cfPaymentId && payment.processedEventIds?.includes(String(cfPaymentId))) {
            const status = await buildVerificationStatus(user);
            return res.json({ ...status, justActivated: false });
          }
          if (cfPaymentId) {
            payment.processedEventIds = payment.processedEventIds || [];
            payment.processedEventIds.push(String(cfPaymentId));
          }
        } catch { /* proceed without payment ID */ }

        const activated = await activatePaidBadge(user, payment, cfPaymentId);
        const status = await buildVerificationStatus(user);
        return res.json({ ...status, justActivated: activated });
      }

      // Not paid yet
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false, orderStatus });
    } catch (cfErr) {
      console.error('[refresh-status] Cashfree check error:', cfErr.message);
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }
  } catch (err) {
    console.error('[refresh-status] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/verification/webhook ──────────────────────────────────────────
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);
    const signature = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];

    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.warn('[Webhook] Invalid signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > WEBHOOK_TOLERANCE_SEC) {
      console.warn(`[Webhook] Stale (age: ${age}s)`);
      return res.status(400).json({ message: 'Webhook too old' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type || '';
    const SUCCESS_EVENTS = ['PAYMENT_SUCCESS_WEBHOOK', 'ORDER_PAID'];
    if (!SUCCESS_EVENTS.includes(eventType)) {
      return res.status(200).json({ received: true, processed: false });
    }

    const cfOrderId   = event.data?.order?.order_id || event.data?.payment?.order_id;
    const cfPaymentId = event.data?.payment?.cf_payment_id;
    const orderStatus = event.data?.order?.order_status || event.data?.payment?.payment_status;
    if (!cfOrderId) return res.status(200).json({ received: true });

    const payment = await VerificationPayment.findOne({ cashfreeOrderId: cfOrderId });
    if (!payment) return res.status(200).json({ received: true });

    // Idempotency
    if (payment.status === 'paid') return res.status(200).json({ received: true, alreadyProcessed: true });
    const eventKey = String(cfPaymentId || eventType);
    if (payment.processedEventIds?.includes(eventKey)) return res.status(200).json({ received: true, alreadyProcessed: true });

    payment.lastWebhookAt = new Date();
    payment.processedEventIds = payment.processedEventIds || [];
    if (eventKey) payment.processedEventIds.push(eventKey);

    const isSuccess = ['PAID', 'SUCCESS'].includes((orderStatus || '').toUpperCase());
    if (!isSuccess) {
      payment.status = 'failed';
      payment.failureReason = `Webhook status: ${orderStatus}`;
      await payment.save();
      return res.status(200).json({ received: true, processed: false });
    }

    // S2S verification
    try {
      const cfOrder = await getCashfreeOrderStatus(cfOrderId);
      if ((cfOrder.order_status || '').toUpperCase() !== 'PAID') {
        payment.status = 'failed';
        payment.failureReason = `S2S: ${cfOrder.order_status}`;
        await payment.save();
        return res.status(200).json({ received: true, processed: false });
      }
    } catch (s2sErr) {
      console.error('[Webhook] S2S error (proceeding):', s2sErr.message);
    }

    const user = await User.findById(payment.userId);
    if (!user) return res.status(200).json({ received: true });
    if (user.isFounderVerified || user.isAdminVerified) return res.status(200).json({ received: true, protected: true });

    await activatePaidBadge(user, payment, cfPaymentId);
    res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(200).json({ received: true, error: 'internal' });
  }
});

// ─── POST /api/verification/admin-grant ──────────────────────────────────────
// Admin grants verified badge to any user (lifetime, admin-source).
const { authorize } = require('../middleware/authMiddleware');
router.post('/admin-grant', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId, source } = req.body; // source: 'founder' | 'admin'
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const verifiedSource = ['founder', 'admin'].includes(source) ? source : 'admin';
    const update = {
      isVerified: true, verifiedAt: new Date(), verifiedUntil: null,
      verifiedSource,
      isFounderVerified: verifiedSource === 'founder',
      isAdminVerified: verifiedSource === 'admin',
    };
    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select('name email role isVerified isFounderVerified isAdminVerified verifiedSource');
    if (!user) return res.status(404).json({ message: 'User not found' });
    console.log(`[Admin] Granted ${verifiedSource} verified badge to ${user.email}`);
    res.json({ success: true, message: `${verifiedSource} verified badge granted to ${user.name}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/verification/reconcile ────────────────────────────────────────
// Admin-only: find paid payments not reflected in user state and fix them.
router.post('/reconcile', protect, authorize('admin'), async (req, res) => {
  try {
    const paidPayments = await VerificationPayment.find({ status: 'paid' })
      .populate('userId', 'isVerified isFounderVerified isAdminVerified verifiedUntil verifiedSource name email role');
    let fixed = 0;
    const results = [];
    for (const payment of paidPayments) {
      const user = payment.userId;
      if (!user) continue;
      if (isUserActuallyVerified(user)) continue; // already verified
      // Badge should be active but isn't — fix it
      if (payment.verifiedUntil && new Date(payment.verifiedUntil) > new Date()) {
        user.isVerified = true;
        user.verifiedAt = payment.paidAt || new Date();
        user.verifiedUntil = payment.verifiedUntil;
        user.verifiedSource = 'payment';
        user.activeVerificationPaymentId = payment._id;
        await user.save();
        fixed++;
        results.push({ userId: user._id, email: user.email, fixed: true });
      }
    }
    res.json({ success: true, fixed, results });
  } catch (err) {
    console.error('[Reconcile] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Daily cron ───────────────────────────────────────────────────────────────
async function processVerificationExpiry() {
  const now = new Date();
  // Expire paid badges
  const expired = await User.find({
    isVerified: true, isFounderVerified: { $ne: true }, isAdminVerified: { $ne: true },
    verifiedUntil: { $lt: now },
  }).select('_id name email');
  for (const u of expired) {
    await User.findByIdAndUpdate(u._id, { isVerified: false });
    createNotification({ userId: u._id, type: 'WARNING', title: 'Verified Badge Expired',
      message: 'Your Dolphin verified badge has expired. Renew for ₹99/month.',
      priority: 'high', actionUrl: '#settings', actionText: 'Renew Now' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⚠️ Your Dolphin Verified Badge has expired',
      message: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;"><h2>🐬 Dolphin</h2><p>Hi <strong>${u.name}</strong>, your verified badge has expired. <a href="${FRONTEND_URL}/dashboard#settings">Renew for ₹99/month</a>.</p></div>` }).catch(() => {});
  }
  // 2-day reminders
  const t2 = new Date(now.getTime() + 2 * 86400000);
  const t3 = new Date(now.getTime() + 3 * 86400000);
  const expiringSoon = await User.find({
    isVerified: true, isFounderVerified: { $ne: true }, isAdminVerified: { $ne: true },
    verifiedUntil: { $gte: t2, $lt: t3 },
  }).select('_id name email verifiedUntil activeVerificationPaymentId');
  for (const u of expiringSoon) {
    if (u.activeVerificationPaymentId) {
      const p = await VerificationPayment.findById(u.activeVerificationPaymentId).select('reminderSentAt');
      if (p?.reminderSentAt) continue;
      await VerificationPayment.findByIdAndUpdate(u.activeVerificationPaymentId, { reminderSentAt: now });
    }
    const expiryStr = new Date(u.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    createNotification({ userId: u._id, type: 'WARNING', title: '⏰ Verified Badge Expiring in 2 Days',
      message: `Your badge expires on ${expiryStr}. Renew now!`, priority: 'high', actionUrl: '#settings', actionText: 'Renew' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⏰ Your Dolphin Verified Badge expires in 2 days',
      message: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;"><h2>🐬 Dolphin</h2><p>Hi <strong>${u.name}</strong>, your verified badge expires on <strong>${expiryStr}</strong>. <a href="${FRONTEND_URL}/dashboard#settings">Renew for ₹99/month</a>.</p></div>` }).catch(() => {});
  }
  console.log(`[Verification] Cron: expired=${expired.length}, reminded=${expiringSoon.length}`);
  return { expired: expired.length, reminded: expiringSoon.length };
}

// ─── POST /api/verification/run-migration ─────────────────────────────────────
router.post('/run-migration', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await migrateLegacyVerifiedUsers();
    // Also bulk-upgrade founder-lifetime users
    const founderResult = await User.updateMany(
      { isVerified: true, isFounderVerified: { $ne: true }, isAdminVerified: { $ne: true }, verifiedUntil: null },
      { $set: { isFounderVerified: true, verifiedSource: 'founder' } }
    );
    res.json({ success: true, ...result, founderUpgraded: founderResult.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.processVerificationExpiry = processVerificationExpiry;

// ─── GET /api/verification/refresh-status ────────────────────────────────────
// Called by frontend after returning from Cashfree checkout.
// Actively checks Cashfree order status and activates badge if paid.
router.get('/refresh-status', protect, async (req, res) => {
  try {
    const { order_id } = req.query;
    const user = await User.findById(req.user._id)
      .select('role isVerified verifiedAt verifiedUntil isFounderVerified isAdminVerified verifiedSource activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Already verified — return current status
    if (isUserActuallyVerified(user)) {
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }

    if (!order_id) return res.json({ isVerified: false });

    // Security: order must belong to this user
    const payment = await VerificationPayment.findOne({
      cashfreeOrderId: order_id,
      userId: req.user._id,
    });
    if (!payment) return res.json({ isVerified: false, message: 'Order not found for this user' });

    // Already paid in our DB — activate if not yet reflected on user
    if (payment.status === 'paid') {
      await activatePaidBadge(user, payment, payment.cashfreePaymentId);
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: true });
    }

    // Check Cashfree server-to-server
    if (!CF_APP_ID || !CF_SECRET) return res.json({ isVerified: false, message: 'Payment service not configured' });

    try {
      const cfOrder = await getCashfreeOrderStatus(order_id);
      const orderStatus = (cfOrder.order_status || '').toUpperCase();

      if (orderStatus === 'PAID') {
        // Get the successful payment ID
        let cfPaymentId = '';
        try {
          const payments = await getCashfreeOrderPayments(order_id);
          const success = payments.find(p => (p.payment_status || '').toUpperCase() === 'SUCCESS');
          cfPaymentId = success?.cf_payment_id || '';
        } catch { /* ignore */ }

        const activated = await activatePaidBadge(user, payment, cfPaymentId);
        const status = await buildVerificationStatus(user);
        return res.json({ ...status, justActivated: activated });
      }

      return res.json({ isVerified: false, orderStatus, message: `Payment status: ${orderStatus}` });
    } catch (cfErr) {
      console.error('[refresh-status] Cashfree check error:', cfErr.message);
      return res.json({ isVerified: false, message: 'Could not verify payment status. Please wait.' });
    }
  } catch (err) {
    console.error('[refresh-status] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/verification/webhook ──────────────────────────────────────────
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body);
    const signature = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];

    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      console.warn('[Webhook] Invalid or missing signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const webhookAge = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (webhookAge > WEBHOOK_TOLERANCE_SEC) {
      console.warn(`[Webhook] Stale webhook rejected (age: ${webhookAge}s)`);
      return res.status(400).json({ message: 'Webhook timestamp too old' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type || '';
    const SUCCESS_EVENTS = ['PAYMENT_SUCCESS_WEBHOOK', 'ORDER_PAID'];
    if (!SUCCESS_EVENTS.includes(eventType)) {
      return res.status(200).json({ received: true, processed: false });
    }

    const cfOrderId   = event.data?.order?.order_id || event.data?.payment?.order_id;
    const cfPaymentId = event.data?.payment?.cf_payment_id;
    const payStatus   = (event.data?.payment?.payment_status || event.data?.order?.order_status || '').toUpperCase();

    if (!cfOrderId) return res.status(200).json({ received: true });

    const payment = await VerificationPayment.findOne({ cashfreeOrderId: cfOrderId });
    if (!payment) {
      console.warn(`[Webhook] No payment record for order ${cfOrderId}`);
      return res.status(200).json({ received: true });
    }

    // Idempotency — skip if already processed
    if (payment.status === 'paid') return res.status(200).json({ received: true, alreadyProcessed: true });
    if (cfPaymentId && payment.processedEventIds?.includes(cfPaymentId)) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    payment.lastWebhookAt = new Date();
    if (cfPaymentId && !payment.processedEventIds?.includes(cfPaymentId)) {
      payment.processedEventIds = [...(payment.processedEventIds || []), cfPaymentId];
    }

    if (!['PAID', 'SUCCESS'].includes(payStatus)) {
      payment.status = 'failed';
      payment.failureReason = `Webhook status: ${payStatus}`;
      await payment.save();
      return res.status(200).json({ received: true, processed: false });
    }

    // S2S verification
    try {
      const cfOrderData = await getCashfreeOrderStatus(cfOrderId);
      if ((cfOrderData.order_status || '').toUpperCase() !== 'PAID') {
        payment.status = 'failed';
        payment.failureReason = `S2S status: ${cfOrderData.order_status}`;
        await payment.save();
        return res.status(200).json({ received: true, processed: false });
      }
    } catch (s2sErr) {
      console.error('[Webhook] S2S check error (proceeding):', s2sErr.message);
    }

    const user = await User.findById(payment.userId);
    if (!user) return res.status(200).json({ received: true });

    // Founder/admin verified users are permanently protected
    if (user.isFounderVerified || user.isAdminVerified) {
      return res.status(200).json({ received: true, protected: true });
    }

    await activatePaidBadge(user, payment, cfPaymentId);
    res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Webhook] Unhandled error:', err);
    res.status(200).json({ received: true, error: 'internal' });
  }
});

// ─── POST /api/verification/admin-grant ──────────────────────────────────────
// Admin grants lifetime verified badge to any user
const { authorize } = require('../middleware/authMiddleware');
router.post('/admin-grant', protect, authorize('admin'), async (req, res) => {
  try {
    const { userId, source = 'admin' } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    const validSources = ['founder', 'admin'];
    if (!validSources.includes(source)) return res.status(400).json({ message: 'source must be founder or admin' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const update = {
      isVerified: true,
      verifiedAt: new Date(),
      verifiedUntil: null,
      verifiedSource: source,
    };
    if (source === 'founder') update.isFounderVerified = true;
    if (source === 'admin') update.isAdminVerified = true;

    await User.findByIdAndUpdate(userId, { $set: update });
    console.log(`[Admin] Granted ${source} verified badge to ${user.email}`);
    res.json({ success: true, message: `${source} verified badge granted to ${user.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST /api/verification/reconcile ────────────────────────────────────────
// Admin-only: find paid orders not yet reflected in user state and fix them
router.post('/reconcile', protect, authorize('admin'), async (req, res) => {
  try {
    const paidPayments = await VerificationPayment.find({ status: 'paid' })
      .populate('userId', 'isVerified isFounderVerified isAdminVerified verifiedUntil email name role');

    let fixed = 0;
    const results = [];

    for (const payment of paidPayments) {
      const user = payment.userId;
      if (!user) continue;
      if (user.isFounderVerified || user.isAdminVerified) continue;

      const badgeActive = user.isVerified && user.verifiedUntil && new Date(user.verifiedUntil) > new Date();
      if (badgeActive) continue;

      // Badge not active but payment is paid — fix it
      const verifiedUntil = payment.verifiedUntil || new Date(payment.paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (new Date(verifiedUntil) <= new Date()) continue; // already expired

      await User.findByIdAndUpdate(user._id, {
        isVerified: true, verifiedAt: payment.paidAt, verifiedUntil,
        verifiedSource: 'payment', activeVerificationPaymentId: payment._id,
      });
      fixed++;
      results.push({ userId: user._id, email: user.email, verifiedUntil });
    }

    res.json({ success: true, fixed, results });
  } catch (err) {
    console.error('[Reconcile] Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Daily cron ───────────────────────────────────────────────────────────────
async function processVerificationExpiry() {
  const now = new Date();

  // Expire paid badges
  const expired = await User.find({
    isVerified: true, isFounderVerified: { $ne: true }, isAdminVerified: { $ne: true },
    verifiedUntil: { $lt: now },
  }).select('_id name email');

  for (const u of expired) {
    await User.findByIdAndUpdate(u._id, { isVerified: false });
    createNotification({ userId: u._id, type: 'WARNING', title: 'Verified Badge Expired',
      message: 'Your Dolphin verified badge has expired. Renew for ₹99/month.',
      priority: 'high', actionUrl: '#settings', actionText: 'Renew Now' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⚠️ Your Dolphin Verified Badge has expired',
      message: buildExpiredEmail(u) }).catch(() => {});
  }

  // 2-day reminders
  const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const expiringSoon = await User.find({
    isVerified: true, isFounderVerified: { $ne: true }, isAdminVerified: { $ne: true },
    verifiedUntil: { $gte: twoDays, $lt: threeDays },
  }).select('_id name email verifiedUntil activeVerificationPaymentId');

  for (const u of expiringSoon) {
    if (u.activeVerificationPaymentId) {
      const p = await VerificationPayment.findById(u.activeVerificationPaymentId).select('reminderSentAt');
      if (p?.reminderSentAt) continue;
      await VerificationPayment.findByIdAndUpdate(u.activeVerificationPaymentId, { reminderSentAt: now });
    }
    createNotification({ userId: u._id, type: 'WARNING', title: '⏰ Verified Badge Expiring in 2 Days',
      message: `Your badge expires on ${new Date(u.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}. Renew now!`,
      priority: 'high', actionUrl: '#settings', actionText: 'Renew Badge' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⏰ Your Dolphin Verified Badge expires in 2 days',
      message: buildReminderEmail(u) }).catch(() => {});
  }

  console.log(`[Verification] Cron: expired=${expired.length}, reminded=${expiringSoon.length}`);
  return { expired: expired.length, reminded: expiringSoon.length };
}

function buildReminderEmail(user) {
  const d = new Date(user.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;"><h2 style="color:#1E3A8A;text-align:center;">🐬 Dolphin</h2><div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;text-align:center;margin:20px 0;"><h2 style="color:#92400E;margin:0;">⏰ Your Verified Badge expires in 2 days</h2><p style="color:#92400E;margin:8px 0 0;">Expiry: <strong>${d}</strong></p></div><p style="color:#374151;">Hi <strong>${user.name}</strong>, renew for just <strong>₹99/month</strong> to keep your boosted visibility.</p><div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a></div><p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p></div>`;
}

function buildExpiredEmail(user) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;"><h2 style="color:#1E3A8A;text-align:center;">🐬 Dolphin</h2><div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;text-align:center;margin:20px 0;"><h2 style="color:#DC2626;margin:0;">😢 Your Verified Badge has expired</h2></div><p style="color:#374151;">Hi <strong>${user.name}</strong>, your badge has expired. Renew for just <strong>₹99/month</strong>.</p><div style="text-align:center;margin:24px 0;"><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a></div><p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p></div>`;
}

module.exports = router;
module.exports.processVerificationExpiry = processVerificationExpiry;
module.exports.migrateLegacyVerifiedUsers = migrateLegacyVerifiedUsers;
