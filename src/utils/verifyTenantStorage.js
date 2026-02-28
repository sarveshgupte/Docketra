const Attachment = require('../models/Attachment.model');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const TenantStorageHealth = require('../models/TenantStorageHealth.model');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');

const SAMPLE_SIZE = 20;

function isAuthFailure(error) {
  const message = (error?.message || '').toLowerCase();
  return error?.status === 401
    || message.includes('invalid_grant')
    || message.includes('token refresh failed')
    || message.includes('unauthorized');
}

async function getMetadata(provider, tenantId, driveFileId) {
  if (!driveFileId) return null;
  if (provider?.providerName === 'onedrive') {
    return provider.getFileMetadata(driveFileId);
  }
  return provider.getFileMetadata(tenantId, driveFileId);
}

async function verifyTenantStorage(tenantId) {
  const tenantStorageConfig = await TenantStorageConfig.findOne({ tenantId, isActive: true })
    .select('tenantId rootFolderId');

  const baseRecord = {
    tenantId,
    lastVerifiedAt: new Date(),
    missingFilesCount: 0,
    sampleSize: 0,
    lastError: null,
  };

  if (!tenantStorageConfig) {
    const record = await TenantStorageHealth.findOneAndUpdate(
      { tenantId },
      { ...baseRecord, status: 'DISCONNECTED', lastError: 'Active storage configuration not found' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return record;
  }

  let provider;
  try {
    provider = await getProviderForTenant(tenantId);
    await provider.testConnection(tenantStorageConfig.rootFolderId);
  } catch (error) {
    const status = isAuthFailure(error) ? 'DISCONNECTED' : 'DEGRADED';
    const record = await TenantStorageHealth.findOneAndUpdate(
      { tenantId },
      { ...baseRecord, status, lastError: error.message || 'Storage verification failed' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return record;
  }

  const attachments = await Attachment.find({
    firmId: tenantId,
    driveFileId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(SAMPLE_SIZE)
    .select('driveFileId');

  let missingFilesCount = 0;
  let lastError = null;

  for (const attachment of attachments) {
    try {
      await getMetadata(provider, tenantId, attachment.driveFileId);
    } catch (error) {
      if (isAuthFailure(error)) {
        const record = await TenantStorageHealth.findOneAndUpdate(
          { tenantId },
          {
            ...baseRecord,
            sampleSize: attachments.length,
            status: 'DISCONNECTED',
            lastError: error.message || 'Storage provider disconnected',
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return record;
      }
      if (error?.status === 404) {
        missingFilesCount += 1;
      } else {
        lastError = error.message || 'Failed to fetch file metadata';
      }
    }
  }

  const status = missingFilesCount > 0 ? 'DEGRADED' : 'HEALTHY';
  return TenantStorageHealth.findOneAndUpdate(
    { tenantId },
    {
      ...baseRecord,
      sampleSize: attachments.length,
      missingFilesCount,
      status,
      lastError,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  verifyTenantStorage,
  isAuthFailure,
};
