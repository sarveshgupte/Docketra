const express = require('express');
const router = express.Router();

/**
 * POST /api/contact
 *
 * Public contact form submission endpoint.
 * Validates input and logs the enquiry. No authentication required.
 */
router.post('/', (req, res) => {
  const { name, company, email, message } = req.body || {};

  // Basic validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!company || typeof company !== 'string' || !company.trim()) {
    return res.status(400).json({ error: 'Company is required.' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Log the enquiry (no PII in structured fields beyond what was submitted)
  console.log('[Contact] Enquiry received', {
    company: company.trim(),
    emailDomain: email.trim().split('@')[1] || '',
    messageLength: message.trim().length,
  });

  return res.status(200).json({ success: true });
});

module.exports = router;
