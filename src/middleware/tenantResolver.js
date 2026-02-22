/**
 * Tenant Resolver Middleware
 *
 * Resolves the firm tenant from the URL path parameter `:firmSlug`.
 * Applies to all `/f/:firmSlug/*` routes.
 *
 * Responsibilities:
 * - Extract and normalize firmSlug from req.params.firmSlug
 * - Query DB for an ACTIVE firm with that slug
 * - Attach req.firm, req.firmId, req.firmSlug for downstream handlers
 * - Return 404 when firm is not found
 * - Return 403 when firm is found but INACTIVE/SUSPENDED
 *
 * Usage:
 *   router.use('/f/:firmSlug', tenantResolver, ...handlers);
 */

const Firm = require('../models/Firm.model');
const { normalizeFirmSlug } = require('../utils/slugify');

const FIRM_NOT_FOUND_RESPONSE = {
  success: false,
  code: 'FIRM_NOT_FOUND',
  message: 'Firm not found. Please check your login URL.',
  action: 'contact_admin',
};

module.exports = async function tenantResolver(req, res, next) {
  const rawSlug = req.params.firmSlug;

  if (!rawSlug) {
    // No slug in route — skip (caller misconfigured route, do not fail silently)
    return next();
  }

  const normalizedSlug = normalizeFirmSlug(rawSlug);

  if (!normalizedSlug) {
    console.warn('[TENANT_RESOLVER] Invalid firmSlug — empty after normalization', { rawSlug });
    return res.status(404).json(FIRM_NOT_FOUND_RESPONSE);
  }

  try {
    // Look up by slug only; status is checked explicitly below
    const firm = await Firm.findOne({ firmSlug: normalizedSlug });

    console.log({
      event: 'firm_login_attempt',
      slug: normalizedSlug,
      found: !!firm,
      status: firm?.status,
    });

    if (!firm) {
      return res.status(404).json(FIRM_NOT_FOUND_RESPONSE);
    }

    if (firm.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        code: 'FIRM_INACTIVE',
        message: 'This firm is inactive. Please contact support.',
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

    // Attach canonical tenant context for downstream controllers
    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.firmId = firm._id.toString();
    req.firmSlug = firm.firmSlug;
    req.firmIdString = firm.firmId; // String format e.g. FIRM001
    req.firmName = firm.name;
    req.context = {
      ...req.context,
      firmId: firm._id.toString(),
      firmSlug: firm.firmSlug,
    };

    return next();
  } catch (error) {
    console.error('[TENANT_RESOLVER] Error resolving firmSlug:', error);
    return res.status(500).json({
      success: false,
      code: 'FIRM_RESOLUTION_FAILED',
      message: 'Failed to resolve firm context',
      action: 'retry',
    });
  }
};
