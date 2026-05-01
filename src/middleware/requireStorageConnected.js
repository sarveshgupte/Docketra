const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const Firm = require('../models/Firm.model');
const { resolveFirmStorageState } = require('../services/storage/resolveFirmStorageState');
const log = require('../utils/log');

function storageNotConnectedResponse(res, operation = 'storage_operation_without_connection', message = 'Active storage provider is not available') {
  log.warn('[STORAGE] blocked_operation:', operation);
  return res.status(400).json({
    code: 'STORAGE_NOT_CONNECTED',
    message,
  });
}

async function requireActiveStorageProvider(req, res, next) {
  try {
    const firmId = req.firmId || req.user?.firmId || req.firm?.id;
    if (!firmId) return storageNotConnectedResponse(res, 'missing_firm_context');

    const provider = await StorageProviderFactory.getProvider(firmId);
    await provider.testConnection();

    let state = null;
    try {
      const firm = await Firm.findById(firmId).select('storage storageConfig').lean();
      if (!firm) return storageNotConnectedResponse(res, 'missing_firm_record', 'Active storage provider is not available');
      state = resolveFirmStorageState(firm);
    } catch (error) {
      log.warn('[STORAGE] middleware_state_resolution_fallback', { message: error.message });
      state = {
        connectionStatus: provider?.providerName === 'docketra_managed' ? 'ACTIVE_MANAGED' : 'ACTIVE_BYOS',
        isManaged: provider?.providerName === 'docketra_managed',
        isFirmConnected: provider?.providerName !== 'docketra_managed',
      };
    }

    req.storageContext = {
      provider,
      providerName: provider.providerName,
      connectionStatus: state.connectionStatus,
      managed: state.isManaged,
      firmConnected: state.isFirmConnected,
      connected: state.connectionStatus === 'ACTIVE_MANAGED' || state.connectionStatus === 'ACTIVE_BYOS',
    };

    return next();
  } catch (error) {
    log.error('[STORAGE] blocked_operation: require_active_storage_provider_failed', { message: error.message, code: error.code });
    const clientMessage = error?.code === 'MANAGED_STORAGE_NOT_CONFIGURED'
      ? 'Managed storage is not configured'
      : 'Active storage provider is not available';
    return storageNotConnectedResponse(res, 'provider_unavailable', clientMessage);
  }
}

const requireStorageConnected = requireActiveStorageProvider;

module.exports = {
  requireActiveStorageProvider,
  requireStorageConnected,
  storageNotConnectedResponse,
};
