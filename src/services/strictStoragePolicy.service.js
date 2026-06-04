const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { resolveFirmStorageState } = require('./storage/resolveFirmStorageState');
const { EVENTS, logStrictStorageEvent } = require('./strictStorageAudit.service');

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

async function requireWritableBusinessStorage({ firmId, requestId = null, actorXid = null, targetPathCategory = null }) {
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
  const byosWritable = state.isFirmConnected && state.connectionStatus === 'ACTIVE_BYOS';
  if (!byosWritable) {
    logStrictStorageEvent({
      event: EVENTS.WRITE_BLOCKED,
      firmId: firm?.firmId || firmId,
      actorXid,
      requestId,
      providerMode: state.mode || (state.isManaged ? 'managed_fallback' : 'firm_connected'),
      targetPathCategory,
    });
    throw buildStrictStorageUnavailableError(requestId);
  }
  return { strictFirmOwnedStorage: true, byosWritable: true };
}

module.exports = { requireWritableBusinessStorage, buildStrictStorageUnavailableError };
