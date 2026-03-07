const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/publicSignup.routes.schema');
const { authLimiter, signupLimiter } = require('../middleware/rateLimiters');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const {
  initiateSignup,
  verifyOtp,
  resendOtp,
  completeSignup,
} = require('../controllers/publicSignup.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

// Rate-limited routes
router.post('/initiate-signup', authLimiter, signupLimiter, wrapWriteHandler(initiateSignup));
router.post('/resend-otp', authLimiter, resendOtp);

// Non-rate-limited routes (protected by OTP attempts/verification logic)
router.post('/verify-otp', authLimiter, wrapWriteHandler(verifyOtp));
router.post('/complete-signup', authLimiter, wrapWriteHandler(completeSignup));

module.exports = router;
