const TenantScopeViolationError = require('../../errors/TenantScopeViolationError');

function isSuperadminRole(role) {
  if (!role || typeof role !== 'string') return false;
  const normalized = role.toLowerCase().replace(/[_\s-]/g, '');
  return normalized === 'superadmin';
}

function hasFirmScope(filter) {
  if (!filter || typeof filter !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'firmId')) return true;
  if (Array.isArray(filter.$and)) {
    return filter.$and.some(hasFirmScope);
  }
  return false;
}

function tenantScopeGuardPlugin(schema) {
  if (!schema.path('firmId')) return;

  function guardQuery() {
    const options = this.getOptions ? this.getOptions() : {};
    const role = options?.role || options?.tenantRole;
    const skipGuard = options?.skipTenantGuard === true;
    const filter = this.getFilter ? this.getFilter() : {};

    if (skipGuard || isSuperadminRole(role) || hasFirmScope(filter)) {
      return;
    }

    throw new TenantScopeViolationError();
  }

  schema.pre('find', guardQuery);
  schema.pre('findOne', guardQuery);
  schema.pre('updateOne', guardQuery);
  schema.pre('deleteOne', guardQuery);
  schema.pre('findOneAndUpdate', guardQuery);

  schema.pre('aggregate', function () {
    const options = this.options || {};
    const role = options?.role || options?.tenantRole;
    const skipGuard = options?.skipTenantGuard === true;
    const pipeline = this.pipeline();
    const hasMatchFirmId = pipeline.some((stage) => stage?.$match && hasFirmScope(stage.$match));

    if (skipGuard || isSuperadminRole(role) || hasMatchFirmId) {
      return;
    }

    throw new TenantScopeViolationError();
  });
}

module.exports = {
  tenantScopeGuardPlugin,
  isSuperadminRole,
  hasFirmScope,
};
