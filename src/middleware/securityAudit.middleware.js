const { safeLogForensicAudit, PLATFORM_TENANT, getRequestIp, getRequestUserAgent } = require('../services/forensicAudit.service');

const logSecurityEvent = async (req, {
  action,
  metadata = {},
  entityType = 'SECURITY',
  entityId = 'api',
}) => {
  const tenantId = req?.tenant?.id || req?.context?.tenantId || req?.firmId || PLATFORM_TENANT;
  const userId = req?.user?.xID || req?.user?._id || 'anonymous';

  await safeLogForensicAudit({
    tenantId,
    entityType,
    entityId,
    action,
    performedBy: String(userId),
    performedByRole: req?.user?.role || 'anonymous',
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
    metadata: {
      route: req?.originalUrl || req?.url,
      method: req?.method,
      timestamp: new Date().toISOString(),
      userId,
      ...metadata,
    },
  });
};

module.exports = {
  logSecurityEvent,
};
