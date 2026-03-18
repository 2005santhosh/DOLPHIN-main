const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail'); // Import the helper we fixed earlier

// @route   POST /api/support/contact
router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // Send response immediately to frontend
    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });

    // Send email in background
    try {
        const emailOptions = {
            // IMPORTANT: Send FROM your verified domain
            email: 'support@pacificdev.in', 
            subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
            // HTML Content
            message: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>New Support Request</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Category:</strong> ${category}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p>${message?.replace(/\n/g, '<br>')}</p>
                </div>
            `,
            // CUSTOM HEADER: This tells email clients to set the "Reply-To" to the user's email
            // So when you click reply, it goes to them, not to yourself.
            headers: {
                'Reply-To': email 
            }
        };

        // Note: Your sendEmail helper needs to support 'headers' or a specific 'replyTo' field.
        // I will provide an updated sendEmail helper below to ensure this works perfectly.
        
        await sendEmail(emailOptions);
        console.log(`✅ [Support] Email successfully sent from ${email}`);

    } catch (error) {
        console.error('❌ [Support] Email Send Error:', error.message);
    }
});

module.exports = router;