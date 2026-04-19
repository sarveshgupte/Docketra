#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
let capturedParams = null;

Module._load = function mockLoad(request, parent, isMain) {
  if (request === '../services/onboardingAnalytics.service') {
    return {
      getOnboardingInsights: async () => ({}),
      getOnboardingInsightDetails: async (params) => {
        capturedParams = params;
        return { firms: [], users: [], totals: {} };
      },
    };
  }
  if (request === 'bcrypt') {
    return { compare: async () => true, hash: async () => 'hash' };
  }
  if (request === '../utils/log') {
    return { error: () => {}, warn: () => {}, info: () => {} };
  }
  return originalLoad.apply(this, arguments);
};

async function run() {
  const controller = require('../src/controllers/superadmin.controller');
  const req = {
    query: {
      firmId: '507f1f77bcf86cd799439011',
      staleAfterDays: '14',
      completionState: 'incomplete',
    },
  };

  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await controller.getOnboardingInsightDetails(req, res);

  assert.strictEqual(statusCode, 200, 'request should succeed for valid firm filter');
  assert.ok(capturedParams, 'controller should pass params to onboarding analytics service');
  assert.strictEqual(capturedParams.firmId, '507f1f77bcf86cd799439011', 'controller should forward firmId filter');
  assert.strictEqual(capturedParams.staleAfterDays, 14, 'controller should parse staleAfterDays as number');
  assert.strictEqual(capturedParams.completionState, 'incomplete', 'controller should preserve completionState filter');
  assert.strictEqual(res.payload.success, true, 'controller should return successful response envelope');

  console.log('superadminOnboardingFirmDetail.controller.test.js passed');
  process.exit(0);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
