const log = require('../utils/log');

const EVENTS = Object.freeze({
  ENABLED: 'STRICT_STORAGE_ENABLED',
  DISABLED: 'STRICT_STORAGE_DISABLED',
  WRITE_BLOCKED: 'STRICT_STORAGE_WRITE_BLOCKED',
  BYOS_REQUIRED: 'STRICT_STORAGE_BYOS_REQUIRED',
});

function logStrictStorageEvent({ event, firmId, actorXid = null, requestId = null, providerMode = null, targetPathCategory = null }) {
  log.info('[STRICT_STORAGE_AUDIT]', {
    event,
    firmId: firmId ? String(firmId) : null,
    actorXid: actorXid ? String(actorXid) : null,
    requestId: requestId ? String(requestId) : null,
    providerMode: providerMode ? String(providerMode) : null,
    targetPathCategory: targetPathCategory ? String(targetPathCategory) : null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { EVENTS, logStrictStorageEvent };
