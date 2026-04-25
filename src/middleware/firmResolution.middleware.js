/**
 * Firm Resolution Middleware
 * Extracts firmSlug from request and resolves to firmId
 * Attaches firmId to request context for authentication
 */

const { normalizeFirmSlug } = require('../utils/slugify');
const { getFirmInactiveCode, isActiveStatus } = require('../utils/status.utils');
const { resolveTenantBySlug } = require('../services/tenantIdentity.service');
const log = require('../utils/log');

/**
 * Resolve firmSlug to firmId and attach to request
 * Used for firm-scoped login
 * 
 * Extracts firmSlug from:
 * 1. Request body (firmSlug field)
 * 2. Request query parameter (?firmSlug=xyz)
 * 3. Route parameter (/:firmSlug)
 * 
 * Priority: body > query > params
 */
const resolveFirmSlug = async (req, res, next) => {
  try {
    // Extract firmSlug from request
    const firmSlug = req.body.firmSlug || req.query.firmSlug || req.params.firmSlug;
    
    if (!firmSlug) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }
    
    // Normalize firmSlug (lowercase, trim)
    const normalizedSlug = normalizeFirmSlug(firmSlug);
    if (!normalizedSlug) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }
    
    // Resolve firmSlug to canonical tenant
    const firm = await resolveTenantBySlug(normalizedSlug);

    log.info({
      event: 'firm_login_attempt',
      slug: normalizedSlug,
      found: !!firm,
      status: firm?.status,
    });

    if (!firm) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }
    
    if (!isActiveStatus(firm.status)) {
      return res.status(403).json({
        success: false,
        code: getFirmInactiveCode(firm.status),
        message: `This firm is currently ${String(firm.status || 'inactive').toLowerCase()}. Please contact support.`,
        action: 'contact_admin',
      });
    }
    
    // Attach firm context to request
    req.firmSlug = normalizedSlug;
    req.firmId = String(firm.tenantId || firm._id);
    req.firmIdString = firm.firmIdString || null;
    req.firmName = firm.firmName || null;
    req.firm = {
      id: req.firmId,
      slug: firm.firmSlug || normalizedSlug,
      status: firm.status,
      legacyFirmId: firm.legacyFirmId || null,
    };
    // Canonical firm context for downstream auth controllers.
    req.context = {
      ...req.context,
      firmId: req.firmId,
      firmSlug: firm.firmSlug || normalizedSlug,
    };
    
    next();
  } catch (error) {
    log.error('[FIRM_RESOLUTION] Error resolving firmSlug:', error);
    res.status(500).json({
      success: false,
      code: 'FIRM_RESOLUTION_FAILED',
      message: 'Failed to resolve firm context',
      action: 'retry',
    });
  }
};

/**
 * Optional firm resolution - doesn't fail if firmSlug is missing
 * Used for APIs that support both firm-scoped and non-firm-scoped access
 */
const optionalFirmResolution = async (req, res, next) => {
  try {
    const firmSlug = req.body.firmSlug || req.query.firmSlug || req.params.firmSlug;
    
    if (!firmSlug) {
      // No firmSlug provided, continue without firm context
      return next();
    }
    
    const normalizedSlug = normalizeFirmSlug(firmSlug);
    if (!normalizedSlug) {
      return next();
    }
    const firm = await resolveTenantBySlug(normalizedSlug);
    
    if (firm && isActiveStatus(firm.status)) {
      req.firmSlug = normalizedSlug;
      req.firmId = String(firm.tenantId || firm._id);
      req.firmIdString = firm.firmIdString || null;
      req.firmName = firm.firmName || null;
      req.context = {
        ...req.context,
        firmId: req.firmId,
        firmSlug: firm.firmSlug || normalizedSlug,
      };
    }
    
    next();
  } catch (error) {
    // Don't fail on optional resolution
    log.warn('[FIRM_RESOLUTION] Error in optional resolution:', error);
    next();
  }
};

module.exports = {
  resolveFirmSlug,
  optionalFirmResolution,
};
