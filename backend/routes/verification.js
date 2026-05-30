/**
 * routes/verification.js — Payment-only verification.
 * No founder/admin/legacy paths. Badge = confirmed paid only.
 */
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/authMiddleware');
const User     = require('../models/User');
const VerificationPayment = require('../models/VerificationPayment');
const sendEmail = require('../utils/sendEmail');
const { createNotification } = require('../services/notificationService');
const {
  isUserActuallyVerified,
  canPurchaseVerification,
  buildVerificationStatus,
} = require('../services/verificationService');

const CF_APP_ID  = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET  = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV     = (process.env.CASHFREE_ENV        || 'production').trim();
const CF_API_VER = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();
const AMOUNT     = Number(process.env.VERIFICATION_AMOUNT || 99);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.dolphinorg.in').trim();
const BACKEND_URL  = (process.env.BACKEND_URL  || 'https://api.dolphinorg.in').trim();
const WEBHOOK_TOL  = Number(process.env.CASHFREE_WEBHOOK_TOLERANCE_SECONDS || 300);
const PENDING_TTL  = Number(process.env.VERIFICATION_PENDING_TTL_MINUTES || 30);

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
  return Array.isArray(data) ? data : [];
}

function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!CF_SECRET || !signature || !timestamp) return false;
  const expected = crypto.createHmac('sha256', CF_SECRET).update(timestamp + rawBody).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(signature, 'base64')); }
  catch { return false; }
}

