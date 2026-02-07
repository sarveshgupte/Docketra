const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { isSuperAdminRole } = require('../utils/role.utils');

// Constants
const FIRM_ID_PATTERN = /^FIRM\d{3,}$/i;

/**
 * Firm Context Middleware (single source of truth)
 * - Extracts firmId/firmSlug from JWT, session, or path params
 * - Blocks SuperAdmin from firm-scoped routes UNLESS impersonating
 * - Asserts firmId presence for non-superadmin requests
 * - Attaches req.firmId and req.firmSlug
 */
const firmContext = async (req, res, next) => {
  const requestId = req.requestId || randomUUID();
  req.requestId = requestId;

  try {
    if (req.skipFirmContext) {
      return next();
    }
    
    // 3️⃣ Detect SuperAdmin using multiple signals (defensive)
    const isSuperAdmin = 
      (req.user && isSuperAdminRole(req.user.role)) ||
      req.jwt?.isSuperAdmin === true ||
      req.isSuperAdmin === true;
    
    req.isSuperAdmin = isSuperAdmin;

    // NEW: Check if SuperAdmin is impersonating a firm
    const impersonatedFirmId = req.headers?.['x-impersonated-firm-id'];
    const impersonationSessionId = req.headers?.['x-impersonation-session-id'];
    const impersonationMode = req.headers?.['x-impersonation-mode'] || 'READ_ONLY';
    
    if (isSuperAdmin) {
      // If SuperAdmin is NOT impersonating, block access to firm-scoped routes
      if (!impersonatedFirmId) {
        console.warn(`[FIRM_CONTEXT][${requestId}] SuperAdmin boundary violation on ${req.method} ${req.originalUrl}`);
        return res.status(403).json({
          success: false,
          message: 'Superadmin cannot access firm-scoped routes',
        });
      }
      
      // If SuperAdmin IS impersonating, require session ID
      if (!impersonationSessionId) {
        console.warn(`[FIRM_CONTEXT][${requestId}] SuperAdmin impersonation missing session ID on ${req.method} ${req.originalUrl}`);
        return res.status(403).json({
          success: false,
          message: 'Impersonation session ID is required',
        });
      }
      
      // SuperAdmin IS impersonating with valid session - validate and allow access
      console.log(`[FIRM_CONTEXT][${requestId}] SuperAdmin impersonating firm: ${impersonatedFirmId}, session: ${impersonationSessionId}`);
    }

    const normalizeSlug = (slug) => (slug ? slug.toLowerCase().trim() : null);

    const paramFirmId = req.params?.firmId;
    const paramFirmSlug = normalizeSlug(req.params?.firmSlug);
    const jwtFirmId = req.jwt?.firmId;
    const sessionFirmId = req.user?.firmId;

    const lookup = [];

    // If SuperAdmin is impersonating, prioritize the impersonated firm ID
    if (isSuperAdmin && impersonatedFirmId) {
      if (mongoose.Types.ObjectId.isValid(impersonatedFirmId)) {
        lookup.push({ _id: impersonatedFirmId });
      }
    }

    if (paramFirmSlug) {
      lookup.push({ firmSlug: paramFirmSlug });
    }

    if (paramFirmId) {
      if (FIRM_ID_PATTERN.test(paramFirmId)) {
        lookup.push({ firmId: paramFirmId.toUpperCase() });
      }
      if (mongoose.Types.ObjectId.isValid(paramFirmId)) {
        lookup.push({ _id: paramFirmId });
      }
    }

    if (jwtFirmId && mongoose.Types.ObjectId.isValid(jwtFirmId)) {
      lookup.push({ _id: jwtFirmId });
    }

    if (sessionFirmId && mongoose.Types.ObjectId.isValid(sessionFirmId)) {
      lookup.push({ _id: sessionFirmId });
    }

    const firm = lookup.length > 0 ? await Firm.findOne({ $or: lookup }) : null;

    if (!firm) {
      console.error(`[FIRM_CONTEXT][${requestId}] Firm context missing or unresolved`, {
        path: req.originalUrl,
        jwtFirmId: jwtFirmId || null,
        paramFirmId: paramFirmId || null,
        paramFirmSlug: paramFirmSlug || null,
        impersonatedFirmId: impersonatedFirmId || null,
      });
      const error = new Error('Firm context missing');
      error.statusCode = 400;
      throw error;
    }

    if (firm.status !== 'ACTIVE') {
      console.warn(`[FIRM_CONTEXT][${requestId}] Firm disabled`, { firmId: firm._id.toString(), status: firm.status });
      return res.status(403).json({
        success: false,
        message: 'Firm is disabled. Please contact support.',
      });
    }

    // For non-SuperAdmin users, validate firm ownership
    if (!isSuperAdmin && jwtFirmId && firm._id.toString() !== jwtFirmId.toString()) {
      console.error(`[FIRM_CONTEXT][${requestId}] Firm mismatch detected`, {
        tokenFirmId: jwtFirmId,
        resolvedFirmId: firm._id.toString(),
      });
      return res.status(403).json({
        success: false,
        message: 'Firm mismatch detected for authenticated user',
      });
    }

    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.firmId = firm._id.toString();
    req.firmSlug = firm.firmSlug;
    
    // Attach impersonation context for auditing
    if (isSuperAdmin && impersonatedFirmId) {
      req.context = {
        isSuperAdmin: true,
        isGlobalContext: false,
        impersonatedFirmId: firm._id.toString(),
        impersonationSessionId,
        impersonationMode,
      };
    }

    console.log(`[FIRM_CONTEXT][${requestId}] Firm context resolved`, { 
      firmId: req.firmId, 
      firmSlug: req.firmSlug,
      impersonating: !!(isSuperAdmin && impersonatedFirmId),
      mode: impersonationMode
    });
    
    // CRITICAL: Enforce read-only mode AFTER firm context is attached
    // Block mutations when SuperAdmin is in READ_ONLY mode
    const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    
    if (
      req.context?.isSuperAdmin &&
      req.context?.impersonationMode === 'READ_ONLY' &&
      MUTATING_METHODS.has(req.method)
    ) {
      console.warn(`[FIRM_CONTEXT][${requestId}] Read-only impersonation: blocked ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: 'Read-only impersonation: write operations are not allowed',
      });
    }
    
    return next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[FIRM_CONTEXT][${requestId}] Error attaching firm context:`, error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Firm context missing' : 'Failed to resolve firm context',
      error: error.message,
    });
  }
};

module.exports = {
  firmContext,
};
