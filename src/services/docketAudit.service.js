const { createHash } = require('crypto');
const DocketAuditLog = require('../models/DocketAuditLog.model');
const DocketAudit = require('../models/DocketAudit.model');

const MAX_VALUE_LENGTH = 300;
const AUDIT_EVENTS = Object.freeze({
  STATE_CHANGED: 'STATE_CHANGED',
  QC_ACTION: 'QC_ACTION',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
  CASE_HISTORY: 'CASE_HISTORY',
});

const SENSITIVE_FIELD_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'auth',
  'cookie',
  'payload',
  'pan',
  'gst',
  'cin',
];

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  if (['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(normalized)) return 'ADMIN';
  if (normalized === 'SYSTEM') return 'SYSTEM';
  return 'USER';
};

const isSensitiveField = (field) => {
  const key = String(field || '').toLowerCase();
  return SENSITIVE_FIELD_FRAGMENTS.some((fragment) => key.includes(fragment));
};

const sanitizeValue = (value, field = '') => {
  if (isSensitiveField(field)) return '[REDACTED]';
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH)}…`
      : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, field));
  }
  if (typeof value === 'object') {
    const result = {};
    Object.keys(value).slice(0, 30).forEach((key) => {
      result[key] = sanitizeValue(value[key], `${field}.${key}`);
    });
    return result;
  }
  return String(value);
};

const stableStringify = (input) => {
  if (input === null || input === undefined) return String(input);
  if (input instanceof Date) return input.toISOString();
  if (typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(input).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`).join(',')}}`;
};

const valuesEqual = (left, right) => stableStringify(left) === stableStringify(right);
const CANONICAL_AUDIT_SOURCE = 'docket.audit';

const buildDedupeKey = (payload) => createHash('sha256').update(stableStringify(payload)).digest('hex');

const diffFields = (before = {}, after = {}, fields = null) => {
  const keys = Array.isArray(fields) && fields.length > 0
    ? fields
    : [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];

  return keys.reduce((acc, field) => {
    const from = sanitizeValue(before?.[field], field);
    const to = sanitizeValue(after?.[field], field);
    if (!valuesEqual(from, to)) {
      acc.push({ field, from, to });
    }
    return acc;
  }, []);
};

async function logDocketEvent({
  docketId,
  firmId,
  event,
  userId,
  userRole,
  fromState,
  toState,
  qcOutcome,
  metadata = {},
  session = null,
}) {
  if (!event || typeof event !== 'string') return null;
  if (!docketId || !firmId) return null;
  const normalizedEvent = String(event).trim().toUpperCase();
  if (!normalizedEvent) return null;
  const sanitizedMetadata = sanitizeValue(metadata);
  const normalizedMetadata = {
    ...(sanitizedMetadata && typeof sanitizedMetadata === 'object' ? sanitizedMetadata : {}),
    source: sanitizedMetadata?.source || CANONICAL_AUDIT_SOURCE,
  };
  delete normalizedMetadata.reasonCode;
  delete normalizedMetadata.fromState;
  delete normalizedMetadata.toState;
  delete normalizedMetadata.actorId;
  delete normalizedMetadata.actorRole;
  const payload = {
    entityType: 'docket',
    entityId: String(docketId),
    docketId: String(docketId),
    firmId: String(firmId),
    event: AUDIT_EVENTS[normalizedEvent] || normalizedEvent,
    action: AUDIT_EVENTS[normalizedEvent] || normalizedEvent,
    userId: userId ? String(userId).toUpperCase() : undefined,
    userRole: userRole ? normalizeRole(userRole) : undefined,
    actorId: userId ? String(userId).toUpperCase() : undefined,
    actorRole: userRole ? normalizeRole(userRole) : undefined,
    fromState: fromState || undefined,
    toState: toState || undefined,
    qcOutcome: qcOutcome || undefined,
    reasonCode: sanitizedMetadata?.reasonCode || null,
    metadata: normalizedMetadata,
  };
  payload.dedupeKey = buildDedupeKey(payload);
  const created = await DocketAudit.create([payload], session ? { session } : undefined);
  return Array.isArray(created) ? created[0] : created;
}

async function getDocketTimeline(docketId, firmId = null) {
  if (!docketId) return [];
  return DocketAudit.find({
    docketId: String(docketId),
    ...(firmId ? { firmId: String(firmId) } : {}),
  })
    .sort({ createdAt: 1 })
    .lean();
}

const createLog = async ({
  firmId,
  docketId,
  action,
  fromState = null,
  toState = null,
  performedBy,
  performedByRole = 'USER',
  comment = null,
  changes = [],
  metadata = {},
  reasonCode = null,
  timestamp = new Date(),
  dedupeKey = null,
  session = null,
}) => {
  if (!firmId || !docketId || !action || !performedBy) return null;
  const normalizedChanges = Array.isArray(changes) ? changes : [];
  const finalDedupeKey = dedupeKey || buildDedupeKey({
    firmId,
    docketId,
    action: String(action).toUpperCase(),
    fromState,
    toState,
    performedBy,
    normalizedChanges,
    metadata: sanitizeValue(metadata),
  });

  try {
    // Bridge legacy docket audit logs into the unified canonical DocketAudit model.
    // This is intentionally best-effort to preserve backward compatibility.
    try {
      await logDocketEvent({
        docketId,
        firmId,
        event: action,
        userId: performedBy,
        userRole: performedByRole,
        fromState,
        toState,
        qcOutcome: metadata?.qcOutcome || null,
        metadata: {
          ...metadata,
          reasonCode: reasonCode || metadata?.reasonCode || null,
          comment: comment || null,
          changes: normalizedChanges,
          legacyAction: String(action || '').toUpperCase(),
          source: 'docket.audit.legacy_bridge',
        },
        session,
      });
    } catch (_) {
      // Intentionally swallow canonical logging failures to avoid breaking existing workflows.
    }

    const created = await DocketAuditLog.create([{
      firmId,
      docketId,
      action: String(action).toUpperCase(),
      fromState,
      toState,
      performedBy: String(performedBy).toUpperCase(),
      performedByRole: normalizeRole(performedByRole),
      comment: comment ? String(comment).slice(0, 500) : null,
      changes: normalizedChanges,
      metadata: sanitizeValue(metadata),
      reasonCode: reasonCode || sanitizeValue(metadata)?.reasonCode || null,
      timestamp,
      dedupeKey: finalDedupeKey,
    }], session ? { session } : {});
    return Array.isArray(created) ? created[0] : created;
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }
    throw error;
  }
};

const logCreation = async ({
  firmId,
  docketId,
  performedBy,
  performedByRole,
  initialData = {},
  metadata = {},
  session = null,
}) => createLog({
  firmId,
  docketId,
  action: 'CREATED',
  fromState: null,
  toState: initialData.status || null,
  performedBy,
  performedByRole,
  changes: diffFields({}, initialData),
  metadata,
  session,
});

const logUpdate = async ({
  firmId,
  docketId,
  performedBy,
  performedByRole,
  before = {},
  after = {},
  fields = null,
  action = 'UPDATED',
  metadata = {},
  comment = null,
  session = null,
}) => {
  const changes = diffFields(before, after, fields);
  if (changes.length === 0) return null;
  return createLog({
    firmId,
    docketId,
    action,
    fromState: before.status || null,
    toState: after.status || null,
    performedBy,
    performedByRole,
    comment,
    changes,
    metadata,
    session,
  });
};

const logStatusChange = async ({
  firmId,
  docketId,
  performedBy,
  performedByRole,
  fromStatus,
  toStatus,
  metadata = {},
  comment = null,
  session = null,
}) => createLog({
  firmId,
  docketId,
  action: 'STATUS_CHANGED',
  fromState: fromStatus || null,
  toState: toStatus || null,
  performedBy,
  performedByRole,
  comment,
  changes: diffFields({ status: fromStatus || null }, { status: toStatus || null }, ['status']),
  metadata,
  session,
});

const logAssignment = async ({
  firmId,
  docketId,
  performedBy,
  performedByRole,
  fromAssignee = null,
  toAssignee = null,
  fromStatus = null,
  toStatus = null,
  action = 'ASSIGNMENT',
  metadata = {},
  comment = null,
  session = null,
}) => createLog({
  firmId,
  docketId,
  action,
  fromState: fromStatus,
  toState: toStatus,
  performedBy,
  performedByRole,
  comment,
  changes: diffFields(
    { assignedToXID: fromAssignee || null, status: fromStatus || null },
    { assignedToXID: toAssignee || null, status: toStatus || null },
    ['assignedToXID', 'status']
  ),
  metadata,
  session,
});

const logBulkAction = async ({
  firmId,
  docketIds = [],
  performedBy,
  performedByRole,
  action = 'BULK_ACTION',
  metadata = {},
  buildPerDocketPayload = () => ({}),
  session = null,
}) => {
  const uniqueIds = [...new Set((docketIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!uniqueIds.length) return [];

  return Promise.all(uniqueIds.map((docketId) => {
    const payload = buildPerDocketPayload(docketId) || {};
    return createLog({
      firmId,
      docketId,
      action,
      fromState: payload.fromState || null,
      toState: payload.toState || null,
      performedBy,
      performedByRole,
      comment: payload.comment || null,
      changes: Array.isArray(payload.changes) ? payload.changes : [],
      metadata: {
        ...metadata,
        ...(payload.metadata || {}),
      },
      session,
    });
  }));
};

const getAuditTrail = async ({
  firmId,
  docketId,
  page = 1,
  limit = 50,
}) => {
  const parsedPage = Number.isInteger(Number(page)) ? Math.max(1, Number(page)) : 1;
  const parsedLimit = Number.isInteger(Number(limit)) ? Math.min(100, Math.max(1, Number(limit))) : 50;
  const query = { firmId, docketId };
  const [rows, total] = await Promise.all([
    DocketAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    DocketAuditLog.countDocuments(query),
  ]);
  return {
    rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / parsedLimit)),
    },
  };
};

module.exports = {
  AUDIT_EVENTS,
  sanitizeValue,
  diffFields,
  logDocketEvent,
  getDocketTimeline,
  createLog,
  logCreation,
  logUpdate,
  logStatusChange,
  logAssignment,
  logBulkAction,
  getAuditTrail,
};
