#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const authMiddlewarePath = require.resolve('../src/middleware/auth.middleware');
const tenantIdentityServicePath = require.resolve('../src/services/tenantIdentity.service');
const leadModelPath = require.resolve('../src/models/Lead.model');
const formModelPath = require.resolve('../src/models/Form.model');
const caseModelPath = require.resolve('../src/models/Case.model');
const userModelPath = require.resolve('../src/models/User.model');
const createAppModulePath = require.resolve('../src/app/createApp');
const bcryptModulePath = require.resolve('bcrypt');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });

  swap(authMiddlewarePath, {
    authenticate: (req, res, next) => {
      if (req.headers['x-test-no-firm'] === '1') {
        req.user = { role: 'ADMIN' };
        req.jwt = {};
        return next();
      }
      req.user = { role: 'ADMIN', firmId: '507f1f77bcf86cd799439011' };
      req.jwt = { firmId: '507f1f77bcf86cd799439011' };
      req.authTenantContext = { tenantId: '507f1f77bcf86cd799439011', status: 'active', firmSlug: 'acme', ownershipFirmId: '507f1f77bcf86cd799439099' };
      return next();
    },
  });

  swap(tenantIdentityServicePath, {
    resolveCanonicalTenantFromFirmId: async (firmId) => ({
      tenantId: String(firmId),
      status: 'active',
      firmSlug: 'acme',
      ownershipFirmId: '507f1f77bcf86cd799439099',
    }),
    resolveTenantBySlug: async () => null,
  });

  swap(leadModelPath, { find: () => ({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) }) });
  swap(userModelPath, { find: () => ({ select: () => ({ lean: async () => [] }) }) });
  swap(caseModelPath, { aggregate: async () => [] });
  swap(formModelPath, { find: () => ({ sort: () => ({ lean: async () => [] }) }) });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const leadsRes = await request(app).get('/api/leads?limit=100');
  assert.strictEqual(leadsRes.status, 200);
  assert.strictEqual(leadsRes.body.success, true);
  assert.deepStrictEqual(leadsRes.body.data, []);
  assert.notStrictEqual(leadsRes.body.code, 'FIRM_RESOLUTION_FAILED');

  const formsRes = await request(app).get('/api/forms');
  assert.strictEqual(formsRes.status, 200);
  assert.strictEqual(formsRes.body.success, true);
  assert.deepStrictEqual(formsRes.body.data, []);
  assert.notStrictEqual(formsRes.body.code, 'FIRM_RESOLUTION_FAILED');

  const noFirmRes = await request(app).get('/api/leads?limit=100').set('x-test-no-firm', '1');
  assert.ok([400, 401, 403].includes(noFirmRes.status), 'Missing firm context should fail closed');

  console.log('knowledgeIntake.routeContract.test.js passed');
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
