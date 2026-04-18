const mongoose = require('mongoose');
const Lead = require('../models/Lead.model');
const CrmClient = require('../models/CrmClient.model');
const { upsertCanonicalClientFromCrm } = require('../services/crmClientMapping.service');

const ALLOWED_STATUSES = new Set(['new', 'contacted', 'converted']);

const parsePagination = (query = {}) => {
  const rawLimit = Number.parseInt(query.limit, 10);
  const rawSkip = Number.parseInt(query.skip, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
  return { limit, skip };
};

const createLead = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const payload = {
      firmId: req.user.firmId,
      name,
      email: req.body?.email || null,
      phone: req.body?.phone || null,
      source: req.body?.source || 'manual',
    };

    const lead = await Lead.create(payload);
    return res.status(201).json({ success: true, data: lead });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create lead' });
  }
};

const listLeads = async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const leads = await Lead.find({ firmId: req.user.firmId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.json({ success: true, data: leads });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list leads' });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const lead = await Lead.findOne({ _id: req.params.id, firmId: req.user.firmId });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.status = status;
    await lead.save();
    return res.json({ success: true, data: lead });
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to update lead status' });
  }
};

const convertLead = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let response = null;
    await session.withTransaction(async () => {
      const lead = await Lead.findOne({ _id: req.params.id, firmId: req.user.firmId }).session(session);
      if (!lead) {
        response = { status: 404, payload: { success: false, message: 'Lead not found' } };
        return;
      }

      if (lead.linkedClientId) {
        const existingCrmClient = await CrmClient.findOne({
          _id: lead.linkedClientId,
          firmId: req.user.firmId,
        }).session(session);
        const existingClient = existingCrmClient
          ? await upsertCanonicalClientFromCrm({
            crmClient: existingCrmClient,
            firmId: req.user.firmId,
            createdByXid: req.user?.xid || req.user?.xID || 'SYSTEM',
            session,
          })
          : null;
        response = {
          status: 200,
          payload: {
            success: true,
            data: {
              lead,
              client: existingClient || null,
              legacyCrmClientId: existingCrmClient?._id || null,
            },
          },
        };
        return;
      }

      const crmClient = await CrmClient.create([{
        firmId: req.user.firmId,
        name: lead.name,
        type: 'individual',
        email: lead.email,
        phone: lead.phone,
        tags: [],
      }], { session });
      const client = await upsertCanonicalClientFromCrm({
        crmClient: crmClient[0],
        firmId: req.user.firmId,
        createdByXid: req.user?.xid || req.user?.xID || 'SYSTEM',
        session,
      });

      lead.status = 'converted';
      lead.linkedClientId = crmClient[0]._id;
      await lead.save({ session });

      response = {
        status: 200,
        payload: {
          success: true,
          data: {
            lead,
            client,
            legacyCrmClientId: crmClient[0]._id,
          },
        },
      };
    });

    if (!response) {
      return res.status(500).json({ success: false, message: 'Failed to convert lead' });
    }
    return res.status(response.status).json(response.payload);
  } catch (error) {
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to convert lead' });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createLead,
  listLeads,
  updateLeadStatus,
  convertLead,
};
