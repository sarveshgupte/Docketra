#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const actualMongoose = require('mongoose');
const originalStartSession = actualMongoose.startSession;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore
  }
};

const mockResponse = () => {
  const res = { statusCode: 200, body: null, headersSent: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => {
    res.body = payload;
    res.headersSent = true;
    return res;
  };
  return res;
};

async function run() {
  let xidCalls = 0;
  let tokenCalls = 0;
  let userSaveCalls = 0;
  let nextError = null;
  const savedSnapshots = [];
  actualMongoose.startSession = async () => ({
    withTransaction: async (handler) => {
      await handler();
      await handler();
    },
    endSession: async () => {},
  });

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      function MockUser(doc) {
        Object.assign(this, doc);
        this._id = `user-${userSaveCalls + 1}`;
      }
      MockUser.findOne = async () => null;
      MockUser.prototype.save = async function save() {
        userSaveCalls += 1;
        savedSnapshots.push({
          xID: this.xID,
          inviteTokenHash: this.inviteTokenHash,
          inviteTokenExpiry: this.inviteTokenExpiry?.toISOString?.() || null,
        });
        return this;
      };
      return MockUser;
    }
    if (request === '../models/Firm.model') {
      return {
        findById: async () => ({
          _id: 'firm-1',
          firmSlug: 'acme',
          defaultClientId: null,
        }),
      };
    }
    if (request === '../services/email.service') {
      return {
        generateSecureToken: () => {
          tokenCalls += 1;
          return 'setup-token';
        },
        hashToken: () => 'token-hash',
        maskEmail: (email) => email,
        sendPasswordSetupEmail: async () => ({ success: true }),
      };
    }
    if (request === '../services/xIDGenerator') {
      return {
        generateNextXID: async () => {
          xidCalls += 1;
          return 'X000222';
        },
      };
    }
    if (request === '../services/user.service') {
      class PlanLimitExceededError extends Error {}
      class PlanAdminLimitExceededError extends Error {}
      class PrimaryAdminActionError extends Error {}
      return {
        assertFirmPlanCapacity: async () => {},
        PlanLimitExceededError,
        PlanAdminLimitExceededError,
        assertCanDeactivateUser: () => {},
        PrimaryAdminActionError,
      };
    }
    if (request === '../services/safeSideEffects.service') {
      return {
        safeAuditLog: async () => {},
        safeQueueEmail: async () => {},
        safeAnalyticsEvent: async () => {},
      };
    }
    if (request === '../services/tenantMetrics.service') {
      return { incrementTenantMetric: async () => {} };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return originalLoad.apply(this, arguments);
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { createUser } = require('../src/controllers/auth.controller');

  const req = {
    body: {
      name: 'Retry Safe User',
      email: 'retry@acme.com',
      role: 'Employee',
    },
    user: {
      xID: 'X000001',
      firmId: 'firm-1',
    },
    requestId: 'req-retry-1',
    ip: '127.0.0.1',
    get: () => 'agent',
    method: 'POST',
    originalUrl: '/api/admin/users',
  };
  const res = mockResponse();

  await createUser(req, res, (error) => { nextError = error; });

  assert.strictEqual(nextError, null);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.data.xID, 'X000222');
  assert.strictEqual(xidCalls, 1, 'xID generation should be reused across transaction retries');
  assert.strictEqual(tokenCalls, 1, 'invite token generation should be reused across transaction retries');
  assert.strictEqual(userSaveCalls, 2, 'controller may retry the DB save inside the transaction callback');
  assert.deepStrictEqual(savedSnapshots[0], savedSnapshots[1], 'retry attempts should reuse the same invite identity state');
  console.log('✓ admin invite flow reuses xID and token generation across transaction retries');

  actualMongoose.startSession = originalStartSession;
  Module._load = originalLoad;
}

run().catch((error) => {
  actualMongoose.startSession = originalStartSession;
  Module._load = originalLoad;
  console.error(error);
  process.exit(1);
});
