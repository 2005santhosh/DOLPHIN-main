const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');

router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });

    try {
        const emailOptions = {
            // FIX 1: Do NOT use 'support@pacificdev.in' as the FROM address if sending TO the same address.
            // Use a generic "noreply" address or the address verified in your Brevo sender.
            // If you don't have a noreply address, keep the verified one, but see the recommendation below.
            email: 'support@pacificdev.in', // The recipient (Your support team)
            
            subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
            
            // FIX 2: Pass 'replyTo' as a direct property, not inside 'headers'
            replyTo: email, 

            // FIX 3: Update the name so the inbox shows who actually sent it
            name: `${name} (via Dolphin Form)`, 
            
            message: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>New Support Request</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Category:</strong> ${category}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p>${message?.replace(/\n/g, '<br>')}</p>
                </div>
            `
        };

        await sendEmail(emailOptions);
        console.log(`✅ [Support] Email successfully sent from ${email}`);

    } catch (error) {
        console.error('❌ [Support] Email Send Error:', error.message);
    }
});

module.exports = router;