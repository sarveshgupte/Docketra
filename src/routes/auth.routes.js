const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/permission.middleware');
const { optionalFirmResolution, resolveFirmSlug } = require('../middleware/firmResolution.middleware');
const Firm = require('../models/Firm.model');
const { authLimiter, profileLimiter } = require('../middleware/rateLimiters');
const {
  login,
  logout,
  changePassword,
  resetPassword,
  getProfile,
  updateProfile,
  createUser,
  activateUser,
  deactivateUser,
  setPassword,
  resetPasswordWithToken,
  updateUserStatus,
   unlockAccount,
   forgotPassword,
   getAllUsers,
  refreshAccessToken, // NEW: JWT token refresh
  initiateGoogleAuth,
  handleGoogleCallback,
  verifyOAuthState,
  } = require('../controllers/auth.controller');

const resolveOAuthFirmContext = async (req, res, next) => {
  try {
    const { state, code } = req.query;
    if (!state || !code) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state',
      });
    }

    let statePayload;
    try {
      statePayload = verifyOAuthState(state);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OAuth state',
      });
    }

    const firmSlug = statePayload?.firmSlug ? statePayload.firmSlug.toLowerCase().trim() : null;
    if (!firmSlug) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }

    const firm = await Firm.findOne({ firmSlug });
    if (!firm) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }

    if (firm.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        code: 'FIRM_SUSPENDED',
        message: `This firm is currently ${firm.status.toLowerCase()}. Please contact support.`,
        action: 'contact_admin',
      });
    }

    req.firmId = firm._id.toString();
    req.firmSlug = firm.firmSlug;
    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.context = {
      ...req.context,
      firmId: firm._id.toString(),
      firmSlug: firm.firmSlug,
    };
    req.oauthState = {
      ...statePayload,
      firmSlug,
    };

    return next();
  } catch (error) {
    console.error('[AUTH] Failed to resolve OAuth firm context:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve firm context',
    });
  }
};

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
router.post('/login', authLimiter, optionalFirmResolution, login);
router.post('/set-password', resolveFirmSlug, authLimiter, setPassword);
router.post('/reset-password-with-token', authLimiter, resetPasswordWithToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/refresh', refreshAccessToken); // NEW: JWT token refresh
router.get('/google', authLimiter, initiateGoogleAuth);
router.get('/google/callback', authLimiter, resolveOAuthFirmContext, handleGoogleCallback);

// Protected authentication endpoints - require authentication
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

// Profile endpoints - require authentication
router.get('/profile', profileLimiter, detectProfileLoop, authenticate, getProfile);
router.put('/profile', profileLimiter, authenticate, updateProfile);

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
