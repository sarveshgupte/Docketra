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
const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
const authMiddlewareModulePath = require.resolve('../src/middleware/auth.middleware');
const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
const rateLimitersModulePath = require.resolve('../src/middleware/rateLimiters');
const clientControllerModulePath = require.resolve('../src/controllers/client.controller');
const bcryptModulePath = require.resolve('bcrypt');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const firmControllerModulePath = require.resolve('../src/controllers/firm.controller');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

const restoreSwaps = () => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[createAppModulePath];
};

(async () => {
  const noOp = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  const pass = (_req, _res, next) => next();
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });
  swap(authControllerModulePath, new Proxy({}, { get: () => noOp }));
  swap(firmControllerModulePath, { getFirmSetupStatus: noOp });
  const baseRouteGroups = require(routeGroupsModulePath);
  swap(routeGroupsModulePath, {
    ...baseRouteGroups,
    tenantScopedApiAccess: [pass, pass, pass],
    adminTenantScopedApiAccess: [pass, pass, pass],
  });
  swap(authMiddlewareModulePath, { authenticate: pass });

  const basePermission = require(permissionMiddlewareModulePath);
  swap(permissionMiddlewareModulePath, {
    ...basePermission,
    authorizeFirmPermission: () => pass,
  });

  const baseLimiters = require(rateLimitersModulePath);
  swap(rateLimitersModulePath, {
    ...baseLimiters,
    userReadLimiter: pass,
    userWriteLimiter: pass,
    attachmentLimiter: pass,
    sensitiveLimiter: pass,
  });

  swap(clientControllerModulePath, {
    getClients: (req, res) => res.status(200).json({ success: true, data: [], clients: [], pagination: { page: 1, limit: 25, total: 0, pages: 1 }, route: req.baseUrl + req.path }),
    getClientById: noOp,
    createClient: noOp,
    updateClient: noOp,
    toggleClientStatus: noOp,
    changeLegalName: noOp,
    updateClientFactSheet: noOp,
    uploadFactSheetFile: noOp,
    createClientCFSUploadIntent: noOp,
    finalizeClientCFSUpload: noOp,
    deleteFactSheetFile: noOp,
    uploadClientCFSFile: noOp,
    listClientCFSFiles: noOp,
    deleteClientCFSFile: noOp,
    downloadClientCFSFile: noOp,
    listClientDockets: noOp,
    listClientCfsComments: noOp,
    addClientCfsComment: noOp,
    listClientActivity: noOp,
  });

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const response = await request(app)
    .get('/api/clients?activeOnly=false&page=1&limit=25')
    .set('Authorization', 'Bearer test-token');

  assert.strictEqual(response.status, 200, 'GET /api/clients should be mounted and non-404 in createApp');
  assert.deepStrictEqual(response.body.pagination, { page: 1, limit: 25, total: 0, pages: 1 });
  assert.strictEqual(response.body.route, '/api/clients/');

  console.log('clientsEndpoint.createAppRouteContract.test.js passed');
  restoreSwaps();
  process.exit(0);
})().catch((error) => {
  restoreSwaps();
  console.error(error);
  process.exit(1);
});
