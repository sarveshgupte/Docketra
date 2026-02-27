const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');
const { mapProviderErrorToStatus } = require('../controllers/storage.controller');

async function runStorageHealthCheck() {
  const activeTenants = await TenantStorageConfig.find({ isActive: true, status: 'ACTIVE' }).select('tenantId');
  for (const item of activeTenants) {
    try {
      const provider = await getProviderForTenant(item.tenantId);
      await provider.testConnection();
    } catch (error) {
      const mappedStatus = mapProviderErrorToStatus(error);
      await TenantStorageConfig.updateMany(
        { tenantId: item.tenantId, isActive: true },
        { status: mappedStatus }
      );
      console.error('[StorageHealthCheck] Provider unhealthy', {
        tenantId: item.tenantId,
        status: mappedStatus,
        message: error.message,
      });
    }
  }
}

module.exports = { runStorageHealthCheck };