// ─── Badge activation (payment-only) ─────────────────────────────────────────
async function activatePaidBadge(user, payment, cashfreePaymentId) {
  if (payment.status === 'paid') return false; // idempotent

  const now = new Date();
  const verifiedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  payment.status = 'paid';
  payment.cashfreePaymentId = cashfreePaymentId || '';
  payment.paidAt = now;
  payment.verifiedUntil = verifiedUntil;
  await payment.save();

  user.isVerified    = true;
  user.verifiedAt    = now;
  user.verifiedUntil = verifiedUntil;
  user.verifiedSource = 'payment';
  user.activeVerificationPaymentId = payment._id;
  await user.save();

  console.log(`[Verification] ✅ ${user.email} (${user.role}) verified until ${verifiedUntil.toISOString()}`);

  createNotification({
    userId: user._id, type: 'SUCCESS', title: '🎉 Profile Verified!',
    message: `Your Dolphin profile is now verified until ${verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    priority: 'high', actionUrl: '#settings', actionText: 'View Badge',
  }).catch(() => {});

  sendVerificationSuccessEmail(user, verifiedUntil, payment).catch(e => console.error('[Verification] Email error:', e));
  return true;
}

async function sendVerificationSuccessEmail(user, verifiedUntil, payment) {
  const expiryStr = verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  if (payment && !payment.invoiceNumber) {
    await VerificationPayment.findByIdAndUpdate(payment._id, { invoiceNumber: invoiceNum, invoiceSentAt: new Date() }).catch(() => {});
  }

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
    <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
    <div style="text-align:center;margin-bottom:24px;"><div style="width:72px;height:72px;background:linear-gradient(135deg,#84CC16,#16A34A);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;">✓</div></div>
    <h2 style="color:#111827;text-align:center;">Your profile is now Verified!</h2>
    <p style="color:#374151;line-height:1.7;text-align:center;">Hi <strong>${user.name}</strong>, your Dolphin profile has been verified until <strong>${expiryStr}</strong>.</p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:20px;margin:20px 0;">
      <ul style="color:#374151;line-height:2;margin:0;padding-left:20px;">
        <li>✅ Verified badge beside your profile name</li>
        <li>📈 Boosted profile visibility in searches</li>
        <li>⭐ Priority visibility in posts and networking feed</li>
        <li>🤝 Higher chances of getting connections</li>
      </ul>
    </div>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"/>
    <h3 style="color:#374151;margin:0 0 12px;">Payment Receipt</h3>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
      <tr><td style="padding:6px 0;color:#6B7280;">Invoice Number</td><td style="padding:6px 0;text-align:right;font-weight:600;">${invoiceNum}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Invoice Date</td><td style="padding:6px 0;text-align:right;">${invoiceDate}</td></tr>
      <tr><td style="padding:6px 0;color:#6B7280;">Customer</td><td style="padding:6px 0;text-align:right;">${user.name}</td></tr>
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
      const msgs = { already_active: 'Your verified badge is still active.', ineligible_profile_type: 'Your profile type is not eligible.' };
      return res.status(400).json({ message: msgs[reason] || 'Cannot purchase verification.', reason });
    }

    // Reuse valid pending order
    const cutoff = new Date(Date.now() - PENDING_TTL * 60 * 1000);
    const existing = await VerificationPayment.findOne({
      userId: user._id, status: { $in: ['created', 'pending'] }, createdAt: { $gte: cutoff },
    }).sort({ createdAt: -1 });
    if (existing?.paymentSessionId)
      return res.json({ success: true, order_id: existing.cashfreeOrderId, payment_session_id: existing.paymentSessionId, reused: true });

    const shortId = req.user._id.toString().slice(-8);
    const ts = Date.now().toString(36);
    const orderId = `dlphn_${shortId}_${ts}`;

    let cfOrder;
    try {
      cfOrder = await createCashfreeOrder({ orderId, amount: AMOUNT, customerId: req.user._id.toString(), customerName: fullName.trim(), customerPhone: phone.trim(), customerEmail: email.trim() });
    } catch (cfErr) {
      console.error('[Verification] Cashfree order error:', cfErr.message, cfErr.cfData);
      return res.status(502).json({ message: cfErr.cfData?.message || 'Payment gateway error. Please try again.' });
    }

    await VerificationPayment.create({
      userId: user._id, cashfreeOrderId: cfOrder.order_id, paymentSessionId: cfOrder.payment_session_id,
      idempotencyKey: `${req.user._id}_${ts}`, orderAmount: AMOUNT, status: 'pending',
      expiresAt: new Date(Date.now() + PENDING_TTL * 60 * 1000),
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
      .select('role isVerified verifiedAt verifiedUntil verifiedSource activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Auto-expire stale paid badges
    if (user.isVerified && user.verifiedUntil && new Date(user.verifiedUntil) <= new Date()) {
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
router.get('/refresh-status', protect, async (req, res) => {
  try {
    const { order_id } = req.query;
    const user = await User.findById(req.user._id)
      .select('role isVerified verifiedAt verifiedUntil verifiedSource activeVerificationPaymentId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (isUserActuallyVerified(user)) {
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: false });
    }

    if (!order_id) return res.json({ isVerified: false });

    // Security: order must belong to this user
    const payment = await VerificationPayment.findOne({ cashfreeOrderId: order_id, userId: req.user._id });
    if (!payment) return res.json({ isVerified: false, message: 'Order not found for this user' });

    if (payment.status === 'paid') {
      await activatePaidBadge(user, payment, payment.cashfreePaymentId);
      const status = await buildVerificationStatus(user);
      return res.json({ ...status, justActivated: true });
    }

    if (!CF_APP_ID || !CF_SECRET) return res.json({ isVerified: false });

    try {
      const cfOrder = await getCashfreeOrderStatus(order_id);
      if ((cfOrder.order_status || '').toUpperCase() === 'PAID') {
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
      return res.json({ isVerified: false, orderStatus: cfOrder.order_status });
    } catch (cfErr) {
      console.error('[refresh-status] Cashfree error:', cfErr.message);
      return res.json({ isVerified: false, message: 'Could not verify payment. Please wait.' });
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
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOL) {
      console.warn('[Webhook] Stale webhook rejected');
      return res.status(400).json({ message: 'Webhook timestamp too old' });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type || '';
    if (!['PAYMENT_SUCCESS_WEBHOOK', 'ORDER_PAID'].includes(eventType))
      return res.status(200).json({ received: true, processed: false });

    const cfOrderId   = event.data?.order?.order_id || event.data?.payment?.order_id;
    const cfPaymentId = event.data?.payment?.cf_payment_id;
    const payStatus   = (event.data?.payment?.payment_status || event.data?.order?.order_status || '').toUpperCase();

    if (!cfOrderId) return res.status(200).json({ received: true });

    const payment = await VerificationPayment.findOne({ cashfreeOrderId: cfOrderId });
    if (!payment) return res.status(200).json({ received: true });

    if (payment.status === 'paid') return res.status(200).json({ received: true, alreadyProcessed: true });
    if (cfPaymentId && (payment.processedEventIds || []).includes(cfPaymentId))
      return res.status(200).json({ received: true, alreadyProcessed: true });

    payment.lastWebhookAt = new Date();
    if (cfPaymentId) payment.processedEventIds = [...(payment.processedEventIds || []), cfPaymentId];

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
        payment.failureReason = `S2S: ${cfOrderData.order_status}`;
        await payment.save();
        return res.status(200).json({ received: true, processed: false });
      }
    } catch (s2sErr) {
      console.error('[Webhook] S2S error (proceeding):', s2sErr.message);
    }

    const user = await User.findById(payment.userId);
    if (!user) return res.status(200).json({ received: true });

    await activatePaidBadge(user, payment, cfPaymentId);
    res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(200).json({ received: true, error: 'internal' });
  }
});

// ─── POST /api/verification/reconcile (admin-only) ───────────────────────────
router.post('/reconcile', protect, authorize('admin'), async (req, res) => {
  try {
    const paidPayments = await VerificationPayment.find({ status: 'paid' })
      .populate('userId', 'isVerified verifiedUntil verifiedSource email name role');
    let fixed = 0;
    const results = [];
    const seen = new Set();

    for (const payment of paidPayments) {
      const user = payment.userId;
      if (!user || seen.has(user._id.toString())) continue;
      seen.add(user._id.toString());

      if (isUserActuallyVerified(user)) continue;

      const verifiedUntil = payment.verifiedUntil || new Date(payment.paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (new Date(verifiedUntil) <= new Date()) continue;

      await User.findByIdAndUpdate(user._id, {
        isVerified: true, verifiedSource: 'payment', verifiedAt: payment.paidAt,
        verifiedUntil, activeVerificationPaymentId: payment._id,
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
  const expired = await User.find({
    isVerified: true, verifiedSource: 'payment', verifiedUntil: { $lt: now },
  }).select('_id name email');

  for (const u of expired) {
    await User.findByIdAndUpdate(u._id, { isVerified: false });
    createNotification({ userId: u._id, type: 'WARNING', title: 'Verified Badge Expired',
      message: 'Your Dolphin verified badge has expired. Renew for ₹99/month.',
      priority: 'high', actionUrl: '#settings', actionText: 'Renew Now' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⚠️ Your Dolphin Verified Badge has expired',
      message: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;"><h2 style="color:#1E3A8A;">🐬 Dolphin</h2><p>Hi <strong>${u.name}</strong>, your verified badge has expired. Renew for ₹99/month.</p><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:12px 28px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew Now</a></div>` }).catch(() => {});
  }

  const twoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const expiringSoon = await User.find({
    isVerified: true, verifiedSource: 'payment', verifiedUntil: { $gte: twoDays, $lt: threeDays },
  }).select('_id name email verifiedUntil activeVerificationPaymentId');

  for (const u of expiringSoon) {
    if (u.activeVerificationPaymentId) {
      const p = await VerificationPayment.findById(u.activeVerificationPaymentId).select('reminderSentAt');
      if (p?.reminderSentAt) continue;
      await VerificationPayment.findByIdAndUpdate(u.activeVerificationPaymentId, { reminderSentAt: now });
    }
    const d = new Date(u.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    createNotification({ userId: u._id, type: 'WARNING', title: '⏰ Verified Badge Expiring in 2 Days',
      message: `Your badge expires on ${d}. Renew now!`, priority: 'high', actionUrl: '#settings', actionText: 'Renew Badge' }).catch(() => {});
    sendEmail({ email: u.email, subject: '⏰ Your Dolphin Verified Badge expires in 2 days',
      message: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;"><h2 style="color:#1E3A8A;">🐬 Dolphin</h2><p>Hi <strong>${u.name}</strong>, your badge expires on <strong>${d}</strong>. Renew for ₹99/month.</p><a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:12px 28px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a></div>` }).catch(() => {});
  }

  console.log(`[Verification] Cron: expired=${expired.length}, reminded=${expiringSoon.length}`);
  return { expired: expired.length, reminded: expiringSoon.length };
}

module.exports = router;
module.exports.processVerificationExpiry = processVerificationExpiry;
