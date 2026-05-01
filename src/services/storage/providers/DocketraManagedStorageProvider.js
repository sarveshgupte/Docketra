const { S3Provider } = require('./S3Provider');
const { StorageAccessError } = require('../errors');

function managedConfigError(firmId) {
  const error = new StorageAccessError('Managed storage backend is not configured', String(firmId || 'unknown'));
  error.code = 'MANAGED_STORAGE_NOT_CONFIGURED';
  error.statusCode = 503;
  return error;
}

class DocketraManagedStorageProvider extends S3Provider {
  constructor({ firmId }) {
    const normalizedFirmId = String(firmId || '').trim();
    if (!normalizedFirmId) {
      throw managedConfigError('unknown');
    }

    const bucket = String(process.env.MANAGED_STORAGE_S3_BUCKET || '').trim();
    const region = String(process.env.MANAGED_STORAGE_S3_REGION || '').trim();
    if (!bucket || !region) {
      throw managedConfigError(normalizedFirmId);
    }

    const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
          ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
        }
      : undefined;

    const prefixBase = (process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').trim().replace(/^\/+|\/+$/g, '') || 'docketra-managed';
    const tenantPrefix = `${prefixBase}/firms/${normalizedFirmId}`;

    super({ tenantId: normalizedFirmId, bucket, region, prefix: tenantPrefix, credentials });
    this.providerName = 'docketra_managed';
  }
}

module.exports = DocketraManagedStorageProvider;
