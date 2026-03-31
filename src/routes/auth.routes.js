const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/auth.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmFromSlug } = require('../middleware/attachFirmFromSlug.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  authLimiter,
  authBlockEnforcer,
  forgotPasswordLimiter,
  otpResendLimiter,
  otpVerifyLimiter,
  profileLimiter,
  sensitiveLimiter,
  refreshIpLimiter,
  refreshUserLimiter,
} = require('../middleware/rateLimiters');
const {
  logout,
  changePassword,
  resetPassword,
  getProfile,
  updateProfile,
  createUser,
  activateUser,
  deactivateUser,
  resetPasswordWithToken,
  updateUserStatus,
   unlockAccount,
   forgotPassword,
   getAllUsers,
  refreshAccessToken, // NEW: JWT token refresh
  verifyTotp,
  completeMfaLogin,
  setupAccount,
  resendSetup,
  resendCredentials,
  resendLoginOtp,
  loginInit,
  loginVerify,
  loginResend,
  signupInit,
  signupVerify,
  signupResend,
  sendOtpEndpoint,
  verifyOtpEndpoint,
  forgotPasswordInit,
  forgotPasswordVerify,
  forgotPasswordResetWithOtp,
  } = require('../controllers/auth.controller');

let profileHitCount = 0;
const detectProfileLoop = (req, res, next) => {
  profileHitCount += 1;
  if (profileHitCount > 3) {
    console.error('🚨 AUTH PROFILE LOOP DETECTED');
  }
  next();
};

/**
 * Authentication and User Management Routes
 * PART A & B - xID-based Authentication & Identity Management
 * 
 * Login endpoint is PUBLIC, all other endpoints require authentication
 */

// Public authentication endpoints - NO authentication required
// Login supports optional firm resolution for firm-scoped login
// Rate limited to prevent brute-force attacks
router.post('/setup-account', authBlockEnforcer, authLimiter, setupAccount);
router.post('/resend-setup', authBlockEnforcer, authLimiter, resendSetup);
router.post('/resend-credentials', authBlockEnforcer, authLimiter, sensitiveLimiter, resendCredentials);
router.post('/resend-otp', authBlockEnforcer, authLimiter, otpResendLimiter, attachFirmFromSlug, loginResend);
router.post('/reset-password-with-token', authBlockEnforcer, authLimiter, sensitiveLimiter, resetPasswordWithToken);
router.post('/forgot-password', authBlockEnforcer, forgotPasswordLimiter, sensitiveLimiter, forgotPassword);
router.post('/forgot-password/init', authBlockEnforcer, forgotPasswordLimiter, sensitiveLimiter, attachFirmFromSlug, forgotPasswordInit);
router.post('/forgot-password/verify', authBlockEnforcer, authLimiter, otpVerifyLimiter, attachFirmFromSlug, forgotPasswordVerify);
router.post('/forgot-password/reset', authBlockEnforcer, authLimiter, sensitiveLimiter, attachFirmFromSlug, forgotPasswordResetWithOtp);
router.post('/login/init', authBlockEnforcer, authLimiter, attachFirmFromSlug, loginInit);
router.post('/login/verify', authBlockEnforcer, authLimiter, otpVerifyLimiter, attachFirmFromSlug, loginVerify);
router.post('/login/resend', authBlockEnforcer, authLimiter, otpResendLimiter, attachFirmFromSlug, loginResend);
router.post('/refresh', refreshIpLimiter, refreshUserLimiter, refreshAccessToken); // NEW: JWT token refresh
router.post('/verify-totp', otpVerifyLimiter, verifyTotp);
router.post('/complete-mfa-login', otpVerifyLimiter, completeMfaLogin);
router.post('/signup/init', authBlockEnforcer, authLimiter, signupInit);
router.post('/signup/verify', authBlockEnforcer, authLimiter, otpVerifyLimiter, signupVerify);
router.post('/signup/resend', authBlockEnforcer, authLimiter, otpResendLimiter, signupResend);
router.post('/send-otp', authBlockEnforcer, authLimiter, otpResendLimiter, sendOtpEndpoint);
router.post('/verify-otp', authBlockEnforcer, authLimiter, otpVerifyLimiter, verifyOtpEndpoint);

// Protected authentication endpoints - require authentication
router.post('/logout', sensitiveLimiter, authenticate, logout);
router.post('/change-password', sensitiveLimiter, authenticate, changePassword);

// Profile endpoints - require authentication
router.get('/profile', profileLimiter, authenticate, detectProfileLoop, getProfile);
router.put('/profile', profileLimiter, authenticate, updateProfile);

// Admin-only endpoints - require authentication and admin role
router.post('/reset-password', sensitiveLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), resetPassword);
// NOTE: resend-setup-email has been moved to /api/admin/users/:xID/resend-invite (PR #48)
// This ensures admin actions bypass password enforcement middleware
router.post('/unlock-account', sensitiveLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), unlockAccount);
router.get('/admin/users', profileLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_VIEW'), getAllUsers);
router.post('/admin/users', sensitiveLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), createUser);
router.put('/admin/users/:xID/activate', sensitiveLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), activateUser);
router.put('/admin/users/:xID/deactivate', sensitiveLimiter, authenticate, attachFirmContext, authorizeFirmPermission('USER_MANAGE'), deactivateUser);

module.exports = router;
