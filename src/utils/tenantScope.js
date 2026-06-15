const log = require('../utils/log');
const isNonProd = process.env.NODE_ENV !== 'production';
const emitTenantScopeWarnings = process.env.TENANT_SCOPE_WARNINGS === 'true';

const enforceTenantScope = (query = {}, req, options = {}) => {
  const userFirmId = req?.user?.firmId;
  if (!userFirmId) {
    const error = new Error('Firm context missing from authenticated user');
    error.statusCode = 403;
    error.code = 'TENANT_CONTEXT_REQUIRED';
    throw error;
  }

  const providedFirmId = query?.firmId;
  if (providedFirmId && String(providedFirmId) !== String(userFirmId)) {
    const error = new Error('Tenant scope tampering detected');
    error.statusCode = 403;
    error.code = 'TENANT_SCOPE_TAMPERING_DETECTED';
    throw error;
  }

  if (isNonProd && !Object.prototype.hasOwnProperty.call(query || {}, 'firmId')) {
    const message = '[TENANT_SCOPE_WARNING] Query missing firmId before scope enforcement';
    const context = {
      route: req?.originalUrl || req?.url || null,
      method: req?.method || null,
      source: options.source || null,
    };

    if (options.warnOnMissingFirmId === true || emitTenantScopeWarnings) {
      log.warn(message, context);
    } else if (typeof log.debug === 'function') {
      log.debug(message, context);
    }
  }

  return {
    ...(query || {}),
    firmId: userFirmId,
  };
};

module.exports = {
  enforceTenantScope,
};
