const express = require('express');
const router = express.Router();

// Helper function to send email via Brevo API (Port 443)
async function sendEmailWithBrevo({ senderEmail, senderName, toEmail, replyTo, subject, htmlContent }) {
    const apiKey = process.env.BREVO_API_KEY;
    
    if (!apiKey) throw new Error("BREVO_API_KEY is missing in environment variables");

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: JSON.stringify({
            sender: { email: senderEmail, name: senderName },
            to: [{ email: toEmail }],
            replyTo: { email: replyTo },
            subject: subject,
            htmlContent: htmlContent
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// @route   POST /api/support/contact
router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // Send response immediately to frontend
    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });

    // Send email in background using API
    try {
        const emailData = {
            senderEmail: 'support@pacificdev.in', // Must be a verified sender in Brevo
            senderName: 'Dolphin Support',
            toEmail: 'support@pacificdev.in',    // Where you want to receive the ticket
            replyTo: email,                      // User's email
            subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
            htmlContent: `
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

        await sendEmailWithBrevo(emailData);
        console.log(`✅ [Support] Email successfully sent via Brevo API from ${email}`);

    } catch (error) {
        console.error('❌ [Support] Email Send Error:', error.message);
    }
});

module.exports = router;