const mongoose = require('mongoose');
const AdminAuditLog = require('../models/AdminAuditLog.model');
const log = require('../utils/log');

const SENSITIVE_METADATA_KEY_PATTERN = /(token|secret|password|authorization|cookie|documentcontent|rawpayload|fullpayload|fullDocument|content)/i;

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  return null;
};

const normalizeAction = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || null;
};

const deriveModuleFromAction = (action) => {
  if (!action) return 'admin';
  if (action.startsWith('USER_') || action.startsWith('ROLE_') || action.includes('HIERARCHY')) return 'users';
  if (action.includes('CATEGORY')) return 'categories';
  if (action.includes('WORKBENCH')) return 'workbench';
  return 'admin';
};

const sanitizeMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};

  const sanitized = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) return;
    if (typeof value === 'string' && value.length > 300) {
      sanitized[key] = `${value.slice(0, 297)}...`;
      return;
    }
    if (value && typeof value === 'object') {
      sanitized[key] = '[REDACTED_OBJECT]';
      return;
    }
    sanitized[key] = value;
  });

  return sanitized;
};

const buildSummary = (entry) => {
  const actorLabel = entry?.actorId?.name || entry?.actorId?.email || entry?.actorId?.xID || 'An admin';
  const action = String(entry?.action || 'ACTION').replace(/_/g, ' ').toLowerCase();
  const targetLabel = entry?.targetId?.name || entry?.targetId?.email || entry?.targetId?.xID || null;
  if (targetLabel) {
    return `${actorLabel} ${action} for ${targetLabel}`;
  }
  return `${actorLabel} ${action}`;
};

const toAuditListItem = (entry) => {
  const safeMetadata = sanitizeMetadata(entry?.metadata || {});
  const moduleName = String(safeMetadata.module || deriveModuleFromAction(entry?.action));
  const severity = String(safeMetadata.severity || 'low').toLowerCase();
  const targetEntity = safeMetadata.targetEntity || (entry?.targetId ? 'USER' : 'FIRM');

  return {
    _id: entry?._id,
    action: entry?.action,
    module: moduleName,
    severity,
    targetEntity,
    summary: buildSummary(entry),
    metadata: safeMetadata,
    actorId: entry?.actorId || null,
    targetId: entry?.targetId || null,
    createdAt: entry?.createdAt,
  };
};

const logAuditEvent = async ({ firmId, actorId, targetId = null, action, metadata = {} }) => {
  const resolvedFirmId = normalizeObjectId(firmId);
  const resolvedActorId = normalizeObjectId(actorId);
  const resolvedTargetId = normalizeObjectId(targetId);

  const normalizedAction = normalizeAction(action);
  if (!resolvedFirmId || !resolvedActorId || !normalizedAction) {
    return null;
  }

  try {
    return await AdminAuditLog.create({
      firmId: resolvedFirmId,
      actorId: resolvedActorId,
      targetId: resolvedTargetId,
      action: normalizedAction,
      metadata,
    });
  } catch (error) {
    log.error('[ADMIN_AUDIT_LOG] Failed to persist audit event:', error.message);
    return null;
  }
};

const getAuditLogs = async ({
  firmId,
  userId,
  actor,
  action,
  actionType,
  module,
  startDate,
  endDate,
  targetEntity,
  severity,
  page = 1,
  limit = 50,
}) => {
  const resolvedFirmId = normalizeObjectId(firmId);
  if (!resolvedFirmId) {
    return {
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNextPage: false },
    };
  }

  const query = { firmId: resolvedFirmId };

  const actorFilter = actor || userId;
  const resolvedUserId = normalizeObjectId(actorFilter);
  if (resolvedUserId) {
    query.actorId = resolvedUserId;
  }

  const normalizedAction = normalizeAction(actionType || action);
  if (normalizedAction) {
    query.action = normalizedAction;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (module) {
    query['metadata.module'] = String(module).trim().toLowerCase();
  }

  if (targetEntity) {
    query['metadata.targetEntity'] = String(targetEntity).trim().toUpperCase();
  }

  if (severity) {
    query['metadata.severity'] = String(severity).trim().toLowerCase();
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [total, rows] = await Promise.all([
    AdminAuditLog.countDocuments(query),
    AdminAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('actorId', '_id name email xID role')
      .populate('targetId', '_id name email xID role')
      .lean(),
  ]);

  return {
    data: rows.map(toAuditListItem),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: total > 0 ? Math.ceil(total / safeLimit) : 0,
      hasNextPage: skip + rows.length < total,
    },
  };
};

module.exports = {
  logAuditEvent,
  getAuditLogs,
  __testables: {
    sanitizeMetadata,
    deriveModuleFromAction,
    buildSummary,
  },
};
