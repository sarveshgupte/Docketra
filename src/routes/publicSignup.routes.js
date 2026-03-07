const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/publicSignup.routes.schema');
const {
  authLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
} = require('../middleware/rateLimiters');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const {
  initiateSignup,
  verifyOtp,
  resendOtp,
  completeSignup,
} = require('../controllers/publicSignup.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

// Keep the coarse public/IP limiter at the mount point and use OTP-specific
// throttles inside the signup flow to avoid generic double-throttling in development.
router.post('/initiate-signup', wrapWriteHandler(initiateSignup));
router.post('/resend-otp', otpResendLimiter, resendOtp);
router.post('/verify-otp', otpVerifyLimiter, wrapWriteHandler(verifyOtp));
router.post('/complete-signup', authLimiter, wrapWriteHandler(completeSignup));

module.exports = router;
