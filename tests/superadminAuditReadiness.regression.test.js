#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-placeholder-for-ci-only';
process.env.JWT_PASSWORD_SETUP_SECRET = 'test-setup-secret-placeholder-for-ci-only';
process.env.SUPERADMIN_XID = 'X000001';
process.env.SUPERADMIN_EMAIL = 'sa@test.com';
process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
process.env.SUPERADMIN_PASSWORD_HASH = '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.REDIS_URL = '';
process.env.ALLOW_REDIS_FALLBACK = 'true';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/docketra';

async function testPilotReadinessAuditStates() {
  const originalLoad = Module._load;
  let countMode = 'positive';
  let observedFilter = null;

  Module._load = function (request, parent, isMain) {
    if (request === './superadminFirmHealth.service') {
      return { getFirmHealthSnapshot: async () => ({ totals: { critical: 0, atRisk: 0 } }) };
    }
    if (request === './superadminDiagnostics.service') {
      return { getSupportDiagnosticsSnapshot: async () => ({ generatedAt: '2026-11-26T00:00:00.000Z', firms: [] }) };
    }
    if (request === './onboardingAnalytics.service') {
      return { getOnboardingInsights: async () => ({ summary: { staleUsers: 0 } }) };
    }
    if (request === './featureFlags.service') {
      return {
        getFeatureFlagsSnapshot: async () => ({ flags: [] }),
        getFeatureFlagRegistry: () => [{ key: 'pilot_readiness' }],
      };
    }
    if (request === '../models/Firm.model') {
      return {
        find: () => ({
          select: () => ({
            lean: async () => [],
          }),
        }),
      };
    }
    if (request === '../models/User.model') {
      return { aggregate: async () => [] };
    }
    if (request === '../models/SuperadminAudit.model') {
      return {
        countDocuments: async (filter) => {
          observedFilter = filter;
          if (countMode === 'error') {
            throw new Error('simulated query failure');
          }
          return countMode === 'positive' ? 3 : 0;
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    const servicePath = require.resolve('../src/services/superadminPilotReadiness.service');
    delete require.cache[servicePath];
    const { buildPilotReadinessSnapshot } = require('../src/services/superadminPilotReadiness.service');

    countMode = 'positive';
    const passSnap = await buildPilotReadinessSnapshot();
    const passAudit = passSnap.checklist.find((item) => item.key === 'audit_logging_readiness');
    assert.ok(observedFilter?.timestamp?.$gte instanceof Date, 'Readiness audit query should filter directly on indexed timestamp field');
    assert.strictEqual(observedFilter.$or, undefined, 'Readiness audit query must not use unindexed $or createdAt fallback');
    assert.strictEqual(passAudit.status, 'pass');
    assert.strictEqual(passAudit.summary, 'Recent superadmin audit metadata events (14d): 3.');

    countMode = 'zero';
    const zeroSnap = await buildPilotReadinessSnapshot();
    const zeroAudit = zeroSnap.checklist.find((item) => item.key === 'audit_logging_readiness');
    assert.strictEqual(zeroAudit.status, 'watch');
    assert.strictEqual(zeroAudit.summary, 'Recent superadmin audit metadata events (14d): 0.');

    countMode = 'error';
    const errorSnap = await buildPilotReadinessSnapshot();
    const errorAudit = errorSnap.checklist.find((item) => item.key === 'audit_logging_readiness');
    assert.strictEqual(errorAudit.status, 'watch');
    assert.ok(errorAudit.summary.includes('query failed'), 'Query error should surface explicitly instead of pretending count is 0');
  } finally {
    Module._load = originalLoad;
  }
}

async function testSuperadminLoginAndLogoutAuditEvents() {
  const bcryptPath = require.resolve('bcrypt');
  const prevBcrypt = require.cache[bcryptPath];
  const auditLogPath = require.resolve('../src/models/AuditLog.model');
  const prevAuditLog = require.cache[auditLogPath];
  const authAuditPath = require.resolve('../src/models/AuthAudit.model');
  const prevAuthAudit = require.cache[authAuditPath];
  const superadminAuditPath = require.resolve('../src/models/SuperadminAudit.model');
  const prevSuperadminAudit = require.cache[superadminAuditPath];

  const recordedSuperadminAudits = [];

  require.cache[bcryptPath] = { id: bcryptPath, filename: bcryptPath, loaded: true, exports: { compare: async () => true, hash: async (v) => v } };
  require.cache[auditLogPath] = { id: auditLogPath, filename: auditLogPath, loaded: true, exports: { create: async () => ({}), insertMany: async () => [] } };
  require.cache[authAuditPath] = { id: authAuditPath, filename: authAuditPath, loaded: true, exports: { create: async () => ({}), insertMany: async () => [] } };
  require.cache[superadminAuditPath] = {
    id: superadminAuditPath,
    filename: superadminAuditPath,
    loaded: true,
    exports: {
      create: async (doc) => {
        recordedSuperadminAudits.push(doc);
        return doc;
      },
    },
  };

  delete require.cache[require.resolve('../src/services/superadminLifecycle.service')];
  delete require.cache[require.resolve('../src/services/authSession.service')];
  delete require.cache[require.resolve('../src/controllers/auth.controller')];

  const RefreshToken = require('../src/models/RefreshToken.model');
  const origCreate = RefreshToken.create;
  RefreshToken.create = async ([doc]) => [doc];

  try {
    const { login, logout } = require('../src/controllers/auth.controller');
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
      cookie() { return this; },
      clearCookie() { return this; },
    });

    const loginRes = makeRes();
    await login(
      {
        body: { xID: 'X000001', password: 'AnyPass#123' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
        headers: { 'user-agent': 'test-agent' },
        requestId: 'req-login-1',
        loginScope: 'superadmin',
        skipTransaction: true,
      },
      loginRes
    );
    assert.strictEqual(loginRes.statusCode, 200);

    const logoutRes = makeRes();
    await logout(
      {
        user: { role: 'SUPERADMIN', xID: 'X000001', email: 'sa@test.com', _id: '000000000000000000000001' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
        headers: { 'user-agent': 'test-agent' },
        requestId: 'req-logout-1',
        skipTransaction: true,
      },
      logoutRes
    );
    assert.strictEqual(logoutRes.statusCode, 200);

    const loginAudit = recordedSuperadminAudits.find((entry) => entry.actionType === 'SuperadminLogin');
    const logoutAudit = recordedSuperadminAudits.find((entry) => entry.actionType === 'SuperadminLogout');

    assert.ok(loginAudit, 'Superadmin login must emit a SuperadminLogin event to SuperadminAudit');
    assert.strictEqual(loginAudit.performedBy, 'sa@test.com');
    assert.strictEqual(loginAudit.targetEntityType, 'User');
    assert.strictEqual(loginAudit.performedById, '000000000000000000000001');

    assert.ok(logoutAudit, 'Superadmin logout must emit a SuperadminLogout event to SuperadminAudit');
    assert.strictEqual(logoutAudit.performedBy, 'sa@test.com');
    assert.strictEqual(logoutAudit.targetEntityType, 'User');
  } finally {
    RefreshToken.create = origCreate;
    if (prevBcrypt) require.cache[bcryptPath] = prevBcrypt; else delete require.cache[bcryptPath];
    if (prevAuditLog) require.cache[auditLogPath] = prevAuditLog; else delete require.cache[auditLogPath];
    if (prevAuthAudit) require.cache[authAuditPath] = prevAuthAudit; else delete require.cache[authAuditPath];
    if (prevSuperadminAudit) require.cache[superadminAuditPath] = prevSuperadminAudit; else delete require.cache[superadminAuditPath];
  }
}

(async () => {
  await testPilotReadinessAuditStates();
  await testSuperadminLoginAndLogoutAuditEvents();
  console.log('superadminAuditReadiness.regression.test.js passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
