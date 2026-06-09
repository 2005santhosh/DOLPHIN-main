// utils/emailTemplates.js

const getOtpEmail = (name, otp) => ({
  subject: 'Verify your Dolphin account — OTP inside',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">Hi ${name} 👋</h2>
      <p>Use the code below to verify your Dolphin account. It expires in <strong>10 minutes</strong>.</p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; font-size: 40px; font-weight: 700; letter-spacing: 14px; color: #1a1a1a; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #888; font-size: 13px;">If you didn't create a Dolphin account, you can safely ignore this email.</p>
      <br/>
      <p>Cheers,</p>
      <p><strong>The Dolphin Team</strong></p>
    </div>
  `
});

module.exports = {
  getWelcomeEmail: (name) => ({
    subject: 'Welcome to Dolphin! 🐬',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Welcome to Dolphin, ${name}!</h2>
        <p>Thanks for signing up. You are now part of a community dedicated to validating and growing startups.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Complete your profile</li>
          <li>Start your validation journey</li>
          <li>Connect with investors and providers</li>
        </ul>
        <a href="https://dolphinorg.in/login.html" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px;">Get Started</a>
        <br/><br/>
        <p>Cheers,</p>
        <p><strong>The Dolphin Team</strong></p>
      </div>
    `
  }),

  getOtpEmail,

  getNewMessageEmail: (senderName, messageContent) => ({
    subject: `New message from ${senderName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h3>You have a new message</h3>
        <p><strong>${senderName}</strong> sent you a message:</p>
        <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          "${messageContent}"
        </div>
        <a href="https://dolphinorg.in/" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">Reply Now</a>
      </div>
    `
  }),

  getNewRequestEmail: (senderName, requestType, message = '') => ({
    subject: `🤝 New ${requestType} Request on Dolphin`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FAFAFA;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0F172A; margin: 0; font-size: 1.4rem;">🐬 Dolphin</h2>
        </div>

        <div style="background: white; border-radius: 10px; padding: 28px; border: 1px solid #E5E7EB;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 1.8rem; text-align: center;">🤝</div>
          </div>

          <h2 style="color: #111827; text-align: center; margin: 0 0 8px; font-size: 1.2rem;">New ${requestType} Request</h2>
          <p style="color: #6B7280; text-align: center; margin: 0 0 20px; font-size: 0.95rem;">
            <strong style="color: #111827;">${senderName}</strong> has sent you a request on Dolphin.
          </p>

          ${message ? `
          <div style="background: #F9FAFB; border-left: 3px solid #84CC16; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #374151; font-size: 0.9rem; line-height: 1.6; font-style: italic;">"${message}"</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://www.dolphinorg.in" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #84CC16, #16A34A); color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 0.95rem;">
              View Request →
            </a>
          </div>

          <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin: 0;">
            Go to your <strong>Requests</strong> tab to accept or decline.
          </p>
        </div>

        <p style="text-align: center; color: #9CA3AF; font-size: 0.75rem; margin-top: 20px;">
          &copy; 2026 Dolphin &middot; <a href="mailto:support@pacificdev.in" style="color: #9CA3AF;">support@pacificdev.in</a>
        </p>
      </div>
    `
  }),

  getAdminNotificationEmail: (title, message) => ({
    subject: `📢 ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border-left: 5px solid #2563eb;">
        <h3>${title}</h3>
        <p>${message}</p>
        <br/>
        <p><small>You received this message because you are a registered user of Dolphin.</small></p>
      </div>
    `
  })
};