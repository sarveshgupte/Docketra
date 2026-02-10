/**
 * Firm Resolution Middleware
 * Extracts firmSlug from request and resolves to firmId
 * Attaches firmId to request context for authentication
 */

const Firm = require('../models/Firm.model');
const { normalizeFirmSlug } = require('../utils/slugify');

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
    
    // Resolve firmSlug to firm
    const firm = await Firm.findOne({ firmSlug: normalizedSlug });
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm not found. Please check your login URL.',
        action: 'contact_admin',
      });
    }
    
    // Check if firm is active
    if (firm.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        code: 'FIRM_SUSPENDED',
        message: `This firm is currently ${firm.status.toLowerCase()}. Please contact support.`,
        action: 'contact_admin',
      });
    }
    
    // Attach firm context to request
    req.firmSlug = normalizedSlug;
    req.firmId = firm._id.toString();
    req.firmIdString = firm.firmId; // String format (e.g., FIRM001)
    req.firmName = firm.name;
    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    // Canonical firm context for downstream auth controllers.
    req.context = {
      ...req.context,
      firmId: firm._id.toString(),
      firmSlug: firm.firmSlug,
    };
    
    next();
  } catch (error) {
    console.error('[FIRM_RESOLUTION] Error resolving firmSlug:', error);
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
    const firm = await Firm.findOne({ firmSlug: normalizedSlug });
    
    if (firm && firm.status === 'ACTIVE') {
      req.firmSlug = normalizedSlug;
      req.firmId = firm._id.toString();
      req.firmIdString = firm.firmId;
      req.firmName = firm.name;
      req.context = {
        ...req.context,
        firmId: firm._id.toString(),
        firmSlug: firm.firmSlug,
      };
    }
    
    next();
  } catch (error) {
    // Don't fail on optional resolution
    console.warn('[FIRM_RESOLUTION] Error in optional resolution:', error);
    next();
  }
};

module.exports = {
  resolveFirmSlug,
  optionalFirmResolution,
};
