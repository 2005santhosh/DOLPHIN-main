const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Debug: Check if variables are loaded
console.log('SMTP Config Check:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER ? 'Found' : 'MISSING!',
    pass: process.env.SMTP_PASS ? 'Found' : 'MISSING!'
});

// 1. Verify Credentials exist
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('FATAL ERROR: SMTP_USER or SMTP_PASS is missing in .env file');
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // Should be smtp.zoho.in
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === 'true', // MUST be 'true' for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    debug: true, 
    logger: true 
});

// @route   POST /api/support/contact
router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // ✅ FIX: Send response IMMEDIATELY so frontend is fast
    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });

    // ✅ FIX: Send email in background (No more res.status here)
    try {
        const mailOptions = {
            from: `"Dolphin Support" <${process.env.SMTP_USER}>`, // MUST match SMTP_USER
            to: 'support@pacificdev.in', 
            replyTo: email,
            subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
            text: `You have a new support request.\n\nCategory: ${category}\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0d9488;">New Support Request</h2>
                    <p><strong>Category:</strong> ${category}</p>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p>${message?.replace(/\n/g, '<br>')}</p>
                </div>
            `
        };

        // Send Email
        await transporter.sendMail(mailOptions);
        console.log(`✅ [Support] Email successfully sent to support@pacificdev.in from ${email}`);

    } catch (error) {
        // ✅ LOG THE ERROR CLEARLY
        console.error('❌ [Support] Email Send Error:', error);
    }
});

module.exports = router;