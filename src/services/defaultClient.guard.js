const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');

const buildSystemEmail = (firmId) => (
  `${String(firmId).toLowerCase().replace(/[^a-z0-9]/g, '')}@system.local`
);

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
      firmId: String(firmId),
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
