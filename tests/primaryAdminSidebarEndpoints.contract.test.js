#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const createAppModulePath = require.resolve('../src/app/createApp');
const authMiddlewareModulePath = require.resolve('../src/middleware/auth.middleware');
const firmModelModulePath = require.resolve('../src/models/Firm.model');
const clientRepositoryModulePath = require.resolve('../src/repositories/ClientRepository');
const defaultClientServiceModulePath = require.resolve('../src/services/defaultClient.service');
const tenantMetricsServiceModulePath = require.resolve('../src/services/tenantCaseMetrics.service');
const tenantIdentityModulePath = require.resolve('../src/services/tenantIdentity.service');
const bcryptModulePath = require.resolve('bcrypt');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const firmControllerModulePath = require.resolve('../src/controllers/firm.controller');
const firmRoutesModulePath = require.resolve('../src/routes/firm.routes');
const firmSlugGuardModulePath = require.resolve('../src/middleware/firmSlugGuard.middleware');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

const queryResult = (value) => ({
  select() { return this; },
  lean: async () => value,
});

(async () => {
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });
  const noOpHandler = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  swap(authControllerModulePath, new Proxy({}, { get: () => noOpHandler }));
  swap(firmControllerModulePath, { getFirmSetupStatus: noOpHandler });
  swap(firmRoutesModulePath, express.Router());
  swap(firmSlugGuardModulePath, {
    RESERVED_FIRM_SLUGS: [],
    FIRM_SLUG_PATTERN: /^[a-z0-9-]+$/,
    firmSlugGuard: (_req, _res, next) => next(),
  });

  const actor = {
    _id: '507f1f77bcf86cd799439011',
    role: 'PRIMARY_ADMIN',
    firmId: '507f1f77bcf86cd799439022',
    email: 'primary-admin@example.com',
  };

  swap(authMiddlewareModulePath, {
    authenticate: (req, _res, next) => { req.user = actor; req.firmId = actor.firmId; next(); },
  });

  swap(firmModelModulePath, {
    findById: () => queryResult({ _id: actor.firmId, name: 'Acme', storage: { mode: 'docketra_managed' }, storageConfig: null, settings: {} }),
  });

  swap(clientRepositoryModulePath, {
    find: async () => [],
    count: async () => 0,
  });

  swap(defaultClientServiceModulePath, { ensureDefaultClientForFirm: async () => null });
  swap(tenantMetricsServiceModulePath, {
    getLatestTenantMetrics: async () => null,
    getTenantMetricsByRange: async () => ({ aggregate: {}, range: null, rowsCount: 0 }),
  });
  swap(tenantIdentityModulePath, {
    resolveStorageContextFromTenantId: async () => null,
    resolveCanonicalTenantFromFirmId: async (firmId) => ({ tenantId: firmId, ownershipFirmId: firmId, status: 'active', firmSlug: 'acme' }),
  });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const clientsRes = await request(app).get('/api/clients').query({ activeOnly: 'false', page: '1', limit: '25' });
  assert.strictEqual(clientsRes.status, 200);
  assert.deepStrictEqual(clientsRes.body.data, []);
  assert.deepStrictEqual(clientsRes.body.clients, []);
  assert.strictEqual(clientsRes.body.pagination.page, 1);
  assert.strictEqual(clientsRes.body.pagination.limit, 25);
  assert.strictEqual(clientsRes.body.pagination.total, 0);

  const reportsRes = await request(app).get('/api/reports/case-metrics');
  assert.strictEqual(reportsRes.status, 200);
  assert.strictEqual(reportsRes.body.success, true);
  assert.strictEqual(reportsRes.body.data.totalCases, 0);
  assert.deepStrictEqual(reportsRes.body.data.byClient, []);

  const storageRes = await request(app).get('/api/storage/configuration');
  assert.strictEqual(storageRes.status, 200);
  assert.strictEqual(storageRes.body.provider, 'docketra_managed');
  assert.ok(!Object.prototype.hasOwnProperty.call(storageRes.body, 'credentials'));
  assert.ok(!JSON.stringify(storageRes.body).toLowerCase().includes('refresh_token'));

  const aiRes = await request(app).get('/api/ai/configuration');
  assert.strictEqual(aiRes.status, 200);
  assert.strictEqual(aiRes.body.success, true);
  assert.ok(aiRes.body.configuration);
  assert.ok(!JSON.stringify(aiRes.body).toLowerCase().includes('api_key'));
  assert.ok(!JSON.stringify(aiRes.body).toLowerCase().includes('apikey'));

  console.log('primaryAdminSidebarEndpoints.contract.test.js passed');
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
