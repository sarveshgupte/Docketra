const crypto = require('crypto');
const AuditLog = require('../models/AuditLog.model');
const log = require('../utils/log');

const PLATFORM_TENANT = 'PLATFORM';

const getRequestIp = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req?.ip || req?.headers?.['x-real-ip'] || req?.connection?.remoteAddress || req?.socket?.remoteAddress || 'unknown';
};

const getRequestUserAgent = (req) => req?.headers?.['user-agent'] || req?.get?.('user-agent') || 'unknown';

const sanitize = (value) => (value === undefined ? null : value);

const computeChangedFields = (oldValue = {}, newValue = {}) => {
  const previous = oldValue && typeof oldValue === 'object' ? oldValue : {};
  const current = newValue && typeof newValue === 'object' ? newValue : {};

  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const oldDiff = {};
  const newDiff = {};

  for (const key of keys) {
    const oldSerialized = JSON.stringify(previous[key]);
    const newSerialized = JSON.stringify(current[key]);
    if (oldSerialized !== newSerialized) {
      oldDiff[key] = previous[key];
      newDiff[key] = current[key];
    }
  }

  return { oldValue: oldDiff, newValue: newDiff };
};

const buildHash = (payload, previousHash = '') => {
  const normalized = JSON.stringify(payload);
  return crypto.createHash('sha256').update(`${normalized}|${previousHash || ''}`).digest('hex');
};

const logForensicAudit = async ({
  tenantId,
  entityType,
  entityId,
  action,
  oldValue = null,
  newValue = null,
  performedBy,
  performedByRole = null,
  impersonatedBy = null,
  ipAddress,
  userAgent,
  metadata = null,
  hashChain = false,
}) => {
  if (!tenantId) {
    throw new Error('tenantId is required for audit logging');
  }

  if (!entityType || !entityId || !action || !performedBy) {
    throw new Error('entityType, entityId, action, and performedBy are required for audit logging');
  }

  if (!ipAddress || !userAgent) {
    throw new Error('ipAddress and userAgent are required for audit logging');
  }

  const payload = {
    tenantId: String(tenantId || PLATFORM_TENANT),
    entityType,
    entityId: String(entityId),
    action,
    oldValue: sanitize(oldValue),
    newValue: sanitize(newValue),
    performedBy: String(performedBy),
    performedByRole,
    impersonatedBy,
    ipAddress: String(ipAddress),
    userAgent: String(userAgent),
    metadata: sanitize(metadata),
  };

  if (hashChain) {
    const previousRecord = await AuditLog.findOne({ tenantId: payload.tenantId }).sort({ createdAt: -1 }).select('currentHash').lean();
    payload.previousHash = previousRecord?.currentHash || null;
    payload.currentHash = buildHash(payload, payload.previousHash);
  }

  return AuditLog.create(payload);
};

const safeLogForensicAudit = async (params) => {
  try {
    return await logForensicAudit(params);
  } catch (error) {
    log.error('FORENSIC_AUDIT_FAILURE', {
      error: error.message,
      action: params?.action,
      entityType: params?.entityType,
      entityId: params?.entityId,
      tenantId: params?.tenantId || null,
    });
    return null;
  }
};

module.exports = {
  PLATFORM_TENANT,
  getRequestIp,
  getRequestUserAgent,
  computeChangedFields,
  logForensicAudit,
  safeLogForensicAudit,
};
