const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Debug: Check if variables are loaded (Remove this after fixing)
console.log('SMTP Config Check:', {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER ? 'Found' : 'MISSING!',
    pass: process.env.SMTP_PASS ? 'Found' : 'MISSING!'
});

// 1. Verify Credentials exist
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('ERROR: SMTP_USER or SMTP_PASS is missing in .env file');
}
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    debug: true, // Keep this on for now
    logger: true 
});

// @route   POST /api/support/contact
router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }
    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });
    try {
        const mailOptions = {
            from: `"Dolphin Support" <${process.env.SMTP_USER}>`,
            to: 'support@pacificdev.in', 
            replyTo: email,
            subject: `[Dolphin Support - ${category.toUpperCase()}] ${subject}`,
            text: `
                    You have a new support request.

                    Category: ${category}
                    Name: ${name}
                    Email: ${email}
                    Subject: ${subject}

                    Message:
                        ${message}
                       `,
                        html: `
                                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                                    <h2 style="color: #0d9488;">New Support Request</h2>
                                    <p><strong>Category:</strong> ${category}</p>
                                    <p><strong>Name:</strong> ${name}</p>
                                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                                    <p><strong>Subject:</strong> ${subject}</p>
                                    <hr>
                                    <p><strong>Message:</strong></p>
                                    <p>${message.replace(/\n/g, '<br>')}</p>
                                </div>
                            `
        };

        // Send Email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: 'Email sent successfully' });
        console.log(`[Support] New ticket from ${name} <${email}>: ${subject}`);
    } catch (error) {
        console.error('Email Send Error:', error);
        res.status(500).json({ success: false, message: 'Server error: Could not send email' });
    }
});

module.exports = router;