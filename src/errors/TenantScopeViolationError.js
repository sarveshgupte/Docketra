class TenantScopeViolationError extends Error {
  constructor(message = 'Tenant scope violation: firmId is required for this operation') {
    super(message);
    this.name = 'TenantScopeViolationError';
    this.statusCode = 400;
  }
}

module.exports = TenantScopeViolationError;
