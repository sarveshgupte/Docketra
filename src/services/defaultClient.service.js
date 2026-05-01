const { getOrCreateDefaultClient } = require('./defaultClient.guard');
const mongoose = require('mongoose');

/**
 * Ensure an organization has a default client.
 *
 * In the new client-centric architecture the "organization" is represented by
 * a Client document with isDefaultClient=true. Runtime tenant identity is
 * represented by the default client _id, while relational ownership remains
 * anchored to the owning Firm._id in deployments that still use Firm records.
 *
 * Legacy usage: When a `firm` document is supplied the function still works —
 * it creates the default client with firmId=firm._id and updates
 * firm.defaultClientId for backward compatibility.
 *
 * @param {object|string|ObjectId} firmOrId - Firm document OR a raw firmId (ObjectId/string)
 * @param {object} [session] - Optional mongoose session
 * @returns {Promise<object|null>} Created client document if created, otherwise null
 */
const ensureDefaultClientForFirm = async (firmOrId, session = null) => {
  if (!firmOrId) {
    throw new Error('Organization ID or Firm document is required to ensure default client');
  }

  // Determine whether we received a Firm document or a raw ID
  const isFirmDoc = firmOrId && typeof firmOrId === 'object' && firmOrId._id;
  const rawFirmId = isFirmDoc ? firmOrId._id : firmOrId;
  const firmId = (
    rawFirmId instanceof mongoose.Types.ObjectId
      ? rawFirmId.toString()
      : (rawFirmId && rawFirmId._id ? String(rawFirmId._id) : String(rawFirmId || '').trim())
  );
  const firmName = isFirmDoc ? firmOrId.name : null;
  if (!firmId || firmId === '[object Object]') {
    throw new Error('Valid firmId is required to ensure default client');
  }

  // If this is a Firm document and already has a defaultClientId, nothing to do
  if (isFirmDoc && firmOrId.defaultClientId) {
    return null;
  }

  const internalClient = await getOrCreateDefaultClient(firmId, {
    firmName,
    session,
  });

  // Link back to Firm document if provided
  if (isFirmDoc && String(firmOrId.defaultClientId || '') !== String(internalClient._id)) {
    firmOrId.defaultClientId = internalClient._id;
    await firmOrId.save(session ? { session } : undefined);
  }
  return internalClient;
};

module.exports = {
  ensureDefaultClientForFirm,
};
