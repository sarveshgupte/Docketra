const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { getProviderForTenant } = require('../services/storage/StorageProviderFactory');
const { mapProviderErrorToStatus } = require('../controllers/storage.controller');
const log = require('../utils/log');

async function runStorageHealthCheck() {
  const activeTenants = await TenantStorageConfig.find({ isActive: true, status: 'ACTIVE' }).select('_id tenantId rootFolderId');
  for (const config of activeTenants) {
    try {
      const provider = await getProviderForTenant(config.tenantId);
      await provider.testConnection(config.rootFolderId);
    } catch (error) {
      const message = (error?.message || '').toLowerCase();
      let mappedStatus = mapProviderErrorToStatus(error);
      if (error?.status === 404 || message.includes('root folder') || message.includes('missing driveid')) {
        mappedStatus = 'DEGRADED';
      }
      await TenantStorageConfig.findByIdAndUpdate(config._id, { status: mappedStatus });
      log.error('[StorageHealthCheck] Provider unhealthy', {
        tenantId: config.tenantId,
        status: mappedStatus,
        message: error.message,
      });
    }
  }
}

module.exports = { runStorageHealthCheck };
