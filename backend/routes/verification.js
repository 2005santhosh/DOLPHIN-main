/**
 * routes/verification.js
 * Handles paid profile verification via Cashfree Payment Links.
 *
 * Flow:
 *  1. POST /api/verification/create-link  — creates a Cashfree payment link, returns link_url
 *  2. User is redirected to Cashfree checkout
 *  3. POST /api/verification/webhook      — Cashfree notifies us on payment success
 *  4. Webhook verifies signature, marks user as verified
 */

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { protect } = require('../middleware/authMiddleware');
const User     = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const CF_APP_ID    = (process.env.CASHFREE_APP_ID    || '').trim();
const CF_SECRET    = (process.env.CASHFREE_SECRET_KEY || '').trim();
const CF_ENV       = (process.env.CASHFREE_ENV        || 'production').trim();
const AMOUNT       = Number(process.env.VERIFICATION_AMOUNT || 99);
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://dolphin-main.vercel.app').trim();

// Cashfree base URL
const CF_BASE = CF_ENV === 'sandbox'
  ? 'https://sandbox.cashfree.com/pg'
  : 'https://api.cashfree.com/pg';

// ─── POST /api/verification/create-link ──────────────────────────────────────
router.post('/create-link', protect, async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;

    if (!fullName?.trim() || !phone?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Full name, phone, and email are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent duplicate payment if already verified
    if (user.isVerified) {
      return res.status(400).json({ message: 'Your profile is already verified.' });
    }

    // Prevent duplicate pending payment
    if (user.verificationPayment?.status === 'pending' && user.verificationPayment?.cfLinkId) {
      return res.status(400).json({
        message: 'A payment is already pending.',
        alreadyPending: true,
      });
    }

    if (!CF_APP_ID || !CF_SECRET) {
      return res.status(503).json({ message: 'Payment service not configured. Please contact support.' });
    }

    // Create Cashfree Payment Link
    const linkPayload = {
      customer_details: {
        customer_name:  fullName.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
      },
      link_amount:   AMOUNT,
      link_currency: 'INR',
      link_purpose:  'Dolphin Verified Badge',
      link_id:       `dolphin_verify_${req.user._id}_${Date.now()}`,
      link_notify: {
        send_sms:   false,
        send_email: false,
      },
      link_meta: {
        return_url: `${FRONTEND_URL}/dashboard?verified=1`,
        notify_url: `${process.env.BACKEND_URL || 'https://api.dolphinorg.in'}/api/verification/webhook`,
      },
    };

    const cfRes = await fetch(`${CF_BASE}/links`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id':   CF_APP_ID,
        'x-client-secret': CF_SECRET,
      },
      body: JSON.stringify(linkPayload),
    });

    const cfData = await cfRes.json();

    if (!cfRes.ok || !cfData.link_url) {
      console.error('Cashfree create-link error:', cfData);
      return res.status(502).json({
        message: cfData.message || 'Failed to create payment link. Please try again.',
      });
    }

    // Save pending payment info to user
    user.verificationPayment = {
      cfLinkId: cfData.link_id,
      status:   'pending',
      amount:   AMOUNT,
    };
    await user.save();

    res.json({
      success:  true,
      link_url: cfData.link_url,
      link_id:  cfData.link_id,
    });
  } catch (err) {
    console.error('Verification create-link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/verification/webhook ──────────────────────────────────────────
// Cashfree sends payment events here. We verify the signature and activate badge.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Cashfree sends the raw body for signature verification
    const rawBody = req.body.toString('utf8');
    const signature = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];

    // Verify signature: HMAC-SHA256(timestamp + rawBody, secret)
    if (CF_SECRET && signature && timestamp) {
      const expected = crypto
        .createHmac('sha256', CF_SECRET)
        .update(timestamp + rawBody)
        .digest('base64');

      if (expected !== signature) {
        console.warn('[Webhook] Invalid Cashfree signature — ignoring');
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type;

    // We only care about successful payment events
    if (
      eventType !== 'PAYMENT_SUCCESS_WEBHOOK' &&
      eventType !== 'LINK_PAYMENT_SUCCESS_WEBHOOK'
    ) {
      return res.status(200).json({ received: true });
    }

    const linkId  = event.data?.link?.link_id || event.data?.payment?.cf_link_id;
    const orderId = event.data?.payment?.cf_payment_id || event.data?.order?.cf_order_id;

    if (!linkId) {
      console.warn('[Webhook] No link_id in event:', event);
      return res.status(200).json({ received: true });
    }

    // Find user by cfLinkId
    const user = await User.findOne({ 'verificationPayment.cfLinkId': linkId });
    if (!user) {
      console.warn('[Webhook] No user found for link_id:', linkId);
      return res.status(200).json({ received: true });
    }

    // Idempotency — don't process twice
    if (user.isVerified) {
      return res.status(200).json({ received: true, alreadyVerified: true });
    }

    // Activate verified badge
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verificationPayment.status   = 'paid';
    user.verificationPayment.cfOrderId = orderId || '';
    user.verificationPayment.paidAt   = new Date();
    await user.save();

    console.log(`[Verification] ✅ User ${user._id} (${user.email}) verified via Cashfree`);

    // Send confirmation email (fire-and-forget)
    sendEmail({
      email:   user.email,
      subject: '🎉 Your Dolphin profile is now Verified!',
      message: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1E3A8A; margin: 0;">🐬 Dolphin</h2>
          </div>
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 72px; height: 72px; background: linear-gradient(135deg, #84CC16, #16A34A); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2rem;">✓</div>
          </div>
          <h2 style="color: #111827; text-align: center;">Your profile is now Verified!</h2>
          <p style="color: #374151; line-height: 1.7; text-align: center;">
            Hi <strong>${user.name}</strong>, your Dolphin profile has been successfully verified.
            Your verified badge is now live on your profile.
          </p>
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #065F46; margin: 0 0 12px;">What you've unlocked:</h3>
            <ul style="color: #374151; line-height: 2; margin: 0; padding-left: 20px;">
              <li>✅ Verified badge beside your profile name</li>
              <li>📈 Increased profile visibility</li>
              <li>🤝 Higher chances of getting connections</li>
              <li>⭐ Priority visibility in posts and networking</li>
              <li>🏆 Early supporter recognition in the Dolphin ecosystem</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${FRONTEND_URL}" style="display: inline-block; padding: 14px 32px; background: #84CC16; color: #0F172A; text-decoration: none; border-radius: 8px; font-weight: 700;">
              View Your Profile
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin-top: 24px;">
            &copy; 2026 Dolphin &middot; support@pacificdev.in
          </p>
        </div>
      `,
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
      .select('isVerified verifiedAt verificationPayment');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      isVerified:  user.isVerified,
      verifiedAt:  user.verifiedAt,
      paymentStatus: user.verificationPayment?.status || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
