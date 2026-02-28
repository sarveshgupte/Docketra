'use strict';

const { Worker } = require('bullmq');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { verifyTenantStorage } = require('../utils/verifyTenantStorage');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const storageIntegrityWorker = new Worker(
  'storage-integrity-jobs',
  async () => {
    const activeConfigs = await TenantStorageConfig.find({ isActive: true }).select('tenantId');
    for (const config of activeConfigs) {
      try {
        await verifyTenantStorage(config.tenantId);
      } catch (error) {
        console.error('[StorageIntegrityWorker] Tenant verification failed', {
          tenantId: config.tenantId,
          message: error.message,
        });
      }
    }
  },
  { connection: { url: redisUrl } }
);

storageIntegrityWorker.on('error', (error) => {
  console.error('[StorageIntegrityWorker] Worker error', { message: error.message });
});

module.exports = storageIntegrityWorker;
