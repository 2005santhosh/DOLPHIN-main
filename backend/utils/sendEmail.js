const sendEmail = async (options) => {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error("BREVO_API_KEY is missing in environment variables");
    throw new Error("Email service not configured");
  }

  const data = {
    sender: {
      // USE SPECIFIC SENDER IF PROVIDED, OTHERWISE DEFAULT TO ENV VARIABLE
      email: options.senderEmail || process.env.SMTP_USER || 'support@pacificdev.in', 
      name: options.senderName || options.name || 'Dolphin Support'
    },
    to: [{ email: options.email }],
    subject: options.subject,
    htmlContent: options.message,
    // Handle Reply-To
    replyTo: options.replyTo ? { email: options.replyTo } : undefined
  };

  try {
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
    throw error; 
  }
};

module.exports = sendEmail;