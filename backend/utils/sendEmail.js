// We no longer need nodemailer for this implementation
// const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error("BREVO_API_KEY is missing in environment variables");
    throw new Error("Email service not configured");
  }

  // Prepare the payload for Brevo API
  const data = {
    sender: {
      email: process.env.SMTP_USER || 'support@pacificdev.in', // Your verified sender email
      name: 'Dolphin Support'
    },
    to: [{ email: options.email }],
    subject: options.subject,
    htmlContent: options.message
  };

  try {
    // Use native fetch (Node 18+) or ensure 'node-fetch' is installed if on older Node
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo API Error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Email sent to ${options.email} via Brevo API. MessageID: ${result.messageId}`);
    return result;

  } catch (error) {
    console.error("Error sending email via Brevo:", error);
    throw error; // Re-throw to be caught by the controller
  }
};

module.exports = sendEmail;