const User = require('../models/User.model');
const jwtService = require('../services/jwt.service');
const { isSuperAdminRole } = require('../utils/role.utils');
const metricsService = require('../services/metrics.service');
const { getCookieValue } = require('../utils/requestCookies');
const { isActiveStatus, getFirmInactiveCode } = require('../utils/status.utils');
const { buildRequestContext } = require('./attachRequestContext');

const MUST_SET_ALLOWED_PATHS = [
  '/auth/profile',
  '/api/auth/profile',
  '/auth/setup-account',
  '/api/auth/setup-account',
  '/auth/reset-password',
  '/api/auth/reset-password',
  '/auth/reset-password-with-token',
  '/api/auth/reset-password-with-token',
];

/**
 * Authentication Middleware for Docketra Case Management System
 * 
 * Validates JWT Bearer tokens and attaches user data to request
 * Enforces firm-level data isolation
 * 
 * PART A - Authentication & Access Control
 */

/**
 * Authenticate user - validate JWT and attach full user data to request
 * Verifies JWT token from Authorization header
 * Verifies user exists and is active
 * Attaches user document to req.user with userId, firmId, role
 * Special case: allows password changes for users with mustChangePassword flag
 */
const authenticate = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const noteAuthFailure = () => metricsService.recordAuthFailure(req.originalUrl || req.url);
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    let token = jwtService.extractTokenFromHeader(authHeader);
    
    // Fallback to accessToken cookie (Google OAuth sets HTTP-only cookies)
    if (!token) {
      const cookieHeader = req.headers.cookie;
      token = getCookieValue(cookieHeader, 'accessToken');
    }
    
    if (!token) {
      noteAuthFailure();
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }
    
    // Verify and decode JWT
    let decoded;
    try {
      decoded = jwtService.verifyAccessToken(token);
    } catch (error) {
      if (error.message === 'Token expired') {
        noteAuthFailure();
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED',
        });
      }
      noteAuthFailure();
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }
    
    // ============================================================
    // SUPERADMIN TOKEN HANDLING (NO DATABASE LOOKUP)
    // ============================================================
    // SuperAdmin tokens have role: 'SuperAdmin' or 'SUPERADMIN' and userId: SUPERADMIN_OBJECT_ID
    // They never have firmId or defaultClientId
    const superadminObjectId = process.env.SUPERADMIN_OBJECT_ID?.trim();
    if (decoded.userId === superadminObjectId && isSuperAdminRole(decoded.role)) {
      console.log('[AUTH][superadmin] SuperAdmin token authenticated');
      
      const normalizedRole = 'SuperAdmin';
      const superadminXID = process.env.SUPERADMIN_XID || 'SUPERADMIN';
      const superadminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@docketra.local';
      
      // Attach SuperAdmin pseudo-user to request
      req.user = {
        xID: superadminXID,
        email: superadminEmail,
        role: normalizedRole,
        _id: superadminObjectId, // Static ObjectId keeps SuperAdmin env-backed but ObjectId-safe
        isActive: true,
        firmId: null,
        defaultClientId: null,
      };
      
      // Attach decoded JWT data
      req.jwt = {
        userId: superadminObjectId,
        role: decoded.role || normalizedRole,
        firmId: null,
        firmSlug: null,
        defaultClientId: null,
        isSuperAdmin: true,
      };
      req.userId = superadminObjectId;
      req.identity = {
        userId: superadminObjectId,
        firmId: null,
        role: normalizedRole,
      };
      req.isSuperAdmin = true;
      req.context = {
        ...(req.context || {}),
        ...buildRequestContext(req),
      };
      
      return next();
    }
    
    // ============================================================
    // NORMAL USER TOKEN HANDLING (DATABASE LOOKUP)
    // ============================================================
    
    // Find user by ID from token
    const userQuery = { _id: decoded.userId };
    if (decoded.firmId) {
      userQuery.firmId = decoded.firmId;
    }
    const user = await User.findOne(userQuery);
    
    if (!user) {
      noteAuthFailure();
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication credentials.',
      });
    }
    
    // Check if user is active
    if (!isActiveStatus(user.status)) {
      noteAuthFailure();
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.',
      });
    }

    // Hard guard: block all authenticated routes until password is set
    const rawPath = (req.originalUrl || req.path || '').split('?')[0];
    const normalizedCandidates = [
      rawPath,
      req.path,
      `${req.baseUrl || ''}${req.path || ''}`,
    ].filter(Boolean);
    // DO NOT use passwordSet here; mustSetPassword is the only onboarding gate.
    const isPasswordSetupAllowed = normalizedCandidates.some(p => MUST_SET_ALLOWED_PATHS.includes(p));
    if (user.mustSetPassword && !isPasswordSetupAllowed) {
      noteAuthFailure();
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_SETUP_REQUIRED',
        mustSetPassword: true,
        message: 'You must set your password before accessing this resource.',
        redirectPath: '/auth/setup-account',
      });
    }
    
    // Verify firmId matches (multi-tenancy check)
    // Skip this check for SUPER_ADMIN (they have no firmId)
    if (user.role !== 'SUPER_ADMIN') {
      if (user.firmId && decoded.firmId && user.firmId.toString() !== decoded.firmId.toString()) {
        noteAuthFailure();
        return res.status(403).json({
          success: false,
          message: 'Firm access violation detected.',
        });
      }
    }
    
    // Check if user's organization is suspended (Superadmin exempt)
    // NOTE: This DB lookup is for runtime state check (SUSPENDED status), not authorization
    // Authorization decisions use JWT claims (req.jwt.firmId, req.jwt.firmSlug)
    if (user.role !== 'SUPER_ADMIN' && user.firmId) {
      // Try default-client lookup first (new architecture), fall back to Firm (legacy)
      const Client = require('../models/Client.model');
      const defaultClient = await Client.findOne({ _id: user.firmId, isDefaultClient: true })
        .select('status').lean();
      if (defaultClient) {
        if (defaultClient.status && !isActiveStatus(defaultClient.status)) {
          noteAuthFailure();
          return res.status(403).json({
            success: false,
            message: `Your account is currently ${String(defaultClient.status || 'inactive').toLowerCase()}. Please contact support.`,
            code: getFirmInactiveCode(defaultClient.status),
          });
        }
      } else {
        // Legacy Firm lookup
        let Firm;
        try { Firm = require('../models/Firm.model'); } catch (_) { /* no Firm model */ }
        if (Firm) {
          const firm = await Firm.findById(user.firmId).select('status').lean();
          if (firm && !isActiveStatus(firm.status)) {
            noteAuthFailure();
            return res.status(403).json({
              success: false,
              message: `Your firm is currently ${String(firm.status || 'inactive').toLowerCase()}. Please contact support.`,
              code: getFirmInactiveCode(firm.status),
            });
          }
        }
      }
    }
    
    // Special case: allow change-password and profile endpoints even if mustChangePassword is true
    // Check if this is the change-password or profile endpoint
    const isChangePasswordEndpoint = rawPath.endsWith('/change-password') || (req.path || '').endsWith('/change-password');
    const isRefreshEndpoint = rawPath.endsWith('/refresh') || (req.path || '').endsWith('/refresh');
    const isProfileEndpoint = rawPath.endsWith('/profile') || (req.path || '').endsWith('/profile');
    
    // Block access to other routes if password change is required
    // IMPORTANT: Admin users are exempt from this restriction to allow user management operations
    // (e.g., resending invite emails for users without passwords)
    if (user.mustChangePassword && !isChangePasswordEndpoint && !isProfileEndpoint && !isRefreshEndpoint) {
      if (user.role === 'Admin') {
        // Log admin exemption for audit purposes
        console.log(`[AUTH] Admin user ${user.xID} accessing ${req.method} ${req.path} with mustChangePassword=true (exempted from password enforcement)`);
      } else {
        noteAuthFailure();
        return res.status(403).json({
          success: false,
          message: 'You must change your password before accessing other resources.',
          mustChangePassword: true,
        });
      }
    }
    
    if (!user.role && !decoded.role) {
      throw new Error('Authentication failed: role missing');
    }

    // Attach normalized auth context to request
    // NOTE: role is mandatory for downstream repository authorization checks.
    req.user = {
      ...user.toObject(),
      _id: user?._id ? user._id.toString() : decoded.userId,
      id: user?._id ? user._id.toString() : decoded.userId,
      xID: user.xID,
      email: user.email,
      role: user.role || decoded.role,
      firmId: user.firmId || decoded.firmId || null,
      defaultClientId: user.defaultClientId || decoded.defaultClientId || null,
    };

    console.log('[AUTH_USER]', {
      xID: req.user.xID,
      role: req.user.role,
    });
    
    // OBJECTIVE 2 & 3: Attach decoded JWT data including firm context for authorization
    // This makes firmSlug and defaultClientId available for route handlers
    req.jwt = {
      userId: decoded.userId,
      firmId: decoded.firmId || null, // May be null for SUPER_ADMIN
      firmSlug: decoded.firmSlug || null, // NEW: Make firmSlug available from token
      defaultClientId: decoded.defaultClientId || null, // NEW: Make defaultClientId available from token
      role: decoded.role,
    };
    // Canonical identity attachment: use Mongo _id as the single source of truth
    req.userId = user?._id ? user._id.toString() : decoded.userId;
    req.identity = {
      userId: req.userId,
      firmId: req.jwt.firmId || (user?.firmId ? user.firmId.toString() : null),
      role: req.jwt.role || user?.role || null,
    };
    req.context = {
      ...(req.context || {}),
      ...buildRequestContext(req),
    };

    next();
  } catch (error) {
    console.error('[AUTH] Authentication error:', error);
    if (error.message === 'Authentication failed: role missing') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_ROLE_MISSING',
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      code: 'AUTH_MIDDLEWARE_ERROR',
      message: 'Authentication error',
    });
  }
};

module.exports = { authenticate };
