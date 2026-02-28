module.exports = function requireTenant(req, res, next) {
  if (!req.tenant || !req.tenant.id) {
    return res.status(400).json({
      error: 'Tenant context missing. Request rejected.',
    });
  }
  return next();
};
