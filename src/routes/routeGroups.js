const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext, firmContext } = require('../middleware/firmContext.middleware');
const requireTenant = require('../middleware/requireTenant');
const invariantGuard = require('../middleware/invariantGuard');
const { requireAdmin } = require('../middleware/permission.middleware');
const { tenantThrottle } = require('../middleware/tenantThrottle.middleware');
const { userReadLimiter, userWriteLimiter, sensitiveLimiter } = require('../middleware/rateLimiters');

const buildFirmInvariantGuard = () => invariantGuard({ requireFirm: true, forbidSuperAdmin: true });

const firmAuthenticatedAccess = [authenticate, attachFirmContext];
const firmReadAccess = [authenticate, userReadLimiter, attachFirmContext, requireTenant, buildFirmInvariantGuard()];
const firmWriteAccess = [authenticate, userWriteLimiter, attachFirmContext, requireTenant, buildFirmInvariantGuard()];
const firmSensitiveAccess = [authenticate, sensitiveLimiter, attachFirmContext, requireTenant, buildFirmInvariantGuard()];

const adminBaseAccess = [...firmAuthenticatedAccess];

const tenantScopedApiAccess = [authenticate, firmContext, requireTenant, tenantThrottle, buildFirmInvariantGuard()];
const adminTenantScopedApiAccess = [...tenantScopedApiAccess, requireAdmin];

module.exports = {
  firmAuthenticatedAccess,
  firmReadAccess,
  firmWriteAccess,
  firmSensitiveAccess,
  adminBaseAccess,
  tenantScopedApiAccess,
  adminTenantScopedApiAccess,
};
