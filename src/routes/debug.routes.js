const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { sendTestEmail } = require('../services/email.service');

/**
 * Debug Routes
 * PR #43 - Debug and testing endpoints
 * All routes require authentication and admin role
 */

/**
 * Send test email
 * GET /api/debug/email-test
 * 
 * Sends a test email to verify SMTP configuration
 * Admin-only endpoint for debugging and validation
 */
router.get('/email-test', authenticate, requireAdmin, async (req, res) => {
  try {
    // Use authenticated user's email or query parameter
    const testEmail = req.query.email || req.user.email;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required. Provide ?email=your@email.com',
      });
    }
    
    console.log(`[DEBUG] Sending test email to ${testEmail} (requested by ${req.user.xID})`);
    
    // Send test email
    const result = await sendTestEmail(testEmail);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        recipient: testEmail,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
        smtpConfig: {
          host: process.env.SMTP_HOST || 'Not configured',
          port: process.env.SMTP_PORT || 'Not configured',
          user: process.env.SMTP_USER ? 'Configured' : 'Not configured',
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'Not configured',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
        recipient: testEmail,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[DEBUG] Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message,
    });
  }
});

module.exports = router;
