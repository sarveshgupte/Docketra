const mongoose = require('mongoose');
const Deal = require('../models/Deal.model');
const CrmClient = require('../models/CrmClient.model');
const Case = require('../models/Case.model');
const Invoice = require('../models/Invoice.model');

const ALLOWED_STAGES = new Set(['new', 'in_progress', 'completed']);
const DEFAULT_STAGE = 'new';

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawSkip = Number.parseInt(query.skip, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
  return { limit, skip };
};

const createDeal = async (req, res) => {
  try {
    const clientId = req.body?.clientId;
    const title = String(req.body?.title || '').trim();

    if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });

    const client = await CrmClient.findOne({ _id: clientId, firmId: req.user.firmId }).lean();
    if (!client) return res.status(400).json({ success: false, message: 'Invalid clientId' });

    const requestedStage = String(req.body?.stage || '').trim();
    const stage = ALLOWED_STAGES.has(requestedStage) ? requestedStage : DEFAULT_STAGE;

    const deal = await Deal.create({
      firmId: req.user.firmId,
      clientId,
      title,
      stage,
      value: typeof req.body?.value === 'number' ? req.body.value : null,
    });

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create deal' });
  }
};

const listDeals = async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const deals = await Deal.find({ firmId: req.user.firmId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.json({ success: true, data: deals });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list deals' });
  }
};

const getDealById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const deal = await Deal.findOne(
      { _id: id, firmId: req.user.firmId },
      { title: 1, stage: 1, value: 1, clientId: 1, createdAt: 1 }
    ).lean();
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });

    const [client, dockets, invoices] = await Promise.all([
      CrmClient.findOne({ _id: deal.clientId, firmId: req.user.firmId }, { name: 1, type: 1, email: 1, phone: 1 }).lean(),
      Case.find(
        { firmId: req.user.firmId, dealId: deal._id },
        { caseId: 1, caseNumber: 1, title: 1, status: 1, priority: 1, createdAt: 1, crmClientId: 1 }
      ).sort({ createdAt: -1 }).lean(),
      Invoice.find(
        { firmId: req.user.firmId, dealId: deal._id },
        { amount: 1, status: 1, issuedAt: 1, paidAt: 1, clientId: 1, docketId: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
    ]);

    return res.json({
      success: true,
      data: {
        deal,
        client,
        dockets,
        invoices,
      },
    });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch deal' });
  }
};

const updateDealStage = async (req, res) => {
  try {
    const stage = String(req.body?.stage || '').trim();
    if (!ALLOWED_STAGES.has(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid stage' });
    }

    const deal = await Deal.findOne({ _id: req.params.id, firmId: req.user.firmId });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });

    deal.stage = stage;
    await deal.save();

    return res.json({ success: true, data: deal });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to update deal stage' });
  }
};

module.exports = {
  createDeal,
  listDeals,
  getDealById,
  updateDealStage,
};
