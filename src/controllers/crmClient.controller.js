const mongoose = require('mongoose');
const CrmClient = require('../models/CrmClient.model');
const Deal = require('../models/Deal.model');
const Case = require('../models/Case.model');
const Invoice = require('../models/Invoice.model');

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

    const client = await CrmClient.create({
      firmId: req.user.firmId,
      name,
      type,
      email: req.body?.email || null,
      phone: req.body?.phone || null,
      tags,
    });

    return res.status(201).json({ success: true, data: client });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create client' });
  }
};

const listCrmClients = async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const clients = await CrmClient.find({ firmId: req.user.firmId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.json({ success: true, data: clients });
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = await CrmClient.findOne({ _id: req.params.id, firmId: req.user.firmId }).lean();
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const [deals, dockets, invoices] = await Promise.all([
      Deal.find(
        { firmId: req.user.firmId, clientId: client._id },
        { title: 1, stage: 1, value: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
      Case.find(
        { firmId: req.user.firmId, crmClientId: client._id },
        { caseNumber: 1, title: 1, status: 1, assignedTo: 1, dueDate: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
      Invoice.find(
        { firmId: req.user.firmId, clientId: client._id },
        { amount: 1, status: 1, issuedAt: 1, paidAt: 1, dealId: 1, docketId: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
    ]);

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
        ...client,
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
