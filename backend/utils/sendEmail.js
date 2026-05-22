const sendEmail = async (options) => {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();

  if (!apiKey) {
    console.error('BREVO_API_KEY is missing or empty in environment variables');
    throw new Error('Email service not configured');
  }

  const senderEmail = (process.env.SMTP_USER || 'support@pacificdev.in').trim();

  const data = {
    sender: {
      email: options.senderEmail || senderEmail,
      name: options.senderName || options.name || 'Dolphin',
    },
    to: [{ email: options.email }],
    subject: options.subject,
    htmlContent: options.message,
    ...(options.replyTo ? { replyTo: { email: options.replyTo } } : {}),
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`Brevo API Error ${response.status}:`, errorText);
      throw new Error(`Failed to send email (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Email sent to ${options.email} — MessageID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('sendEmail error:', error.message);
    throw error;
  }
};

module.exports = sendEmail;