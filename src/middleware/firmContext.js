const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { isSuperAdminRole } = require('../utils/role.utils');
const { isActiveStatus } = require('../utils/status.utils');
const { resolveCanonicalTenantFromFirmId } = require('../services/tenantIdentity.service');
const log = require('../utils/log');

/**
 * Resolve the tenant context from the request.
 *
 * Strategy (client-first, legacy-firm fallback):
 * 1. Look for a default client whose _id matches the JWT firmId / session firmId.
 * 2. If not found, fall back to looking up a legacy Firm document (backward compat).
 * 3. If neither is found, reject the request.
 *
 * The "firmId" field in JWTs issued by the new architecture holds the MongoDB _id
 * of the organization's default Client document (isDefaultClient: true).
 */
const firmContext = async (req, res, next) => {
  const requestId = req.requestId || randomUUID();
  req.requestId = requestId;
  if (req._firmContextResolved && req.tenant?.id && req.firmId) {
    return next();
  }

  try {
    if (req.skipFirmContext) {
      return next();
    }
    
    // Detect SuperAdmin using multiple signals (defensive)
    const isSuperAdmin = 
      (req.user && isSuperAdminRole(req.user.role)) ||
      req.jwt?.isSuperAdmin === true ||
      req.isSuperAdmin === true;
    
    req.isSuperAdmin = isSuperAdmin;

    // SuperAdmin is never allowed on firm-scoped routes
    if (isSuperAdmin) {
      log.warn(`[FIRM_CONTEXT][${requestId}] SuperAdmin boundary violation on ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: 'Superadmin cannot access firm-scoped routes',
      });
    }

    const jwtFirmId = req.jwt?.firmId;
    const sessionFirmId = req.user?.firmId;

    // Prefer the JWT claim; fall back to session value
    const candidateId = (jwtFirmId && mongoose.Types.ObjectId.isValid(jwtFirmId))
      ? jwtFirmId
      : (sessionFirmId && mongoose.Types.ObjectId.isValid(sessionFirmId) ? sessionFirmId : null);

    if (!candidateId) {
      log.error(`[FIRM_CONTEXT][${requestId}] No tenant ID found in token or session`, {
        path: req.originalUrl,
      });
      const error = new Error('Tenant context missing');
      error.statusCode = 400;
      throw error;
    }

    let tenantId = null;
    let tenantStatus = 'active';
    let tenantSlug = null;
    const tenantContext = await resolveCanonicalTenantFromFirmId(candidateId);

    if (tenantContext) {
      tenantId = tenantContext.tenantId;
      tenantStatus = tenantContext.status || 'active';
      tenantSlug = tenantContext.firmSlug || null;
    }

    if (!tenantId) {
      log.error(`[FIRM_CONTEXT][${requestId}] Tenant context missing or unresolved`, {
        path: req.originalUrl,
        candidateId,
      });
      const error = new Error('Tenant context missing');
      error.statusCode = 400;
      throw error;
    }

    if (!isActiveStatus(tenantStatus)) {
      log.warn(`[FIRM_CONTEXT][${requestId}] Tenant disabled`, { tenantId, status: tenantStatus });
      return res.status(403).json({
        success: false,
        message: 'Your account is disabled. Please contact support.',
      });
    }

    // Validate ownership against JWT claim
    if (jwtFirmId && tenantId !== jwtFirmId.toString()) {
      log.error(`[FIRM_CONTEXT][${requestId}] Tenant mismatch detected`, {
        tokenFirmId: jwtFirmId,
        resolvedTenantId: tenantId,
      });
      return res.status(403).json({
        success: false,
        message: 'Account mismatch detected for authenticated user',
      });
    }

    req.firm = {
      id: tenantId,
      slug: tenantSlug,
      status: tenantStatus,
    };
    req.tenant = {
      id: tenantId,
      slug: tenantSlug,
    };
    req.firmId = tenantId;
    req.firmSlug = tenantSlug;
    req.context = {
      ...req.context,
      firmId: tenantId,
      firmSlug: tenantSlug,
      tenantId,
      tenantSlug,
    };

    req._firmContextResolved = true;
    if (!req._firmContextLogged) {
      log.info(`[FIRM_CONTEXT][${requestId}] Tenant context resolved`, {
        firmId: req.firmId,
      });
      req._firmContextLogged = true;
    }

    return next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    log.error(`[FIRM_CONTEXT][${requestId}] Error attaching tenant context:`, error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Tenant context missing' : 'Failed to resolve tenant context',
      error: error.message,
    });
  }
};

module.exports = {
  firmContext,
};
