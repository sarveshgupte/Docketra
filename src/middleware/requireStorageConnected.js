const Firm = require('../models/Firm.model');
const { decrypt } = require('../services/storage/services/TokenEncryption.service');
const log = require('../utils/log');

function storageNotConnectedResponse(res, operation = 'storage_operation_without_connection') {
  log.warn('[STORAGE] blocked_operation:', operation);
  return res.status(400).json({
    code: 'STORAGE_NOT_CONNECTED',
    message: 'Cloud storage must be connected',
  });
}

async function requireStorageConnected(req, res, next) {
  try {
    const firmId = req.firmId || req.user?.firmId || req.firm?.id;
    if (!firmId) {
      return storageNotConnectedResponse(res, 'missing_firm_context');
    }

    const firm = await Firm.findById(firmId)
      .select('storageConfig storage')
      .lean();

    if (!firm?.storageConfig?.provider || firm.storageConfig.provider !== 'google_drive') {
      return storageNotConnectedResponse(res, 'invalid_provider');
    }

    if (!firm?.storageConfig?.credentials) {
      return storageNotConnectedResponse(res, 'missing_storage_credentials');
    }

    let credentials = {};
    try {
      credentials = JSON.parse(decrypt(firm.storageConfig.credentials));
    } catch {
      return storageNotConnectedResponse(res, 'invalid_storage_credentials');
    }

    const refreshToken = credentials.refreshToken || credentials.googleRefreshToken;
    const rootFolderId = credentials.rootFolderId || firm?.storage?.google?.rootFolderId;
    if (!refreshToken || !rootFolderId) {
      return storageNotConnectedResponse(res, 'missing_storage_tokens_or_root');
    }

    req.storageContext = {
      provider: firm.storageConfig.provider,
      rootFolderId,
      connected: true,
    };
    return next();
  } catch (error) {
    log.error('[STORAGE] blocked_operation: require_storage_connected_failed', { message: error.message });
    return res.status(400).json({
      code: 'STORAGE_NOT_CONNECTED',
      message: 'Cloud storage must be connected',
    });
  }
}

module.exports = {
  requireStorageConnected,
  storageNotConnectedResponse,
};
