#!/usr/bin/env node
'use strict';

const assert = require('assert');

const { allowInternalTokenOrSuperadmin } = require('../src/middleware/internalMetricsAccess.middleware');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function runMiddleware(req) {
  return new Promise((resolve) => {
    const res = makeRes();
    allowInternalTokenOrSuperadmin(req, res, () => resolve({ nextCalled: true, res }));
    setTimeout(() => resolve({ nextCalled: false, res }), 0);
  });
}

async function testProductionRequiresBearerToken() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMetricsToken = process.env.METRICS_TOKEN;

  process.env.NODE_ENV = 'production';
  process.env.METRICS_TOKEN = 'prod-secret-token';

  try {
    const denied = await runMiddleware({ headers: {}, method: 'GET', path: '/api/metrics/security' });
    assert.strictEqual(denied.nextCalled, false);
    assert.strictEqual(denied.res.statusCode, 401);

    const allowed = await runMiddleware({
      headers: { authorization: 'Bearer prod-secret-token' },
      method: 'GET',
      path: '/api/metrics/security',
    });
    assert.strictEqual(allowed.nextCalled, true);

    console.log('✓ production internal metrics endpoint requires bearer token');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.METRICS_TOKEN = originalMetricsToken;
  }
}

async function run() {
  await testProductionRequiresBearerToken();
  console.log('internalMetricsAccess regression tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
