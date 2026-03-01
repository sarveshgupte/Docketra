const express = require('express');
const { authLimiter } = require('../middleware/rateLimiters');
const {
  initiateSignup,
  verifyOtp,
  resendOtp,
  googleAuth,
  completeSignup,
} = require('../controllers/publicSignup.controller');

const router = express.Router();

// Rate-limited routes
router.post('/initiate-signup', authLimiter, initiateSignup);
router.post('/resend-otp', authLimiter, resendOtp);
router.post('/google-auth', authLimiter, googleAuth);

// Non-rate-limited routes (protected by OTP attempts/verification logic)
router.post('/verify-otp', verifyOtp);
router.post('/complete-signup', completeSignup);

module.exports = router;
