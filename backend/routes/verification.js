/**
 * routes/verification.js
 * Monthly paid profile verification via Cashfree Payment Links.
 *
 * Rules:
 *  - Early supporters (isFounderVerified=true) → lifetime free badge, no payment needed
 *  - New users → ₹99/month, badge expires after 30 days
 *  - 2 days before expiry → reminder notification + email
 *  - Verified profiles/posts are boosted in feeds
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { protect } = require('../middleware/authMiddleware');
const User     = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { createNotification } = require('../services/notificationService');

const CF_APP_ID    = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET    = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV       = (process.env.CASHFREE_ENV        || 'production').trim();
const AMOUNT       = Number(process.env.VERIFICATION_AMOUNT || 99);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://dolphin-main.vercel.app').trim();
const BACKEND_URL  = (process.env.BACKEND_URL  || 'https://api.dolphinorg.in').trim();

const CF_BASE = CF_ENV === 'sandbox'
  ? 'https://sandbox.cashfree.com/pg'
  : 'https://api.cashfree.com/pg';

// Helper: is the user's badge currently active?
function isBadgeActive(user) {
  if (!user.isVerified) return false;
  if (user.isFounderVerified) return true;          // lifetime
  if (!user.verifiedUntil) return true;             // legacy lifetime
  return new Date(user.verifiedUntil) > new Date(); // monthly — check expiry
}

// ─── POST /api/verification/create-link ──────────────────────────────────────
router.post('/create-link', protect, async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;

    if (!fullName?.trim() || !phone?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Full name, phone, and email are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Founder badge holders never pay
    if (user.isFounderVerified) {
      return res.status(400).json({ message: 'You have a lifetime verified badge as an early supporter!' });
    }

    // Already verified and not expired — no need to pay again
    if (isBadgeActive(user)) {
      return res.status(400).json({
        message: 'Your verified badge is still active.',
        verifiedUntil: user.verifiedUntil,
      });
    }

    // Prevent duplicate pending payment
    if (user.verificationPayment?.status === 'pending' && user.verificationPayment?.cfLinkId) {
      return res.status(400).json({
        message: 'A payment is already pending.',
        alreadyPending: true,
      });
    }

    if (!CF_APP_ID || !CF_SECRET) {
      return res.status(503).json({ message: 'Payment service not configured. Please contact support@pacificdev.in' });
    }

    // Cashfree link_id max 50 chars — use short user ID suffix
    const shortId = req.user._id.toString().slice(-8);
    const ts      = Date.now().toString().slice(-8);
    const linkId  = `dlphn_v_${shortId}_${ts}`; // max ~26 chars

    // Ensure return_url is always a full https:// URL
    const rawFrontend = (process.env.FRONTEND_URL || 'https://dolphin-main.vercel.app').trim();
    const frontendBase = rawFrontend.startsWith('http') ? rawFrontend : `https://${rawFrontend}`;
    const backendBase  = (process.env.BACKEND_URL || 'https://api.dolphinorg.in').trim();

    const linkPayload = {
      customer_details: {
        customer_name:  fullName.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
      },
      link_amount:   AMOUNT,
      link_currency: 'INR',
      link_purpose:  'Dolphin Verified Badge',
      link_id:       linkId,
      link_notify: {
        send_sms:   false,
        send_email: false,
      },
      link_meta: {
        return_url: `${frontendBase}/dashboard?verified=1`,
        notify_url: `${backendBase}/api/verification/webhook`,
      },
    };

    const cfRes = await fetch(`${CF_BASE}/links`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     CF_APP_ID,
        'x-client-secret': CF_SECRET,
      },
      body: JSON.stringify(linkPayload),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.link_url) {
      console.error('Cashfree create-link error:', JSON.stringify(cfData));
      console.error('Cashfree status:', cfRes.status);
      console.error('CF_APP_ID present:', !!CF_APP_ID, 'CF_SECRET present:', !!CF_SECRET);
      return res.status(502).json({
        message: cfData.message || `Payment gateway error (${cfRes.status}). Please try again or contact support@pacificdev.in`,
      });
    }

    // Save pending payment
    user.verificationPayment = {
      cfLinkId: cfData.link_id,
      status:   'pending',
      amount:   AMOUNT,
    };
    await user.save();

    res.json({ success: true, link_url: cfData.link_url, link_id: cfData.link_id });
  } catch (err) {
    console.error('Verification create-link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/verification/webhook ──────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody  = req.body.toString('utf8');
    const signature = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];

    // Verify HMAC-SHA256 signature
    if (CF_SECRET && signature && timestamp) {
      const expected = crypto
        .createHmac('sha256', CF_SECRET)
        .update(timestamp + rawBody)
        .digest('base64');
      if (expected !== signature) {
        console.warn('[Webhook] Invalid Cashfree signature');
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const event     = JSON.parse(rawBody);
    const eventType = event.type;

    if (
      eventType !== 'PAYMENT_SUCCESS_WEBHOOK' &&
      eventType !== 'LINK_PAYMENT_SUCCESS_WEBHOOK'
    ) {
      return res.status(200).json({ received: true });
    }

    const linkId  = event.data?.link?.link_id || event.data?.payment?.cf_link_id;
    const orderId = event.data?.payment?.cf_payment_id || event.data?.order?.cf_order_id;

    if (!linkId) return res.status(200).json({ received: true });

    const user = await User.findOne({ 'verificationPayment.cfLinkId': linkId });
    if (!user) return res.status(200).json({ received: true });

    // Idempotency — if badge is still active, don't re-process
    if (isBadgeActive(user)) return res.status(200).json({ received: true, alreadyVerified: true });

    // Activate badge for 30 days
    const now          = new Date();
    const verifiedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    user.isVerified    = true;
    user.verifiedAt    = now;
    user.verifiedUntil = verifiedUntil;
    user.verificationPayment.status    = 'paid';
    user.verificationPayment.cfOrderId = orderId || '';
    user.verificationPayment.paidAt    = now;
    await user.save();

    console.log(`[Verification] ✅ ${user.email} verified until ${verifiedUntil.toISOString()}`);

    // In-app notification
    createNotification({
      userId:    user._id,
      type:      'SUCCESS',
      title:     '🎉 Profile Verified!',
      message:   `Your Dolphin profile is now verified until ${verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Enjoy boosted visibility!`,
      priority:  'high',
      actionUrl: '#settings',
      actionText: 'View Badge',
    }).catch(() => {});

    // Confirmation email
    sendEmail({
      email:   user.email,
      subject: '🎉 Your Dolphin profile is now Verified!',
      message: buildVerifiedEmail(user, verifiedUntil),
    }).catch(e => console.error('Verification email error:', e));

    res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({ message: 'Webhook processing error' });
  }
});

// ─── GET /api/verification/status ────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('isVerified verifiedAt verifiedUntil isFounderVerified verificationPayment');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const active = isBadgeActive(user);

    // Auto-expire: if badge was active but now expired, clear it
    if (user.isVerified && !active && !user.isFounderVerified) {
      user.isVerified = false;
      await user.save();
    }

    res.json({
      isVerified:       active,
      isFounderVerified: user.isFounderVerified || false,
      verifiedAt:       user.verifiedAt,
      verifiedUntil:    user.verifiedUntil,
      paymentStatus:    user.verificationPayment?.status || null,
      daysLeft:         user.verifiedUntil
        ? Math.max(0, Math.ceil((new Date(user.verifiedUntil) - new Date()) / 86400000))
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Daily cron: expire badges + send 2-day reminders ────────────────────────
async function processVerificationExpiry() {
  const now = new Date();

  // 1. Expire badges that have passed verifiedUntil
  const expired = await User.find({
    isVerified: true,
    isFounderVerified: { $ne: true },
    verifiedUntil: { $lt: now },
  }).select('_id name email');

  for (const u of expired) {
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

  // 2. Send 2-day reminder to users expiring in 2 days
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const twoDaysPlusOne = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringSoon = await User.find({
    isVerified: true,
    isFounderVerified: { $ne: true },
    verifiedUntil: { $gte: twoDaysFromNow, $lt: twoDaysPlusOne },
  }).select('_id name email verifiedUntil');

  for (const u of expiringSoon) {
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

  console.log(`[Verification] Expired: ${expired.length}, Reminded: ${expiringSoon.length}`);
  return { expired: expired.length, reminded: expiringSoon.length };
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildVerifiedEmail(user, verifiedUntil) {
  const expiryStr = verifiedUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:72px;height:72px;background:linear-gradient(135deg,#84CC16,#16A34A);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;">✓</div>
      </div>
      <h2 style="color:#111827;text-align:center;">Your profile is now Verified!</h2>
      <p style="color:#374151;line-height:1.7;text-align:center;">
        Hi <strong>${user.name}</strong>, your Dolphin profile has been verified until <strong>${expiryStr}</strong>.
      </p>
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
      <p style="color:#6B7280;font-size:0.875rem;text-align:center;">
        Your badge is valid for 30 days. You can renew anytime from Settings.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${FRONTEND_URL}" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">View Your Profile</a>
      </div>
      <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
    </div>`;
}

function buildReminderEmail(user) {
  const expiryStr = new Date(user.verifiedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:2.5rem;margin-bottom:8px;">⏰</div>
        <h2 style="color:#92400E;margin:0;">Your Verified Badge expires in 2 days</h2>
        <p style="color:#92400E;margin:8px 0 0;">Expiry date: <strong>${expiryStr}</strong></p>
      </div>
      <p style="color:#374151;line-height:1.7;">
        Hi <strong>${user.name}</strong>, your Dolphin verified badge is expiring soon.
        Renew for just <strong>₹99/month</strong> to keep your boosted visibility and verified status.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a>
      </div>
      <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
    </div>`;
}

function buildExpiredEmail(user) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #E5E7EB;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;"><h2 style="color:#1E3A8A;margin:0;">🐬 Dolphin</h2></div>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:2.5rem;margin-bottom:8px;">😢</div>
        <h2 style="color:#DC2626;margin:0;">Your Verified Badge has expired</h2>
      </div>
      <p style="color:#374151;line-height:1.7;">
        Hi <strong>${user.name}</strong>, your Dolphin verified badge has expired.
        Renew for just <strong>₹99/month</strong> to restore your boosted visibility and verified status.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${FRONTEND_URL}/dashboard#settings" style="display:inline-block;padding:14px 32px;background:#84CC16;color:#0F172A;text-decoration:none;border-radius:8px;font-weight:700;">Renew My Badge – ₹99</a>
      </div>
      <p style="color:#9CA3AF;font-size:0.8rem;text-align:center;">&copy; 2026 Dolphin &middot; support@pacificdev.in</p>
    </div>`;
}

module.exports = router;
module.exports.processVerificationExpiry = processVerificationExpiry;
