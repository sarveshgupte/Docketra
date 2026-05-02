#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const platformSource = fs.readFileSync(path.join(__dirname, '../src/app/routes/mountPlatformRoutes.js'), 'utf8');
const iAuth = platformSource.indexOf("['/api/auth', '/auth']");
const iPublic = platformSource.indexOf("app.use('/api/public'");
const iSuperadmin = platformSource.indexOf("['/api/sa', '/api/superadmin', '/superadmin']");
const iAdmin = platformSource.indexOf("app.use('/api/admin'");
const iTenantSlug = platformSource.indexOf("app.use('/api/:firmSlug', firmSlugGuard, firmRoutes)");

assert.ok(iTenantSlug > -1, 'tenant slug mount must exist');
for (const [name, idx] of Object.entries({ iAuth, iPublic, iSuperadmin, iAdmin })) {
  assert.ok(idx > -1, `${name} mount must exist`);
  assert.ok(idx < iTenantSlug, `${name} must be mounted before /api/:firmSlug`);
}

const { RESERVED_FIRM_SLUGS } = require('../src/middleware/firmSlugGuard.middleware');
for (const slug of ['users', 'auth', 'public', 'superadmin', 'admin', 'sa']) {
  assert.ok(RESERVED_FIRM_SLUGS.includes(slug), `RESERVED_FIRM_SLUGS must include ${slug}`);
}

const tenantResolverModulePath = require.resolve('../src/middleware/tenantResolver');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const createAppModulePath = require.resolve('../src/app/createApp');
const bcryptModulePath = require.resolve('bcrypt');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

(async () => {
  let tenantResolverCalls = 0;
  swap(bcryptModulePath, { hash: async () => 'mock-hash', compare: async () => true, genSalt: async () => 'mock-salt' });
  swap(tenantResolverModulePath, (req, _res, next) => {
    tenantResolverCalls += 1;
    req.firmId = '507f1f77bcf86cd799439022';
    req.firmIdString = 'FIRM001';
    req.firmSlug = req.params.firmSlug;
    req.firmName = 'Acme';
    req.firm = { status: 'active', firmSlug: req.params.firmSlug };
    next();
  });

  const noOpHandler = (_req, res) => res.status(501).json({ success: false, message: 'mocked' });
  swap(authControllerModulePath, new Proxy({}, { get: () => noOpHandler }));

  delete require.cache[createAppModulePath];
  const { createApp } = require('../src/app/createApp');
  const app = createApp();

  const beforeUsers = tenantResolverCalls;
  await request(app).get('/api/users');
  assert.strictEqual(tenantResolverCalls, beforeUsers, '/api/users must not be handled as /api/:firmSlug');

  console.log('routeMountOrderContract.test.js passed');
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
