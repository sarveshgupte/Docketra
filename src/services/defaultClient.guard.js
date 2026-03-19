const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');

/**
 * Build a non-routable internal email address for system-created default clients.
 * The tenant identifier is reduced to lowercase alphanumeric characters so the
 * generated address is stable and email-safe even when firm IDs contain symbols.
 * The `.local` domain keeps the address clearly internal to the application and
 * avoids implying that outbound delivery should ever be attempted.
 */
const buildSystemEmail = (firmId) => {
  const normalizedFirmId = String(firmId).toLowerCase();
  const safeLocalPart = normalizedFirmId.replace(/[^a-z0-9]/g, '');

  if (safeLocalPart === normalizedFirmId) {
    return `${safeLocalPart}@system.local`;
  }

  const hexEncodedFirmId = Buffer.from(normalizedFirmId).toString('hex');
  return `${safeLocalPart || 'firm'}-${hexEncodedFirmId}@system.local`;
};

const findDefaultClient = (firmId) => Client.findOne({
  firmId,
  isDefaultClient: true,
});

const getOrCreateDefaultClient = async (firmId, options = {}) => {
  if (!firmId) {
    throw new Error('firmId is required to get or create the default client');
  }

  const {
    firmName = null,
    requestId = null,
    userId = null,
  } = options;
  try {
    const clientId = await generateNextClientId(firmId);
    const now = new Date();
    const defaultClient = await Client.findOneAndUpdate(
      { firmId, isDefaultClient: true },
      {
        $setOnInsert: {
          clientId,
          firmId,
          isDefaultClient: true,
          isSystemClient: true,
          isInternal: true,
          createdBySystem: true,
          businessName: firmName || 'Default Client',
          businessAddress: 'Default Address',
          primaryContactNumber: '0000000000',
          businessEmail: buildSystemEmail(firmId),
          status: 'ACTIVE',
          isActive: true,
          createdByXid: 'SYSTEM',
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return defaultClient;
  } catch (error) {
    if (error?.code === 11000) {
      const repairedClient = await findDefaultClient(firmId);
      if (repairedClient) {
        return repairedClient;
      }
    }

    console.error('[DEFAULT_CLIENT] getOrCreateDefaultClient failed', {
      firmId,
      requestId,
      userId,
      error: error.message,
      code: error.code || null,
    });

    throw error;
  }
};

const ensureDefaultClient = async (firmId, firmName = null) => getOrCreateDefaultClient(firmId, { firmName });

module.exports = {
  getOrCreateDefaultClient,
  ensureDefaultClient,
};
