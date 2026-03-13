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
            // ... inside the try block ...
    
    const emailData = {
        // CHANGE 1: Use a verified external email as the sender to avoid "Self-Sending" rejection.
        // You can use the email you signed up to Brevo with, or verify a generic one like 'no-reply@brevo.com' (if allowed).
        // Ideally, use a verified email like your personal email for testing:
        senderEmail: 'damerasanthosh2005@gmail.com', // REPLACE with a verified sender in Brevo
        senderName: `${name} (via Dolphin)`, // Shows the user's name clearly
        
        toEmail: 'support@pacificdev.in',    // Your support inbox
        replyTo: email,                      // User's email (so when you click reply, it goes to them)
        
        subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <p><strong>From:</strong> ${name} (${email})</p>
                <p><strong>Category:</strong> ${category}</p>
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