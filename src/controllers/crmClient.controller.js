const mongoose = require('mongoose');
const CrmClient = require('../models/CrmClient.model');
const Client = require('../models/Client.model');
const Deal = require('../models/Deal.model');
const Case = require('../models/Case.model');
const Invoice = require('../models/Invoice.model');
const { generateNextClientId } = require('../services/clientIdGenerator');
const {
  mapCrmClientToClient,
  resolveClientAndLegacyCrm,
} = require('../services/crmClientMapping.service');

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawSkip = Number.parseInt(query.skip, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
  return { limit, skip };
};

const createCrmClient = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const type = String(req.body?.type || 'individual').trim();
    if (!['individual', 'company'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    const [client] = await Client.create([{
      clientId: await generateNextClientId(req.user.firmId),
      firmId: req.user.firmId,
      businessName: name,
      businessEmail: req.body?.email || `crm-${Date.now()}@docketra.local`,
      primaryContactNumber: req.body?.phone || `crm-${Date.now()}`,
      createdByXid: String(req.user?.xid || req.user?.xID || 'SYSTEM').toUpperCase(),
      createdBy: req.user?.email || 'system@docketra.local',
      leadSource: req.body?.leadSource || null,
      status: req.body?.status || 'lead',
      stage: req.body?.stage || 'new',
      assignedTo: req.body?.assignedTo || null,
      tags,
      notes: req.body?.notes || null,
    }]);

    const legacyClient = await CrmClient.create({
      firmId: req.user.firmId,
      name,
      type,
      email: req.body?.email || null,
      phone: req.body?.phone || null,
      tags,
      canonicalClientId: client._id,
    });
    client.legacyCrmClientId = legacyClient._id;
    await client.save();

    return res.status(201).json({
      success: true,
      data: {
        ...client.toObject(),
        crmType: type,
        legacyCrmClientId: legacyClient._id,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create client' });
  }
};

const listCrmClients = async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const [clients, crmClients] = await Promise.all([
      Client.find({
        firmId: req.user.firmId,
        isDefaultClient: { $ne: true },
        isInternal: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CrmClient.find({ firmId: req.user.firmId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const byLegacyId = new Set(
      clients
        .filter((c) => c.legacyCrmClientId)
        .map((c) => String(c.legacyCrmClientId))
    );

    const mappedLegacyClients = crmClients
      .filter((crm) => !byLegacyId.has(String(crm._id)))
      .map((crm) => mapCrmClientToClient(crm));

    return res.json({ success: true, data: [...clients, ...mappedLegacyClients] });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list clients' });
  }
};

// Includes both canonical (UPPER) and legacy (mixed-case) status values from CaseStatus enum.
const COMPLETED_DOCKET_STATUSES = new Set([
  'CLOSED', 'FILED', 'Filed', 'RESOLVED', 'APPROVED', 'Archived',
]);

const getCrmClientById = async (req, res) => {
  try {
    const clientId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const { client, crmClient } = await resolveClientAndLegacyCrm({
      firmId: req.user.firmId,
      inputId: clientId,
      createdByXid: req.user?.xid || req.user?.xID || 'SYSTEM',
    });
    if (!client && !crmClient) return res.status(404).json({ success: false, message: 'Client not found' });

    const resolvedCrmClientId = crmClient?._id || client?.legacyCrmClientId || null;
    const [deals, dockets, invoices] = await Promise.all([
      Deal.find(
        { firmId: req.user.firmId, ...(resolvedCrmClientId ? { clientId: resolvedCrmClientId } : { _id: null }) },
        { title: 1, stage: 1, value: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
      Case.find(
        { firmId: req.user.firmId, ...(resolvedCrmClientId ? { crmClientId: resolvedCrmClientId } : { _id: null }) },
        { caseNumber: 1, title: 1, status: 1, assignedTo: 1, dueDate: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
      Invoice.find(
        { firmId: req.user.firmId, ...(resolvedCrmClientId ? { clientId: resolvedCrmClientId } : { _id: null }) },
        { amount: 1, status: 1, issuedAt: 1, paidAt: 1, dealId: 1, docketId: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
    ]);
    const canonicalClient = client?.toObject ? client.toObject() : client || mapCrmClientToClient(crmClient);

    const totalRevenue = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const unpaidRevenue = invoices
      .filter((inv) => inv.status === 'unpaid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const completedDeals = deals.filter((d) => d.stage === 'completed').length;
    const completedDockets = dockets.filter((d) => COMPLETED_DOCKET_STATUSES.has(d.status)).length;

    const summary = {
      totalDeals: deals.length,
      activeDeals: deals.length - completedDeals,
      completedDeals,
      totalDockets: dockets.length,
      pendingDockets: dockets.length - completedDockets,
      completedDockets,
      totalRevenue,
      unpaidRevenue,
    };

    return res.json({
      success: true,
      data: {
        ...canonicalClient,
        crmClient: crmClient || null,
        legacyCrmClientId: resolvedCrmClientId,
        deals,
        dockets,
        invoices,
        summary,
      },
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch client' });
  }
};

module.exports = {
  createCrmClient,
  listCrmClients,
  getCrmClientById,
};
