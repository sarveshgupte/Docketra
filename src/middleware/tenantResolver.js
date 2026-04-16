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
const { getFirmInactiveCode, isActiveStatus } = require('../utils/status.utils');
const log = require('../utils/log');

const TENANT_CACHE_TTL_MS = 60 * 1000;
const tenantCache = new Map();

const FIRM_NOT_FOUND_RESPONSE = {
  success: false,
  code: 'FIRM_NOT_FOUND',
  message: 'Firm not found. Please check your login URL.',
  action: 'contact_admin',
};

const getCachedTenant = (slug) => {
  const cached = tenantCache.get(slug);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    tenantCache.delete(slug);
    return null;
  }
  return cached.firm;
};

const setCachedTenant = (slug, firm) => {
  tenantCache.set(slug, {
    firm,
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
  });
};

const fetchFirmForTenantResolution = async (slug) => {
  const query = Firm.findOne({ firmSlug: slug }).select('_id firmId firmSlug name status');
  if (typeof query.lean === 'function') {
    return query.lean();
  }
  return query;
};

module.exports = async function tenantResolver(req, res, next) {
  const rawSlug = req.params.firmSlug;

  if (!rawSlug) {
    // No slug in route — skip (caller misconfigured route, do not fail silently)
    return next();
  }

  const normalizedSlug = normalizeFirmSlug(rawSlug);

  if (!normalizedSlug) {
    log.warn('[TENANT_RESOLVER] Invalid firmSlug — empty after normalization', { rawSlug });
    return res.status(404).json(FIRM_NOT_FOUND_RESPONSE);
  }

  try {
    const cachedFirm = getCachedTenant(normalizedSlug);
    const firm = cachedFirm || await fetchFirmForTenantResolution(normalizedSlug);

    if (!firm) {
      return res.status(404).json(FIRM_NOT_FOUND_RESPONSE);
    }

    if (!cachedFirm) {
      setCachedTenant(normalizedSlug, firm);
    }

    const isPublicLoginLookup = req.method === 'GET' && /\/login\/?$/.test(String(req.path || req.originalUrl || ''));

    // Allow public login page metadata lookup for non-active firms so the UI can
    // render a clear workspace-status message instead of a generic lookup failure.
    if (!isActiveStatus(firm.status) && !isPublicLoginLookup) {
      return res.status(403).json({
        success: false,
        code: getFirmInactiveCode(firm.status),
        message: `This firm is currently ${String(firm.status || 'inactive').toLowerCase()}. Please contact support.`,
        action: 'contact_admin',
      });
    }

    // Attach canonical tenant context for downstream controllers
    const tenantId = String(firm._id);
    req.firm = {
      id: tenantId,
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.tenant = {
      id: tenantId,
      slug: firm.firmSlug,
    };
    req.firmId = tenantId;
    req.firmSlug = firm.firmSlug;
    req.firmIdString = firm.firmId; // String format e.g. FIRM001
    req.firmName = firm.name;
    req.context = {
      ...req.context,
      firmId: tenantId,
      firmSlug: firm.firmSlug,
      tenantId,
      tenantSlug: firm.firmSlug,
    };

    return next();
  } catch (error) {
    log.error('[TENANT_RESOLVER] Error resolving firmSlug:', error);
    return res.status(500).json({
      success: false,
      code: 'FIRM_RESOLUTION_FAILED',
      message: 'Failed to resolve firm context',
      action: 'retry',
    });
  }
};
