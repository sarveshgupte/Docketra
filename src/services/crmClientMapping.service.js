const mongoose = require('mongoose');
const Client = require('../models/Client.model');
const CrmClient = require('../models/CrmClient.model');
const { generateNextClientId } = require('./clientIdGenerator');

const normalizeArray = (value) => (Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : []);

function mapCrmClientToClient(crmClient = {}) {
  if (!crmClient) return null;
  return {
    _id: crmClient.canonicalClientId || crmClient._id,
    businessName: crmClient.name || '',
    businessEmail: crmClient.email || null,
    primaryContactNumber: crmClient.phone || null,
    leadSource: null,
    status: 'lead',
    stage: 'new',
    assignedTo: null,
    tags: normalizeArray(crmClient.tags),
    notes: null,
    legacyCrmClientId: crmClient._id,
    crmType: crmClient.type || 'individual',
    createdAt: crmClient.createdAt,
    updatedAt: crmClient.updatedAt,
  };
}

async function ensureCrmClientForCanonicalClient({ client, firmId, session = null }) {
  if (!client) return null;

  if (client.legacyCrmClientId) {
    const existing = await CrmClient.findOne({ _id: client.legacyCrmClientId, firmId }).session(session).lean();
    if (existing) return existing;
  }

  const created = await CrmClient.create([{
    firmId,
    name: client.businessName,
    type: 'individual',
    email: client.businessEmail || null,
    phone: client.primaryContactNumber || null,
    tags: normalizeArray(client.tags),
    canonicalClientId: client._id,
  }], { session });

  await Client.updateOne(
    { _id: client._id, firmId, legacyCrmClientId: null },
    { $set: { legacyCrmClientId: created[0]._id } },
    { session }
  );

  return created[0].toObject ? created[0].toObject() : created[0];
}

async function upsertCanonicalClientFromCrm({ crmClient, firmId, createdByXid = 'SYSTEM', session = null }) {
  if (!crmClient) return null;

  if (crmClient.canonicalClientId) {
    const existing = await Client.findOne({ _id: crmClient.canonicalClientId, firmId }).session(session);
    if (existing) {
      if (!existing.legacyCrmClientId) {
        existing.legacyCrmClientId = crmClient._id;
        await existing.save({ session });
      }
      return existing;
    }
  }

  const fallbackEmail = crmClient.email || `crm-${String(crmClient._id)}@docketra.local`;
  const fallbackPhone = crmClient.phone || `crm-${String(crmClient._id).slice(-8)}`;

  const existingByContact = await Client.findOne({
    firmId,
    $or: [
      { businessEmail: fallbackEmail },
      { primaryContactNumber: fallbackPhone },
    ],
  }).session(session);

  if (existingByContact) {
    if (!existingByContact.legacyCrmClientId) {
      existingByContact.legacyCrmClientId = crmClient._id;
    }
    if (!existingByContact.tags?.length && Array.isArray(crmClient.tags) && crmClient.tags.length > 0) {
      existingByContact.tags = normalizeArray(crmClient.tags);
    }
    await existingByContact.save({ session });

    await CrmClient.updateOne(
      { _id: crmClient._id, firmId },
      { $set: { canonicalClientId: existingByContact._id } },
      { session }
    );

    return existingByContact;
  }

  const clientId = await generateNextClientId(firmId);
  const [created] = await Client.create([{
    clientId,
    firmId,
    businessName: crmClient.name,
    businessEmail: fallbackEmail,
    primaryContactNumber: fallbackPhone,
    createdByXid: String(createdByXid || 'SYSTEM').toUpperCase(),
    createdBy: 'system@docketra.local',
    leadSource: null,
    status: 'lead',
    stage: 'new',
    tags: normalizeArray(crmClient.tags),
    legacyCrmClientId: crmClient._id,
  }], { session });

  await CrmClient.updateOne(
    { _id: crmClient._id, firmId },
    { $set: { canonicalClientId: created._id } },
    { session }
  );

  return created;
}

async function resolveClientAndLegacyCrm({ firmId, inputId, session = null, createdByXid = 'SYSTEM' }) {
  if (!mongoose.Types.ObjectId.isValid(inputId)) return { client: null, crmClient: null };

  const [clientById, crmById] = await Promise.all([
    Client.findOne({ _id: inputId, firmId }).session(session),
    CrmClient.findOne({ _id: inputId, firmId }).session(session),
  ]);

  if (clientById) {
    const crmClient = await ensureCrmClientForCanonicalClient({ client: clientById, firmId, session });
    return { client: clientById, crmClient };
  }

  if (crmById) {
    const client = await upsertCanonicalClientFromCrm({ crmClient: crmById, firmId, createdByXid, session });
    return { client, crmClient: crmById };
  }

  return { client: null, crmClient: null };
}

module.exports = {
  mapCrmClientToClient,
  ensureCrmClientForCanonicalClient,
  upsertCanonicalClientFromCrm,
  resolveClientAndLegacyCrm,
};
