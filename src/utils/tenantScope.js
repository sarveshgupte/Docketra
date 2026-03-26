const isNonProd = process.env.NODE_ENV !== 'production';

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
    console.warn('[TENANT_SCOPE_WARNING] Query missing firmId before scope enforcement', {
      route: req?.originalUrl || req?.url || null,
      method: req?.method || null,
      source: options.source || null,
    });
  }

  return {
    ...(query || {}),
    firmId: userFirmId,
  };
};

module.exports = {
  enforceTenantScope,
};
