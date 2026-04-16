const { randomUUID } = require('crypto');
const DocketAuditLog = require('../models/DocketAuditLog.model');
const SettingsAuditLog = require('../models/SettingsAuditLog.model');
const { getFieldChanges, sanitizeValue } = require('../utils/getFieldChanges');
const log = require('../utils/log');

const normalizeRole = (role) => {
  const value = String(role || '').trim().toUpperCase();
  if (value === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (value === 'SUPER_ADMIN' || value === 'ADMIN' || value === 'MANAGER' || value === 'SYSTEM') return value;
  return 'USER';
};

const resolveActor = (req, fallback = {}) => ({
  userId: String(
    req?.context?.userXID
    || req?.context?.userId
    || req?.user?.xID
    || req?.user?._id
    || req?.user?.id
    || fallback.userId
    || 'SYSTEM'
  ).trim(),
  role: normalizeRole(req?.user?.role || fallback.role),
});

const resolveTenantId = (req, fallback = {}) => String(
  req?.context?.tenantId
  || req?.context?.firmId
  || req?.firmId
  || req?.user?.firmId
  || fallback.tenantId
  || fallback.firmId
  || ''
).trim();

const resolveRequestId = (req, fallback = {}) => String(
  req?.context?.requestId
  || req?.requestId
  || fallback.requestId
  || randomUUID()
).trim();

const buildBasePayload = ({ req, tenantId, requestId, performedBy }) => ({
  tenantId: tenantId || resolveTenantId(req),
  requestId: requestId || resolveRequestId(req),
  performedBy: performedBy || resolveActor(req),
});

const buildDedupeFilter = (baseFilter, dedupeKey) => (dedupeKey
  ? { ...baseFilter, dedupeKey }
  : baseFilter);

const safeWrite = async (writer, logEvent, req, metadata = {}) => {
  try {
    return await writer();
  } catch (error) {
    log.error(logEvent, { req, error, ...metadata });
    return null;
  }
};

const writeDocketAudit = async ({
  req,
  docketId,
  action,
  fromState = null,
  toState = null,
  comment = null,
  metadata = {},
  oldDoc = null,
  newDoc = null,
  dedupeKey = null,
  session = null,
  tenantId = null,
  requestId = null,
  performedBy = null,
}) => {
  const base = buildBasePayload({ req, tenantId, requestId, performedBy });
  if (!base.tenantId || !docketId || !action) return null;

  const changes = oldDoc || newDoc ? getFieldChanges(oldDoc || {}, newDoc || {}) : [];
  const payload = {
    docketId: String(docketId),
    action: String(action).toUpperCase(),
    requestId: base.requestId,
    tenantId: base.tenantId,
    firmId: base.tenantId,
    performedBy: base.performedBy,
    fromState,
    toState,
    comment,
    metadata: sanitizeValue(metadata),
    changes,
    timestamp: new Date(),
    dedupeKey: dedupeKey || null,
  };

  return safeWrite(async () => {
    if (dedupeKey) {
      await DocketAuditLog.updateOne(
        buildDedupeFilter({
          tenantId: payload.tenantId,
          docketId: payload.docketId,
          action: payload.action,
          requestId: payload.requestId,
        }, dedupeKey),
        { $setOnInsert: payload },
        { upsert: true, ...(session ? { session } : {}) },
      );
      return payload;
    }
    return DocketAuditLog.create([payload], session ? { session } : undefined);
  }, 'DOCKET_AUDIT_WRITE_FAILED', req, { docketId, action });
};

const writeSettingsAudit = async ({
  req,
  settingsKey,
  action,
  metadata = {},
  oldDoc = null,
  newDoc = null,
  dedupeKey = null,
  session = null,
  tenantId = null,
  requestId = null,
  performedBy = null,
}) => {
  const base = buildBasePayload({ req, tenantId, requestId, performedBy });
  if (!base.tenantId || !settingsKey || !action) return null;

  const payload = {
    tenantId: base.tenantId,
    requestId: base.requestId,
    settingsKey: String(settingsKey),
    action: String(action).toUpperCase(),
    performedBy: base.performedBy,
    changes: getFieldChanges(oldDoc || {}, newDoc || {}),
    metadata: sanitizeValue(metadata),
    dedupeKey: dedupeKey || null,
    timestamp: new Date(),
  };

  return safeWrite(async () => {
    if (dedupeKey) {
      await SettingsAuditLog.updateOne(
        buildDedupeFilter({
          tenantId: payload.tenantId,
          settingsKey: payload.settingsKey,
          action: payload.action,
          requestId: payload.requestId,
        }, dedupeKey),
        { $setOnInsert: payload },
        { upsert: true, ...(session ? { session } : {}) },
      );
      return payload;
    }
    return SettingsAuditLog.create([payload], session ? { session } : undefined);
  }, 'SETTINGS_AUDIT_WRITE_FAILED', req, { settingsKey, action });
};

const listDocketAudit = async ({ tenantId, docketId, page = 1, limit = 50 }) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const query = { tenantId, docketId };

  const [items, total] = await Promise.all([
    DocketAuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(safeLimit).lean(),
    DocketAuditLog.countDocuments(query),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
};

const listSettingsAudit = async ({ tenantId, settingsKey = null, page = 1, limit = 50 }) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const query = { tenantId };
  if (settingsKey) query.settingsKey = settingsKey;

  const [items, total] = await Promise.all([
    SettingsAuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(safeLimit).lean(),
    SettingsAuditLog.countDocuments(query),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
};

module.exports = {
  getFieldChanges,
  writeDocketAudit,
  writeSettingsAudit,
  listDocketAudit,
  listSettingsAudit,
  resolveRequestId,
  resolveTenantId,
  resolveActor,
};
