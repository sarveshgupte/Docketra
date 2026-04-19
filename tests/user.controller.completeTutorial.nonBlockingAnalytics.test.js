#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

let updateOneCalls = 0;
let analyticsCalls = 0;

Module._load = function (request, parent, isMain) {
  if (request === '../models/User.model') {
    return {
      updateOne: async () => {
        updateOneCalls += 1;
        return { acknowledged: true };
      },
    };
  }

  if (request === '../services/onboardingAnalytics.service') {
    return {
      createEvent: async () => {
        analyticsCalls += 1;
        throw new Error('analytics down');
      },
    };
  }

  if (
    request === 'mongoose'
    || request === '../models/Firm.model'
    || request === '../repositories/user.repository'
    || request === '../middleware/wrapWriteHandler'
    || request === '../services/user.service'
    || request === '../services/tenantMetrics.service'
    || request === '../services/securityAudit.service'
    || request === '../services/securityTelemetry.service'
    || request === '../services/jwt.service'
    || request === '../utils/firmSlug'
    || request === '../services/email/sendWelcomeEmail'
    || request === '../utils/role.utils'
    || request === '../utils/hierarchy.utils'
    || request === '../services/adminActionAudit.service'
    || request === '../services/settingsAudit.service'
  ) {
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    if (request === '../utils/role.utils') return { normalizeRole: (value) => value };
    if (request === '../utils/hierarchy.utils') return { assertPrimaryAdmin: () => undefined, getTagValidationError: () => null, normalizeId: (v) => v };
    if (request === 'mongoose') return { startSession: async () => ({ withTransaction: async (fn) => fn(), endSession: async () => undefined }) };
    return new Proxy({}, { get: () => () => undefined });
  }

  if (request === '../utils/log') {
    return { warn: () => undefined, error: () => undefined };
  }

  return originalLoad.apply(this, arguments);
};

const { completeTutorial } = require('../src/controllers/user.controller');

const createMockRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

async function run() {
  const req = {
    user: {
      _id: 'u1',
      xID: 'X100001',
      firmId: 'f1',
      role: 'ADMIN',
    },
    body: {
      status: 'completed',
      role: 'admin',
      stepIndex: 3,
    },
  };

  const res = createMockRes();
  await completeTutorial(req, res);

  assert.equal(updateOneCalls, 1, 'tutorial persistence should still happen');
  assert.equal(analyticsCalls, 1, 'analytics write should still be attempted');
  assert.equal(res.statusCode, 200, 'endpoint should stay successful when analytics fails');
  assert.equal(res.payload?.success, true);

  console.log('user.controller.completeTutorial.nonBlockingAnalytics.test.js passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
