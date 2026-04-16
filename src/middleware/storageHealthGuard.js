const TenantStorageHealth = require('../models/TenantStorageHealth.model');
const log = require('../utils/log');
async function storageHealthGuard(req, res, next) {
  const tenantId = req.firmId || req.storageTenantId;
  if (!tenantId) return next();

  try {
    const health = await TenantStorageHealth.findOne({ tenantId }).select('status').lean();
    if (!health || health.status === 'HEALTHY') return next();

    if (health.status === 'DISCONNECTED') {
      return res.status(503).json({
        success: false,
        code: 'STORAGE_DISCONNECTED',
        message: 'Tenant storage is disconnected. Please reconnect storage and retry.',
      });
    }

    if (health.status === 'DEGRADED') {
      log.warn('[StorageHealthGuard] Tenant storage degraded', { tenantId, route: req.originalUrl || req.url });
    }

    return next();
  } catch (error) {
    log.error('[StorageHealthGuard] Failed to query storage health', { tenantId, message: error.message });
    return next();
  }
}

module.exports = {
  storageHealthGuard
};
