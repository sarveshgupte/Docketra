const mongoose = require('mongoose');
const Deal = require('../models/Deal.model');
const CrmClient = require('../models/CrmClient.model');

const ALLOWED_STAGES = new Set(['new', 'in_progress', 'completed']);

const createDeal = async (req, res) => {
  try {
    const clientId = req.body?.clientId;
    const title = String(req.body?.title || '').trim();

    if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });

    const client = await CrmClient.findOne({ _id: clientId, firmId: req.user.firmId }).lean();
    if (!client) return res.status(400).json({ success: false, message: 'Invalid clientId' });

    const deal = await Deal.create({
      firmId: req.user.firmId,
      clientId,
      title,
      stage: req.body?.stage || 'new',
      value: typeof req.body?.value === 'number' ? req.body.value : null,
    });

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create deal' });
  }
};

const listDeals = async (req, res) => {
  try {
    const deals = await Deal.find({ firmId: req.user.firmId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: deals });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list deals' });
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
  updateDealStage,
};
