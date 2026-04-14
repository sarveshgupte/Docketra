const mongoose = require('mongoose');
const Invoice = require('../models/Invoice.model');
const CrmClient = require('../models/CrmClient.model');
const Deal = require('../models/Deal.model');
const Case = require('../models/Case.model');

const ALLOWED_STATUSES = new Set(['unpaid', 'paid']);

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawSkip = Number.parseInt(query.skip, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
  return { limit, skip };
};

const createInvoice = async (req, res) => {
  try {
    const firmId = req.user.firmId;
    const { clientId, dealId, docketId, amount } = req.body || {};

    if (!clientId) {
      return res.status(400).json({ success: false, message: 'clientId is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ success: false, message: 'Invalid clientId' });
    }
    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'amount is required' });
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      return res.status(400).json({ success: false, message: 'amount must be a number' });
    }

    const client = await CrmClient.findOne({ _id: clientId, firmId }).lean();
    if (!client) {
      return res.status(400).json({ success: false, message: 'Client not found' });
    }

    let resolvedDealId = null;
    if (dealId) {
      if (!mongoose.Types.ObjectId.isValid(dealId)) {
        return res.status(400).json({ success: false, message: 'Invalid dealId' });
      }
      const deal = await Deal.findOne({ _id: dealId, firmId }).lean();
      if (!deal) {
        return res.status(400).json({ success: false, message: 'Deal not found' });
      }
      resolvedDealId = dealId;
    }

    let resolvedDocketId = null;
    if (docketId) {
      if (!mongoose.Types.ObjectId.isValid(docketId)) {
        return res.status(400).json({ success: false, message: 'Invalid docketId' });
      }
      const docket = await Case.findOne({ _id: docketId, firmId }).lean();
      if (!docket) {
        return res.status(400).json({ success: false, message: 'Docket not found' });
      }
      resolvedDocketId = docketId;
    }

    const invoice = await Invoice.create({
      firmId,
      clientId,
      dealId: resolvedDealId,
      docketId: resolvedDocketId,
      amount: parsedAmount,
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create invoice' });
  }
};

const listInvoices = async (req, res) => {
  try {
    const firmId = req.user.firmId;
    const { limit, skip } = parsePagination(req.query);
    const query = { firmId };

    if (req.query.clientId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.clientId)) {
        return res.status(400).json({ success: false, message: 'Invalid clientId' });
      }
      query.clientId = new mongoose.Types.ObjectId(req.query.clientId);
    }

    if (req.query.dealId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.dealId)) {
        return res.status(400).json({ success: false, message: 'Invalid dealId' });
      }
      query.dealId = new mongoose.Types.ObjectId(req.query.dealId);
    }

    if (req.query.status) {
      if (!ALLOWED_STATUSES.has(req.query.status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      query.status = req.query.status;
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ success: true, data: invoices });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list invoices' });
  }
};

const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = await Invoice.findOne({ _id: id, firmId: req.user.firmId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.json({ success: true, data: invoice });
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    await invoice.save();

    return res.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to mark invoice as paid' });
  }
};

module.exports = {
  createInvoice,
  listInvoices,
  markAsPaid,
};
