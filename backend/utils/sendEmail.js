const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create a transporter (Using your Zoho config)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtp.zoho.in
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
      user: process.env.SMTP_USER, // support@pacificdev.in
      pass: process.env.SMTP_PASS
    }
  });

  // 2. Define email options
  const mailOptions = {
    from: `"Dolphin Support" <${process.env.SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message
  };

  // 3. Actually send email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;