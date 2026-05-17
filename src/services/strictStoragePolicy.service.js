const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { resolveFirmStorageState } = require('./storage/resolveFirmStorageState');

function buildStrictStorageUnavailableError(requestId = null) {
  const error = new Error('Firm-owned storage is required for this workspace.');
  error.status = 503;
  error.code = 'STRICT_STORAGE_UNAVAILABLE';
  error.payload = {
    error: 'strict_storage_unavailable',
    message: 'Firm-owned storage is required for this workspace.',
    ...(requestId ? { requestId } : {}),
  };
  return error;
}

async function requireWritableBusinessStorage({ firmId, requestId = null }) {
  if (mongoose.connection.readyState === 0) return { strictFirmOwnedStorage: false, byosWritable: true };
  let firm = null;
  try {
    firm = await Firm.findById(firmId).select('settings.firm storage storageConfig firmId').lean();
  } catch (_error) {
    firm = null;
  }
  if (!firm) {
    firm = await Firm.findOne({ firmId: String(firmId || '') }).select('settings.firm storage storageConfig firmId').lean();
  }
  const strictFirmOwnedStorage = Boolean(firm?.settings?.firm?.strictFirmOwnedStorage);
  if (!strictFirmOwnedStorage) return { strictFirmOwnedStorage: false, byosWritable: true };

  const state = resolveFirmStorageState(firm);
  const byosWritable = state.canonicalProvider === 'google_drive' && state.connectionStatus === 'ACTIVE_BYOS' && !state.isManaged;
  if (!byosWritable) throw buildStrictStorageUnavailableError(requestId);
  return { strictFirmOwnedStorage: true, byosWritable: true };
}

module.exports = { requireWritableBusinessStorage, buildStrictStorageUnavailableError };
