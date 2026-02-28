module.exports = function requireTenant(req, res, next) {
  const tenantId = req.tenant?.id || req.firmId || req.firm?.id;
  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant context missing. Request rejected.',
    });
  }
  return next();
};
