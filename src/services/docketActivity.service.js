const mongoose = require('mongoose');
const { DocketActivity, DOCKET_ACTIVITY_TYPES } = require('../models/DocketActivity.model');
const User = require('../models/User.model');
const log = require('../utils/log');

const ACTIVITY_TYPE_SET = new Set(DOCKET_ACTIVITY_TYPES);

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const logActivity = async ({ docketId, firmId, type, description, metadata, performedByXID }) => {
  const docketObjectId = normalizeObjectId(docketId);
  const firmObjectId = normalizeObjectId(firmId);
  const normalizedType = String(type || '').trim().toUpperCase();

  if (!docketObjectId || !firmObjectId || !ACTIVITY_TYPE_SET.has(normalizedType)) {
    return null;
  }

  return DocketActivity.create({
    docketId: docketObjectId,
    firmId: firmObjectId,
    type: normalizedType,
    description: String(description || '').trim(),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    performedByXID: String(performedByXID || '').trim().toUpperCase() || undefined,
  });
};

const logActivitySafe = (payload) => {
  setImmediate(() => {
    logActivity(payload).catch((error) => {
      log.warn('[DocketActivity] Failed to log activity', {
        type: payload?.type,
        docketId: payload?.docketId,
        firmId: payload?.firmId,
        message: error?.message,
      });
    });
  });
};

const getDocketTimeline = async (docketId, firmId, { type, page = 1, limit = 20 } = {}) => {
  const docketObjectId = normalizeObjectId(docketId);
  const firmObjectId = normalizeObjectId(firmId);
  if (!docketObjectId || !firmObjectId) {
    return { items: [], page: 1, limit: 20, total: 0, hasNextPage: false };
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const pageLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNumber - 1) * pageLimit;

  const query = { docketId: docketObjectId, firmId: firmObjectId };
  if (type && ACTIVITY_TYPE_SET.has(String(type).trim().toUpperCase())) {
    query.type = String(type).trim().toUpperCase();
  }

  const [items, total] = await Promise.all([
    DocketActivity.find(query)
      .select('type description metadata performedByXID createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean()
      .exec(),
    DocketActivity.countDocuments(query).exec(),
  ]);

  const xids = [...new Set(items.map((item) => item.performedByXID).filter(Boolean))];
  const users = xids.length
    ? await User.find({ firmId: firmObjectId, xID: { $in: xids } }).select('xID name').lean()
    : [];
  const userMap = new Map(users.map((user) => [user.xID, user.name]));

  return {
    items: items.map((item) => ({
      type: item.type,
      description: item.description,
      metadata: item.metadata || {},
      performedByXID: item.performedByXID,
      performedByName: userMap.get(item.performedByXID) || null,
      createdAt: item.createdAt,
    })),
    page: pageNumber,
    limit: pageLimit,
    total,
    hasNextPage: skip + items.length < total,
  };
};

module.exports = {
  DOCKET_ACTIVITY_TYPES,
  logActivity,
  logActivitySafe,
  getDocketTimeline,
};
