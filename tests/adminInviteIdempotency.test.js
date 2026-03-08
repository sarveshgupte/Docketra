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

const createMockRes = () => {
  const res = { statusCode: 200, body: null, headersSent: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => {
    res.body = payload;
    res.headersSent = true;
    return res;
  };
  return res;
};

const makeInviteRequest = () => ({
  body: {
    name: 'Retry Safe User',
    email: 'retry@acme.com',
    role: 'Employee',
  },
  user: {
    xID: 'X000001',
    firmId: 'firm-1',
  },
  requestId: 'req-invite-1',
  ip: '127.0.0.1',
  get: () => 'agent',
  method: 'POST',
  originalUrl: '/api/admin/users',
});

async function testExistingInvitedUserReuseSkipsEmail() {
  let xidCalls = 0;
  let tokenCalls = 0;
  let emailCalls = 0;
  let saveCalls = 0;

  const existingUser = {
    _id: 'user-1',
    xID: 'X000222',
    name: 'Retry Safe User',
    email: 'retry@acme.com',
    role: 'Employee',
    allowedCategories: [],
    passwordSet: false,
    status: 'invited',
    inviteSentAt: new Date('2026-03-08T10:00:00.000Z'),
    inviteTokenExpiry: new Date('2026-03-10T10:00:00.000Z'),
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      function MockUser(doc) {
        Object.assign(this, doc);
      }
      MockUser.findOne = async () => existingUser;
      MockUser.prototype.save = async function save() {
        saveCalls += 1;
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
        sendPasswordSetupEmail: async () => {
          emailCalls += 1;
          return { success: true };
        },
      };
    }
    if (request === '../services/xIDGenerator') {
      return {
        generateNextXID: async () => {
          xidCalls += 1;
          return 'X999999';
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
        safeQueueEmail: async ({ execute }) => execute(),
        safeAnalyticsEvent: async ({ execute }) => execute(),
      };
    }
    if (request === '../services/tenantMetrics.service') {
      return { incrementTenantMetric: async () => {} };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { createUser } = require('../src/controllers/auth.controller');

  const result = await createUser(makeInviteRequest(), createMockRes());

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.xID, 'X000222');
  assert.strictEqual(result.message, 'User already invited. Existing invite remains active.');
  assert.strictEqual(xidCalls, 0, 'xID generation should be skipped when the invited user already exists');
  assert.strictEqual(tokenCalls, 0, 'token generation should be skipped when the invite was already sent');
  assert.strictEqual(emailCalls, 0, 'email should not be re-sent when inviteSentAt is already set');
  assert.strictEqual(saveCalls, 0, 'existing invited user should not be rewritten when invite is already active');
}

async function testDuplicateKeyFallsBackToExistingInvitedUser() {
  let emailCalls = 0;
  let findOneCalls = 0;

  const existingUser = {
    _id: 'user-2',
    xID: 'X000333',
    name: 'Retry Safe User',
    email: 'retry@acme.com',
    role: 'Employee',
    allowedCategories: [],
    passwordSet: false,
    status: 'invited',
    inviteSentAt: new Date('2026-03-08T10:00:00.000Z'),
    inviteTokenExpiry: new Date('2026-03-10T10:00:00.000Z'),
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      function MockUser(doc) {
        Object.assign(this, doc);
      }
      MockUser.findOne = async () => {
        findOneCalls += 1;
        return findOneCalls === 1 ? null : existingUser;
      };
      MockUser.prototype.save = async function save() {
        const error = new Error('duplicate key');
        error.code = 11000;
        error.keyPattern = { firmId: 1, email: 1 };
        throw error;
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
        sendPasswordSetupEmail: async () => {
          emailCalls += 1;
          return { success: true };
        },
      };
    }
    if (request === '../services/xIDGenerator') {
      return { generateNextXID: async () => 'X000999' };
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
        safeAnalyticsEvent: async ({ execute }) => execute(),
      };
    }
    if (request === '../services/tenantMetrics.service') {
      return { incrementTenantMetric: async () => {} };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { createUser } = require('../src/controllers/auth.controller');

  const result = await createUser(makeInviteRequest(), createMockRes());

  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.xID, 'X000333');
  assert.strictEqual(result.message, 'User already invited. Existing invite remains active.');
  assert.strictEqual(emailCalls, 0, 'email should not be queued again after duplicate-key recovery');
}

async function testResendInviteRequiresInvitedStatus() {
  let saveCalls = 0;
  let emailCalls = 0;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => ({
          _id: 'user-3',
          xID: 'X000444',
          name: 'Invited User',
          email: 'retry@acme.com',
          firmId: 'firm-1',
          status: 'active',
          mustSetPassword: true,
          passwordHash: null,
          save: async () => {
            saveCalls += 1;
          },
        }),
      };
    }
    if (request === '../models/Firm.model') {
      return {
        findById: async () => ({ firmSlug: 'acme' }),
      };
    }
    if (request === '../services/email.service') {
      return {
        generateSecureToken: () => 'setup-token',
        hashToken: () => 'token-hash',
        maskEmail: (email) => email,
        sendPasswordSetupReminderEmail: async () => {
          emailCalls += 1;
          return { success: true };
        },
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/admin.controller');
  const { resendInviteEmail } = require('../src/controllers/admin.controller');

  const req = {
    params: { xID: 'X000444' },
    user: { xID: 'X000001', firmId: 'firm-1' },
    requestId: 'req-resend-1',
    ip: '127.0.0.1',
    get: () => 'agent',
  };
  const res = createMockRes();

  await resendInviteEmail(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(emailCalls, 0, 'resend should not send email when status is not invited');
  assert.strictEqual(saveCalls, 0, 'resend should not update the user when status is not invited');
}

async function run() {
  try {
    await testExistingInvitedUserReuseSkipsEmail();
    await testDuplicateKeyFallsBackToExistingInvitedUser();
    await testResendInviteRequiresInvitedStatus();
    console.log('✓ admin invite flow is idempotent for existing invites and duplicate-key races');
  } finally {
    Module._load = originalLoad;
    clearModule('../src/controllers/auth.controller');
    clearModule('../src/controllers/admin.controller');
  }
}

run().catch((error) => {
  Module._load = originalLoad;
  clearModule('../src/controllers/auth.controller');
  clearModule('../src/controllers/admin.controller');
  console.error(error);
  process.exit(1);
});
