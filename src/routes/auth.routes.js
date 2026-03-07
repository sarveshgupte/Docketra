const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/auth.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const {
  authLimiter,
  authBlockEnforcer,
  forgotPasswordLimiter,
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
router.post('/reset-password-with-token', authBlockEnforcer, authLimiter, sensitiveLimiter, resetPasswordWithToken);
router.post('/forgot-password', authBlockEnforcer, forgotPasswordLimiter, sensitiveLimiter, forgotPassword);
router.post('/refresh', refreshIpLimiter, refreshUserLimiter, refreshAccessToken); // NEW: JWT token refresh
router.post('/verify-totp', authLimiter, verifyTotp);
router.post('/complete-mfa-login', authLimiter, completeMfaLogin);

// Protected authentication endpoints - require authentication
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

// Profile endpoints - require authentication
router.get('/profile', authenticate, profileLimiter, detectProfileLoop, getProfile);
router.put('/profile', authenticate, profileLimiter, updateProfile);

// Admin-only endpoints - require authentication and admin role
router.post('/reset-password', authenticate, requireAdmin, resetPassword);
// NOTE: resend-setup-email has been moved to /api/admin/users/:xID/resend-invite (PR #48)
// This ensures admin actions bypass password enforcement middleware
router.post('/unlock-account', authenticate, requireAdmin, unlockAccount);
router.get('/admin/users', authenticate, requireAdmin, getAllUsers);
router.post('/admin/users', authenticate, requireAdmin, createUser);
router.put('/admin/users/:xID/activate', authenticate, requireAdmin, activateUser);
router.put('/admin/users/:xID/deactivate', authenticate, requireAdmin, deactivateUser);

module.exports = router;
