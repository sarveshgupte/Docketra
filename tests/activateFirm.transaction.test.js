#!/usr/bin/env node
const assert = require('assert');
const originalMongoose = require('mongoose');

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const loadControllerWithMocks = ({ firmDoc }) => {
  const controllerPath = require.resolve('../src/controllers/superadmin.controller');
  const firmPath = require.resolve('../src/models/Firm.model');
  const authAuditPath = require.resolve('../src/models/AuthAudit.model');
  const superadminAuditPath = require.resolve('../src/models/SuperadminAudit.model');
  const mongoosePath = require.resolve('mongoose');

  delete require.cache[controllerPath];

  let ended = 0;
  let withTransactionCalls = 0;
  const session = {
    async withTransaction(fn) {
      withTransactionCalls += 1;
      await fn();
    },
    async endSession() {
      ended += 1;
    },
  };

  require.cache[mongoosePath] = {
    exports: {
      ...originalMongoose,
      startSession: async () => session,
      Types: originalMongoose.Types,
    },
  };
  require.cache[firmPath] = {
    exports: {
      findById: () => ({
        session: async () => firmDoc,
      }),
    },
  };

  const authAudits = [];
  require.cache[authAuditPath] = {
    exports: {
      create: async (docs, options) => {
        authAudits.push({ docs, options });
      },
    },
  };

  const superadminAudits = [];
  require.cache[superadminAuditPath] = {
    exports: {
      create: async (docs, options) => {
        superadminAudits.push({ docs, options });
      },
    },
  };

  const { activateFirm } = require('../src/controllers/superadmin.controller');
  return { activateFirm, authAudits, superadminAudits, getSessionStats: () => ({ ended, withTransactionCalls }) };
};

async function testActivateFirmRunsTransactionalAudits() {
  const firm = {
    _id: 'firm-1',
    firmId: 'FIRM001',
    name: 'Firm One',
    status: 'suspended',
    async save(options) {
      assert(options && options.session, 'save should receive transaction session');
    },
  };
  const { activateFirm, authAudits, superadminAudits, getSessionStats } = loadControllerWithMocks({ firmDoc: firm });
  const req = {
    params: { id: 'firm-1' },
    originalUrl: '/api/superadmin/firms/firm-1/activate',
    user: { _id: '507f1f77bcf86cd799439011', xID: 'SUPERADMIN', email: 'superadmin@test.com' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  };
  const res = createRes();
  let nextError = null;

  await activateFirm(req, res, (err) => { nextError = err; });

  assert.strictEqual(nextError, null, 'next should not receive an error');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.message, 'Firm activated successfully');
  assert.strictEqual(firm.status, 'active');
  assert.strictEqual(authAudits.length, 1, 'Auth audit should be created in transaction');
  assert.strictEqual(superadminAudits.length, 1, 'Superadmin audit should be created in transaction');
  const sessionStats = getSessionStats();
  assert.strictEqual(sessionStats.withTransactionCalls, 1, 'withTransaction should be used once');
  assert.strictEqual(sessionStats.ended, 1, 'session should be ended once');
}

async function testActivateFirmPropagatesValidationErrors() {
  const firm = {
    _id: 'firm-2',
    firmId: 'FIRM002',
    name: 'Firm Two',
    status: 'active',
    async save() {},
  };
  const { activateFirm, getSessionStats } = loadControllerWithMocks({ firmDoc: firm });
  const req = {
    params: { id: 'firm-2' },
    originalUrl: '/api/superadmin/firms/firm-2/activate',
    user: { _id: '507f1f77bcf86cd799439011', xID: 'SUPERADMIN', email: 'superadmin@test.com' },
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
  };
  const res = createRes();
  let nextError = null;

  await activateFirm(req, res, (err) => { nextError = err; });

  assert(nextError instanceof Error, 'next should receive an error');
  assert.strictEqual(nextError.statusCode, 400);
  assert.strictEqual(nextError.message, 'Firm must be INACTIVE (suspended) to activate');
  const sessionStats = getSessionStats();
  assert.strictEqual(sessionStats.ended, 1, 'session should be ended even on error');
}

async function main() {
  await testActivateFirmRunsTransactionalAudits();
  await testActivateFirmPropagatesValidationErrors();
  console.log('activateFirm.transaction.test.js passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
