const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');

router.post('/contact', async (req, res) => {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // Respond immediately to the user
    res.status(200).json({ success: true, message: 'Message received! We will get back to you soon.' });

    try {
        const emailOptions = {
            // 1. WHO IS THE RECIPIENT? (Your support team)
            email: 'support@pacificdev.in', 
            
            // 2. WHO IS THE SENDER? (The new address you verified in Step 1)
            // This PREVENTS the "Soft Bounce" because Sender != Recipient.
            senderEmail: 'noreply@pacificdev.in', 
            
            // 3. DISPLAY NAME (Shows who actually submitted the form)
            senderName: `${name} (via Dolphin Form)`, 
            
            subject: `[Dolphin Support - ${category?.toUpperCase() || 'N/A'}] ${subject}`,
            
            // 4. REPLY-TO (The actual user's email)
            replyTo: email, 
            
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
        console.log(`✅ [Support] Ticket sent from ${email}`);

    } catch (error) {
        console.error('❌ [Support] Email Send Error:', error.message);
    }
});

module.exports = router;