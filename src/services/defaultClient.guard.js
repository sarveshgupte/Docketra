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

const ensureDefaultClient = async (firmId, firmName = null) => {
  if (!firmId) {
    throw new Error('firmId is required to ensure a default client');
  }

  const existingClient = await findDefaultClient(firmId);
  if (existingClient) {
    return existingClient;
  }

  try {
    const clientId = await generateNextClientId(firmId);
    const defaultClient = await Client.create({
      clientId,
      firmId,
      businessName: firmName || 'Default Organization',
      businessAddress: 'Default Address',
      primaryContactNumber: '0000000000',
      businessEmail: buildSystemEmail(firmId),
      isDefaultClient: true,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      status: 'ACTIVE',
      isActive: true,
      createdByXid: 'SYSTEM',
      createdBy: 'system',
    });

    console.warn('[DEFAULT_CLIENT_GUARD] Auto-created missing default client', {
      firmId,
      clientId: defaultClient.clientId,
      businessName: defaultClient.businessName,
    });

    return defaultClient;
  } catch (error) {
    if (error?.code === 11000) {
      const repairedClient = await findDefaultClient(firmId);
      if (repairedClient) {
        return repairedClient;
      }
    }

    throw error;
  }
};

module.exports = {
  ensureDefaultClient,
};
