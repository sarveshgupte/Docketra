const { createHash } = require('crypto');
const SettingsAuditLog = require('../models/SettingsAuditLog.model');
const { diffFields, sanitizeValue } = require('./docketAudit.service');

const CATEGORIES = new Set(['roles', 'workflows', 'configs', 'integrations']);

const normalizeCategory = (category) => {
  const value = String(category || '').trim().toLowerCase();
  return CATEGORIES.has(value) ? value : null;
};

const normalizeActorRole = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (normalized === 'ADMIN' || normalized === 'PRIMARY_ADMIN') return 'ADMIN';
  if (normalized === 'SYSTEM') return 'SYSTEM';
  return 'USER';
};

const stableStringify = (input) => {
  if (input === null || input === undefined) return String(input);
  if (input instanceof Date) return input.toISOString();
  if (typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(input).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`).join(',')}}`;
};

const buildDedupeKey = (payload) => createHash('sha256').update(stableStringify(payload)).digest('hex');

const logSettingsChange = async ({
  firmId,
  category,
  action,
  entityType = null,
  entityId = null,
  performedBy,
  performedByRole = 'ADMIN',
  before = null,
  after = null,
  changes = null,
  metadata = {},
  dedupeKey = null,
  timestamp = new Date(),
  session = null,
}) => {
  const normalizedCategory = normalizeCategory(category);
  if (!firmId || !normalizedCategory || !action || !performedBy) return null;

  const normalizedChanges = Array.isArray(changes)
    ? changes
    : diffFields(before || {}, after || {});

  if (!normalizedChanges.length) return null;

  const finalDedupeKey = dedupeKey || buildDedupeKey({
    firmId,
    category: normalizedCategory,
    action: String(action).toUpperCase(),
    entityType,
    entityId,
    performedBy,
    normalizedChanges,
    metadata: sanitizeValue(metadata),
  });

  try {
    const created = await SettingsAuditLog.create([{
      firmId,
      category: normalizedCategory,
      action: String(action).toUpperCase(),
      entityType,
      entityId: entityId ? String(entityId) : null,
      performedBy: String(performedBy).toUpperCase(),
      performedByRole: normalizeActorRole(performedByRole),
      changes: normalizedChanges,
      metadata: sanitizeValue(metadata),
      dedupeKey: finalDedupeKey,
      timestamp,
    }], session ? { session } : {});
    return Array.isArray(created) ? created[0] : created;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};

const logRoleChange = async ({
  firmId,
  performedBy,
  performedByRole,
  targetUserId,
  targetXID,
  beforeRole,
  afterRole,
  metadata = {},
  session = null,
}) => logSettingsChange({
  firmId,
  category: 'roles',
  action: 'ROLE_UPDATED',
  entityType: 'user',
  entityId: targetUserId || targetXID || null,
  performedBy,
  performedByRole,
  before: { role: beforeRole || null },
  after: { role: afterRole || null },
  metadata: {
    targetXID: targetXID || null,
    ...metadata,
  },
  session,
});

const logWorkflowChange = async (payload) => logSettingsChange({
  ...payload,
  category: 'workflows',
});

const logConfigChange = async (payload) => logSettingsChange({
  ...payload,
  category: 'configs',
});

const logIntegrationChange = async (payload) => logSettingsChange({
  ...payload,
  category: 'integrations',
});

const getSettingsAudit = async ({
  firmId,
  category = null,
  page = 1,
  limit = 50,
}) => {
  const parsedPage = Number.isInteger(Number(page)) ? Math.max(1, Number(page)) : 1;
  const parsedLimit = Number.isInteger(Number(limit)) ? Math.min(100, Math.max(1, Number(limit))) : 50;

  const query = { firmId };
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory) query.category = normalizedCategory;

  const [rows, total] = await Promise.all([
    SettingsAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    SettingsAuditLog.countDocuments(query),
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
  logSettingsChange,
  logRoleChange,
  logWorkflowChange,
  logConfigChange,
  logIntegrationChange,
  getSettingsAudit,
};
