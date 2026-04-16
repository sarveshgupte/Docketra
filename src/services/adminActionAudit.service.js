const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog.model');
const log = require('../utils/log');

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return null;
};

const logAuditEvent = async ({ firmId, actorId, targetId = null, action, metadata = {} }) => {
  const resolvedFirmId = normalizeObjectId(firmId);
  const resolvedActorId = normalizeObjectId(actorId);
  const resolvedTargetId = normalizeObjectId(targetId);

  if (!resolvedFirmId || !resolvedActorId || !action) {
    return null;
  }

  try {
    return await AdminAuditLog.create({
      firmId: resolvedFirmId,
      actorId: resolvedActorId,
      targetId: resolvedTargetId,
      action,
      metadata,
    });
  } catch (error) {
    log.error('[ADMIN_AUDIT_LOG] Failed to persist audit event:', error.message);
    return null;
  }
};

const getAuditLogs = async ({ firmId, userId, action, startDate, endDate, limit = 200 }) => {
  const resolvedFirmId = normalizeObjectId(firmId);
  if (!resolvedFirmId) return [];

  const query = { firmId: resolvedFirmId };

  const resolvedUserId = normalizeObjectId(userId);
  if (resolvedUserId) {
    query.$or = [{ actorId: resolvedUserId }, { targetId: resolvedUserId }];
  }

  if (action) {
    query.action = String(action).trim().toUpperCase();
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);

  return AdminAuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate('actorId', '_id name email xID role')
    .populate('targetId', '_id name email xID role')
    .lean();
};

module.exports = {
  logAuditEvent,
  getAuditLogs,
};
