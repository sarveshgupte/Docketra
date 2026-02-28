const TenantStorageHealth = require('../models/TenantStorageHealth.model');
const Case = require('../models/Case.model');

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePublicEmailTokenFromRecipient(toAddress) {
  const recipient = String(toAddress || '').trim().toLowerCase();
  const localPart = recipient.split('@')[0] || '';
  const match = localPart.match(/^case-([a-z0-9-]+)$/i);
  if (!match) return null;
  const token = match[1].toLowerCase();
  return UUID_V4_REGEX.test(token) ? token : null;
}

async function storageHealthGuard(req, res, next) {
  const tenantId = req.firmId || req.storageTenantId;
  if (!tenantId) return next();

  try {
    const health = await TenantStorageHealth.findOne({ tenantId }).select('status').lean();
    if (!health || health.status === 'HEALTHY') return next();

    if (health.status === 'DISCONNECTED') {
      return res.status(503).json({
        success: false,
        code: 'STORAGE_DISCONNECTED',
        message: 'Tenant storage is disconnected. Please reconnect storage and retry.',
      });
    }

    if (health.status === 'DEGRADED') {
      console.warn('[StorageHealthGuard] Tenant storage degraded', { tenantId, route: req.originalUrl || req.url });
    }

    return next();
  } catch (error) {
    console.error('[StorageHealthGuard] Failed to query storage health', { tenantId, message: error.message });
    return next();
  }
}

module.exports = {
  storageHealthGuard,
  inboundStorageHealthGuard: async (req, res, next) => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
      const parsedBody = JSON.parse(rawBody.toString('utf8'));
      const token = parsePublicEmailTokenFromRecipient(parsedBody?.to);
      if (!token) return next();

      const caseRecord = await Case.findOne({ publicEmailToken: token }).select('firmId').lean();
      if (!caseRecord?.firmId) return next();

      req.storageTenantId = caseRecord.firmId;
      return storageHealthGuard(req, res, next);
    } catch (error) {
      console.warn('[StorageHealthGuard] Inbound health pre-check skipped due to parsing or lookup error', { message: error.message });
      return next();
    }
  },
};
