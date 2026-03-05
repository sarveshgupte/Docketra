const express = require('express');
const { authLimiter } = require('../middleware/rateLimiters');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const {
  initiateSignup,
  verifyOtp,
  resendOtp,
  completeSignup,
} = require('../controllers/publicSignup.controller');

const router = express.Router();

// Rate-limited routes
router.post('/initiate-signup', authLimiter, wrapWriteHandler(initiateSignup));
router.post('/resend-otp', authLimiter, resendOtp);

// Non-rate-limited routes (protected by OTP attempts/verification logic)
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/complete-signup', authLimiter, wrapWriteHandler(completeSignup));

module.exports = router;
