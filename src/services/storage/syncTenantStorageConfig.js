const mongoose = require('mongoose');
const TenantStorageConfig = require('../../models/TenantStorageConfig.model');
const Firm = require('../../models/Firm.model');
const { resolveFirmStorageState } = require('./resolveFirmStorageState');
const { encrypt } = require('./services/TokenEncryption.service');
const log = require('../../utils/log');

async function syncTenantStorageConfig(firmId) {
  if (!mongoose.connection || mongoose.connection.readyState === 0) {
    return;
  }

  try {
    let firm = null;
    try {
      if (mongoose.Types.ObjectId.isValid(firmId)) {
        firm = await Firm.findById(firmId).select('storage storageConfig').lean();
      }
    } catch (_err) {
      firm = null;
    }

    if (!firm) {
      try {
        firm = await Firm.findOne({ firmId: String(firmId || '') }).select('storage storageConfig').lean();
      } catch (_err) {
        firm = null;
      }
    }

    if (!firm) {
      log.warn('[syncTenantStorageConfig] Firm not found', { firmId });
      return;
    }

    const state = resolveFirmStorageState(firm, { includeCredentials: true });

    if (state.isManaged || !state.canonicalProvider) {
      // If it is managed storage or not configured, deactivate any active tenant storage config
      await TenantStorageConfig.updateMany(
        { tenantId: String(firmId), isActive: true },
        { $set: { isActive: false, status: 'DISCONNECTED' } }
      );
      return;
    }

    const provider = state.canonicalProvider;
    const refreshToken = state.credentials?.refreshToken || state.credentials?.googleRefreshToken || null;
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;
    const driveId = state.credentials?.driveId || null;
    const rootFolderId = state.rootFolderId || null;

    let status = 'ACTIVE';
    if (state.connectionStatus === 'ERROR') {
      status = 'ERROR';
    } else if (state.connectionStatus === 'DISCONNECTED') {
      status = 'DISCONNECTED';
    }

    // Deactivate all other configs for this tenant
    await TenantStorageConfig.updateMany(
      { tenantId: String(firmId), provider: { $ne: provider }, isActive: true },
      { $set: { isActive: false } }
    );

    // Upsert the active config
    await TenantStorageConfig.findOneAndUpdate(
      { tenantId: String(firmId), provider },
      {
        $set: {
          tenantId: String(firmId),
          provider,
          ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
          driveId,
          rootFolderId,
          status,
          isActive: true,
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    log.info('[syncTenantStorageConfig] Successfully synchronized TenantStorageConfig', { firmId, provider, status });
  } catch (error) {
    log.error('[syncTenantStorageConfig] Failed to synchronize TenantStorageConfig', {
      firmId,
      message: error.message,
    });
  }
}

module.exports = { syncTenantStorageConfig };
