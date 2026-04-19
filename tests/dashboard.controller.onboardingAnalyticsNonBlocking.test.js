#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

let analyticsCalls = 0;

Module._load = function (request, parent, isMain) {
  if (request === '../utils/tenantGuard') {
    return {
      assertFirmContext: () => undefined,
    };
  }

  if (request === '../services/dashboard.service') {
    return {};
  }

  if (request === '../config/redis') {
    return { getRedisClient: () => null };
  }

  if (request === '../utils/log') {
    return { warn: () => undefined, error: () => undefined };
  }

  if (request === '../services/onboardingProgress.service') {
    return {
      getOnboardingProgress: async () => ({ role: 'ADMIN', completed: 1, total: 2, steps: [{ id: 'active-client', completed: true }] }),
    };
  }

  if (request === '../services/onboardingAnalytics.service') {
    return {
      recordProgressIfChanged: async () => {
        analyticsCalls += 1;
        throw new Error('analytics write failed');
      },
      createEvent: async () => undefined,
    };
  }

  return originalLoad.apply(this, arguments);
};

const { getOnboardingProgress } = require('../src/controllers/dashboard.controller');

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
  };
  const res = createMockRes();

  await getOnboardingProgress(req, res);

  assert.equal(analyticsCalls, 1, 'analytics should still be attempted');
  assert.equal(res.statusCode, 200, 'onboarding progress should still succeed when analytics fails');
  assert.equal(res.payload?.success, true);
  assert.equal(res.payload?.data?.role, 'ADMIN');

  console.log('dashboard.controller.onboardingAnalyticsNonBlocking.test.js passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
