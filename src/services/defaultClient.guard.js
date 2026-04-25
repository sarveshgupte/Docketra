const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');
const { resolveClientOwnershipFirmId } = require('./tenantIdentity.service');
const log = require('../utils/log');

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

const findDefaultClient = (firmId, session = null) => {
  const queryFirmId = firmId;
  const query = Client.findOne({
    firmId: queryFirmId,
    isDefaultClient: true,
  });
  if (session) {
    query.session(session);
  }
  return query;
};

const getOrCreateDefaultClient = async (firmId, options = {}) => {
  if (!firmId) {
    throw new Error('firmId is required to get or create the default client');
  }

  const {
    firmName = null,
    requestId = null,
    userId = null,
    session = null,
  } = options;
  const ownershipFirmId = await resolveClientOwnershipFirmId(firmId, { session });
  try {
    const existingDefaultClient = await findDefaultClient(ownershipFirmId, session);
    if (existingDefaultClient) {
      return existingDefaultClient;
    }
    const clientId = await generateNextClientId(ownershipFirmId, session);
    const defaultClient = await Client.findOneAndUpdate(
      { firmId: ownershipFirmId, isDefaultClient: true },
      {
        $setOnInsert: {
          clientId,
          firmId: ownershipFirmId,
          isDefaultClient: true,
          isSystemClient: true,
          isInternal: true,
          createdBySystem: true,
          businessName: firmName || 'Default Client',
          primaryContactNumber: '0000000000',
          businessEmail: buildSystemEmail(ownershipFirmId),
          status: 'ACTIVE',
          isActive: true,
          createdByXid: 'SYSTEM',
          createdBy: 'system',
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        session,
      }
    );

    return defaultClient;
  } catch (error) {
    if (error?.code === 11000) {
      const repairedClient = await findDefaultClient(ownershipFirmId, session);
      if (repairedClient) {
        return repairedClient;
      }
    }

    log.error('[DEFAULT_CLIENT] getOrCreateDefaultClient failed', {
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
