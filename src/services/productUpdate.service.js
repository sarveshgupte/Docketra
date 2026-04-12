const ProductUpdate = require('../models/ProductUpdate.model');

const normalizeUpdate = (doc) => {
  if (!doc) return null;
  return {
    _id: doc._id?.toString?.() || null,
    title: doc.title,
    content: Array.isArray(doc.content) ? doc.content : [],
    isPublished: !!doc.isPublished,
    createdAt: doc.createdAt || null,
    createdBy: doc.createdBy || null,
    version: doc.version || null,
    updateKey: doc.updateKey || null,
  };
};

const getLatestPublishedUpdate = async () => {
  const update = await ProductUpdate.findOne({ isPublished: true }).sort({ createdAt: -1, _id: -1 }).lean();
  return normalizeUpdate(update);
};

module.exports = {
  getLatestPublishedUpdate,
  normalizeUpdate,
};
