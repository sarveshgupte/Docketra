#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const createAppModulePath = require.resolve('../src/app/createApp');
const routeGroupsPath = require.resolve('../src/routes/routeGroups');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const firmControllerModulePath = require.resolve('../src/controllers/firm.controller');
const bcryptModulePath = require.resolve('bcrypt');
const authorizationServicePath = require.resolve('../src/services/authorization.service');
const tenantMetricsServicePath = require.resolve('../src/services/tenantCaseMetrics.service');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  const accessMiddleware = (req, _res, next) => {
    req.user = { role: req.headers['x-test-role'] || 'ADMIN', firmId: 'FIRM001', xID: 'X123' };
    req.firmId = 'FIRM001';
    req.firm = { id: 'FIRM001', firmId: 'FIRM001', status: 'active' };
    next();
  };

  swap(routeGroupsPath, {
    firmAuthenticatedAccess: [accessMiddleware],
    firmReadAccess: [accessMiddleware],
    firmWriteAccess: [accessMiddleware],
    firmSensitiveAccess: [accessMiddleware],
    adminBaseAccess: [accessMiddleware],
    tenantScopedApiAccess: [accessMiddleware],
    adminTenantScopedApiAccess: [accessMiddleware],
  });
  swap(authorizationServicePath, {
    resolveRequestFirmRole: async () => ({ role: 'ADMIN', permissions: ['REPORT_VIEW'] }),
  });
  swap(tenantMetricsServicePath, {
    getLatestTenantMetrics: async () => null,
    getTenantMetricsByRange: async () => ({ aggregate: {}, range: {}, rowsCount: 0 }),
  });

  const noOpHandler = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  swap(authControllerModulePath, new Proxy({}, { get: () => noOpHandler }));
  swap(firmControllerModulePath, { getFirmSetupStatus: noOpHandler });
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  for (const role of ['PRIMARY_ADMIN', 'ADMIN']) {
    const res = await request(app).get('/api/reports/case-metrics').set('x-test-role', role);
    assert.notStrictEqual(res.status, 404, `${role} should not hit route-level 404`);
    assert.strictEqual(res.status, 200, `${role} should receive 200`);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.totalCases, 0);
    assert.deepStrictEqual(res.body?.data?.byStatus, { OPEN: 0, PENDING: 0, FILED: 0, RESOLVED: 0 });
    assert.deepStrictEqual(res.body?.data?.byClient, []);
    assert.deepStrictEqual(res.body?.data?.byEmployee, []);
    assert.deepStrictEqual(res.body?.data?.breakdowns, []);
    assert.deepStrictEqual(res.body?.data?.trends, []);
    assert.deepStrictEqual(res.body?.data?.tables, []);
  }

  console.log('reports.createApp.caseMetrics.contract.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[createAppModulePath];
});
