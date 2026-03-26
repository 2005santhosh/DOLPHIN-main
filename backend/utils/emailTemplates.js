// utils/emailTemplates.js

module.exports = {
  getWelcomeEmail: (name) => ({
    subject: 'Welcome to Dolphin! 🐬',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Welcome to Dolphin, ${name}!</h2>
        <p>Thanks for signing up. You are now part of a community dedicated to validating and growing startups.</p>
        <p>Here’s what you can do next:</p>
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

  getNewRequestEmail: (senderName, requestType) => ({
    subject: `New ${requestType} Request`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h3>New Connection Request</h3>
        <p>You have received a new <strong>${requestType}</strong> request from <strong>${senderName}</strong>.</p>
        <p>Please log in to your dashboard to review and accept or reject the request.</p>
        <a href="https://dolphinorg.in/" style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px;">View Requests</a>
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