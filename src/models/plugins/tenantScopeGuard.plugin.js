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
    if (filter.$and.some(hasFirmScope)) return true;
  }

  if (Array.isArray(filter.$or)) {
    if (filter.$or.some(hasFirmScope)) return true;
  }

  if (Array.isArray(filter.$nor)) {
    if (filter.$nor.some(hasFirmScope)) return true;
  }

  return false;
}

function tenantScopeGuardPlugin(schema) {
  if (!schema.path('firmId')) return;

  function guardQuery() {
    const options = this.getOptions ? this.getOptions() : {};
    const role = options?.role || options?.tenantRole;
    const isAuthenticatedRequest = role !== undefined && role !== null;
    const skipGuard = options?.skipTenantGuard === true;
    const filter = this.getFilter ? this.getFilter() : {};

    if (!isAuthenticatedRequest) {
      return;
    }

    if (skipGuard || isSuperadminRole(role) || hasFirmScope(filter)) {
      return;
    }

    throw new TenantScopeViolationError();
  }

  schema.pre('find', guardQuery);
  schema.pre('findOne', guardQuery);
  schema.pre('count', guardQuery);
  schema.pre('countDocuments', guardQuery);
  schema.pre('updateOne', guardQuery);
  schema.pre('updateMany', guardQuery);
  schema.pre('replaceOne', guardQuery);
  schema.pre('deleteOne', guardQuery);
  schema.pre('deleteMany', guardQuery);
  schema.pre('findOneAndDelete', guardQuery);
  schema.pre('findOneAndUpdate', guardQuery);

  schema.pre('aggregate', function () {
    const options = this.options || {};
    const role = options?.role || options?.tenantRole;
    const isAuthenticatedRequest = role !== undefined && role !== null;
    const skipGuard = options?.skipTenantGuard === true;
    const pipeline = this.pipeline();
    const hasMatchFirmId = pipeline.some((stage) => stage?.$match && hasFirmScope(stage.$match));

    if (!isAuthenticatedRequest) {
      return;
    }

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
