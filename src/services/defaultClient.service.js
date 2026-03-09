const mongoose = require('mongoose');
const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');

/**
 * Ensure an organization has a default client.
 *
 * In the new client-centric architecture the "organization" is represented by
 * a Client document with isDefaultClient=true.  The default client's firmId
 * equals its own _id (self-referencing) so that it is included in all
 * organization-scoped queries (Client.find({ firmId: orgId })).
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
  const firmId = isFirmDoc ? firmOrId._id : firmOrId;
  const firmName = isFirmDoc ? firmOrId.name : null;

  // If this is a Firm document and already has a defaultClientId, nothing to do
  if (isFirmDoc && firmOrId.defaultClientId) {
    return null;
  }

  // Check if a default client already exists for this organization
  const existing = await Client.findOne({ firmId, isDefaultClient: true })
    .session(session || undefined);
  if (existing) {
    // Link back to Firm if needed
    if (isFirmDoc && !firmOrId.defaultClientId) {
      firmOrId.defaultClientId = existing._id;
      await firmOrId.save(session ? { session } : undefined);
    }
    return null;
  }

  const clientId = await generateNextClientId(firmId, session);
  const businessEmail = `${String(firmId).toLowerCase().replace(/[^a-z0-9]/g, '')}@system.local`;

  const [internalClient] = await Client.create([{
    clientId,
    businessName: firmName || 'Default Organization',
    businessAddress: 'Default Address',
    primaryContactNumber: '0000000000',
    businessEmail,
    firmId,
    isDefaultClient: true,
    isSystemClient: true,
    isInternal: true,
    createdBySystem: true,
    status: 'ACTIVE',
    isActive: true,
    createdByXid: 'SYSTEM',
    createdBy: process.env.SUPERADMIN_EMAIL || 'superadmin@system.local',
  }], session ? { session } : undefined);

  // Link back to Firm document if provided
  if (isFirmDoc) {
    firmOrId.defaultClientId = internalClient._id;
    await firmOrId.save(session ? { session } : undefined);
  }

  console.log(`[DEFAULT_CLIENT] Default client created for organization ${firmId}`);
  return internalClient;
};

module.exports = {
  ensureDefaultClientForFirm,
};
