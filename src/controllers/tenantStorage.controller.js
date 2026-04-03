const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const Firm = require('../models/Firm.model');
const { encrypt } = require('../services/storage/services/TokenEncryption.service');
const { UnsupportedProviderError } = require('../services/storage/errors');

function maskCredentialLog(tenantId, provider) {
  return { tenantId, provider };
}

function buildProviderForValidation({ tenantId, provider }) {
  switch (provider) {
    case 'google_drive':
    case 'onedrive':
      return true;
    default:
      throw new UnsupportedProviderError(provider, tenantId);
  }
}

async function updateTenantStorage(req, res) {
  const tenantId = req.firmId;

  try {
    const {
      provider,
      driveId,
      rootFolderId,
      refreshToken,
      compressionEnabled,
      compressionLevel,
    } = req.body;
    buildProviderForValidation({ tenantId, provider });
    const encryptedRefreshToken = encrypt(refreshToken);

    await TenantStorageConfig.updateMany({ tenantId, isActive: true }, { isActive: false });

    const config = await TenantStorageConfig.findOneAndUpdate(
      { tenantId, provider },
      {
        tenantId,
        provider,
        encryptedRefreshToken,
        driveId,
        rootFolderId,
        connectedByUserId: req.user?._id?.toString() || req.user?.xID || 'system',
        status: 'ACTIVE',
        isActive: true,
        compressionEnabled: compressionEnabled ?? true,
        compressionLevel: compressionLevel ?? 6,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    await Firm.findByIdAndUpdate(tenantId, {
      $set: {
        storageConfig: {
          provider,
          credentials: encrypt(JSON.stringify({
            refreshToken,
            driveId: driveId || null,
            rootFolderId: rootFolderId || null,
          })),
        },
        'storage.mode': 'firm_connected',
        'storage.provider': provider,
      },
    });

    console.info('[TenantStorage] Updated storage config', maskCredentialLog(tenantId, provider));

    return res.json({
      success: true,
      data: {
        id: config._id,
        tenantId,
        provider,
        driveId,
        rootFolderId,
        isActive: true,
        compressionEnabled: config.compressionEnabled,
        compressionLevel: config.compressionLevel,
      },
    });
  } catch (error) {
    console.error('[TenantStorage] Failed to update storage config', {
      tenantId,
      message: error.message,
    });

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code || 'STORAGE_UPDATE_FAILED',
    });
  }
}

module.exports = {
  updateTenantStorage,
};
