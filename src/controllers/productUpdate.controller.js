const ProductUpdate = require('../models/ProductUpdate.model');
const User = require('../models/User.model');
const { getLatestPublishedUpdate, normalizeUpdate } = require('../services/productUpdate.service');

const createProductUpdate = async (req, res) => {
  try {
    const { title, content, isPublished = false, version = null, updateKey = null } = req.body || {};

    const normalizedBullets = Array.isArray(content)
      ? content.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    const created = await ProductUpdate.create({
      title: String(title || '').trim(),
      content: normalizedBullets,
      isPublished: Boolean(isPublished),
      version: version ? String(version).trim() : null,
      updateKey: updateKey ? String(updateKey).trim() : null,
      createdBy: req.user?._id?.toString?.() || req.user?.xID || 'SYSTEM',
    });

    return res.status(201).json({ success: true, data: normalizeUpdate(created.toObject()) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Unable to create product update' });
  }
};

const getLatestProductUpdate = async (_req, res) => {
  try {
    const latest = await getLatestPublishedUpdate();
    return res.json({ success: true, data: latest });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load latest update' });
  }
};

const listProductUpdates = async (_req, res) => {
  try {
    const updates = await ProductUpdate.find({}).sort({ createdAt: -1, _id: -1 }).lean();
    return res.json({ success: true, data: updates.map(normalizeUpdate) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load updates' });
  }
};

const markUpdateSeen = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { updateId } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const exists = await ProductUpdate.findById(updateId).lean();
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Update not found' });
    }

    await User.updateOne({ _id: userId }, { $set: { lastSeenUpdateId: String(updateId) } });

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Unable to mark update as seen' });
  }
};

module.exports = {
  createProductUpdate,
  getLatestProductUpdate,
  listProductUpdates,
  markUpdateSeen,
};
