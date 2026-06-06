#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.REDIS_URL = '';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const caseAuditRows = [
  {
    _id: 'case-1',
    firmId: 'firm-1',
    actionType: 'FIRM_SETTINGS_UPDATED',
    description: 'Updated firm settings',
    performedByXID: 'X000003',
    timestamp: new Date('2026-06-06T10:02:00.000Z'),
    metadata: { actorRole: 'PRIMARY_ADMIN' },
  },
  {
    _id: 'case-2',
    firmId: 'firm-1',
    actionType: 'USER_CLIENT_ACCESS_UPDATED',
    description: 'Updated user access',
    performedByXID: 'X000002',
    timestamp: new Date('2026-06-06T09:59:00.000Z'),
    metadata: { actorRole: 'ADMIN' },
  },
];

const authAuditRows = [
  {
    _id: 'auth-1',
    firmId: 'firm-1',
    actionType: 'AccountDeactivated',
    description: 'User account deactivated by admin',
    xID: 'X000004',
    timestamp: new Date('2026-06-06T10:01:00.000Z'),
    metadata: {},
  },
  {
    _id: 'auth-2',
    firmId: 'firm-1',
    actionType: 'InviteEmailResent',
    description: 'Invite resent',
    xID: 'X000005',
    timestamp: new Date('2026-06-06T09:58:00.000Z'),
    metadata: {},
  },
];

const buildFindChain = (rows) => ({
  sort() {
    return this;
  },
  limit(limit) {
    return {
      lean: async () => rows.slice(0, limit),
    };
  },
});

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../models/AuthAudit.model') {
    return {
      countDocuments: async () => authAuditRows.length,
      find: () => buildFindChain(authAuditRows),
    };
  }
  if (request === '../models/CaseAudit.model') {
    return {
      countDocuments: async () => caseAuditRows.length,
      find: () => buildFindChain(caseAuditRows),
    };
  }
  if (request === '../models/User.model') return {};
  if (request === '../models/Case.model') return {};
  if (request === '../models/Task') return {};
  if (request === '../models/Firm.model') return {};
  if (request === '../models/Client.model') return {};
  if (request === '../models/Team.model') return {};
  if (request === '../models/Category.model') return {};
  if (request === '../services/email.service') return {};
  if (request === '../services/auditLog.service') return { logAdminAction: async () => {}, logCaseListViewed: async () => {} };
  if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
  if (request === '../services/diagnostics.service') return { getDiagnosticsSnapshot: async () => ({}) };
  if (request === '../services/softDelete.service') return { restoreDocument: async () => ({}), buildDiagnostics: async () => ({}) };
  if (request === '../services/tenantCaseMetrics.service') return { getLatestTenantMetrics: async () => ({}) };
  if (request === '../repositories/user.repository') return {};
  if (request === '../repositories/client.repository') return {};
  if (request === '../repositories/category.repository') return {};
  if (request === '../utils/tenantGuard') return { assertFirmContext: () => {} };
  if (request === '../services/adminController.service') {
    return {
      safeAuditLog: async () => {},
      resetUserToInvitedState: () => {},
      normalizeFirmSettings: (value) => value,
      normalizeWorkSettings: (value) => value,
    };
  }
  if (request === '../services/featureFlags.service') return { isExternalStorageEnabled: () => false };
  if (request === '../utils/hierarchy.utils') return { assertPrimaryAdmin: () => {}, getTagValidationError: () => null, normalizeId: (value) => value };
  if (request === '../services/adminActionAudit.service') return { logAuditEvent: async () => {}, getAuditLogs: async () => ({}) };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {}, listSettingsAudit: async () => ({ items: [], page: 1, limit: 25, total: 0 }) };
  if (request === '../services/settingsAudit.service') return { logConfigChange: async () => {}, logWorkflowChange: async () => {} };
  if (request === '../utils/encryption') return { safeDecrypt: () => null };
  if (request === '../utils/log') return { error: () => {}, warn: () => {}, info: () => {} };
  if (request === '../services/storage/resolveFirmStorageState') return { resolveFirmStorageState: () => ({}) };
  if (request === '../services/strictStorageAudit.service') return { EVENTS: {}, logStrictStorageEvent: () => {} };
  return originalLoad.call(this, request, parent, isMain);
};

const clear = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
};

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function run() {
  clear('../src/controllers/admin.controller');
  const { getFirmSettingsActivity } = require('../src/controllers/admin.controller');

  const req = {
    user: { firmId: 'firm-1' },
    query: { page: '1', limit: '2' },
  };
  const res = makeRes();

  await getFirmSettingsActivity(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload.success, true);
  assert.strictEqual(res.payload.pagination.page, 1);
  assert.strictEqual(res.payload.pagination.limit, 2);
  assert.strictEqual(res.payload.pagination.total, 4);
  assert.strictEqual(res.payload.pagination.hasNextPage, true);
  assert.strictEqual(res.payload.data.length, 2);
  assert.deepStrictEqual(
    res.payload.data.map((entry) => entry.description),
    ['Updated firm settings', 'User account deactivated by admin'],
  );

  const secondReq = {
    user: { firmId: 'firm-1' },
    query: { page: '2', limit: '2' },
  };
  const secondRes = makeRes();
  await getFirmSettingsActivity(secondReq, secondRes);

  assert.strictEqual(secondRes.statusCode, 200);
  assert.strictEqual(secondRes.payload.pagination.hasNextPage, false);
  assert.deepStrictEqual(
    secondRes.payload.data.map((entry) => entry.description),
    ['Updated user access', 'Invite resent'],
  );

  console.log('firmSettingsActivityPagination.test.js passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
    clear('../src/controllers/admin.controller');
  });
