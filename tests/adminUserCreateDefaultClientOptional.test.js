#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore
  }
};

const mockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

async function run() {
  let savedUser = null;

  Module._load = function (request, parent, isMain) {
    if (request === '../models/User.model') {
      function MockUser(doc) {
        Object.assign(this, doc);
        this._id = 'user-1';
      }
      MockUser.findOne = async () => null;
      MockUser.prototype.save = async function save() {
        savedUser = { ...this };
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
        generateSecureToken: () => 'setup-token',
        hashToken: () => 'token-hash',
        maskEmail: (email) => email,
        sendPasswordSetupEmail: async () => ({ success: true }),
      };
    }
    if (request === '../services/xIDGenerator') {
      return { generateNextXID: async () => 'X000123' };
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
        safeQueueEmail: async ({ execute }) => execute(),
      };
    }
    if (request === '../services/tenantMetrics.service') {
      return {
        incrementTenantMetric: async () => {},
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { createUser } = require('../src/controllers/auth.controller');

  const req = {
    body: {
      name: 'Jane Doe',
      email: 'jane@acme.com',
      role: 'Employee',
    },
    user: {
      xID: 'X000001',
      firmId: 'firm-1',
    },
    requestId: 'req-1',
    ip: '127.0.0.1',
    get: () => 'agent',
  };
  const res = mockResponse();

  await createUser(req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.xID, 'X000123');
  assert.strictEqual(savedUser.defaultClientId, undefined, 'defaultClientId should remain optional when firm default is missing');
  console.log('✓ admin user creation succeeds when firm.defaultClientId is missing');

  Module._load = originalLoad;
}

run().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exit(1);
});
