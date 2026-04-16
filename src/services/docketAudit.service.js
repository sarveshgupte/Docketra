const { createHash } = require('crypto');
const DocketAuditLog = require('../models/DocketAuditLog.model');

const MAX_VALUE_LENGTH = 300;
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
  sanitizeValue,
  diffFields,
  createLog,
  logCreation,
  logUpdate,
  logStatusChange,
  logAssignment,
  logBulkAction,
  getAuditTrail,
};
