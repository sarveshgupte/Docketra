const mongoose = require('mongoose');
const CrmClient = require('../models/CrmClient.model');

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
    const clients = await CrmClient.find({ firmId: req.user.firmId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: clients });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to list clients' });
  }
};

const getCrmClientById = async (req, res) => {
  try {
    const client = await CrmClient.findOne({ _id: req.params.id, firmId: req.user.firmId }).lean();
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    return res.json({ success: true, data: client });
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
