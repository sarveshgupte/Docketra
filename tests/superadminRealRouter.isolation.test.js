#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const superadminRoutesModulePath = require.resolve('../src/routes/superadmin.routes');
const superadminControllerModulePath = require.resolve('../src/controllers/superadmin.controller');
const rateLimitersModulePath = require.resolve('../src/middleware/rateLimiters');
const superadminPolicyModulePath = require.resolve('../src/policies/superadmin.policy');
const firmPolicyModulePath = require.resolve('../src/policies/firm.policy');

const restore = [];
const swap = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

const makeNoopMiddleware = () => (_req, _res, next) => next();

(async () => {
  const controllerCalls = {
    stats: 0,
    firms: 0,
    switchFirm: 0,
  };

  const ok = (key) => (_req, res) => {
    controllerCalls[key] += 1;
    return res.status(200).json({ success: true, key });
  };

  swap(rateLimitersModulePath, {
    superadminLimiter: makeNoopMiddleware(),
    superadminAdminResendLimiter: makeNoopMiddleware(),
    superadminAdminLifecycleLimiter: makeNoopMiddleware(),
    superadminAdminManagementLimiter: makeNoopMiddleware(),
  });

  swap(superadminPolicyModulePath, {
    canViewPlatformStats: () => true,
    canManageFirms: () => true,
  });

  swap(firmPolicyModulePath, {
    canCreate: () => true,
    canView: () => true,
    canManageStatus: () => true,
    canCreateAdmin: () => true,
    canResendAdminAccess: () => true,
  });

  swap(superadminControllerModulePath, new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'getPlatformStats') return ok('stats');
      if (prop === 'listFirms') return ok('firms');
      if (prop === 'switchFirm') return ok('switchFirm');
      return (_req, res) => res.status(200).json({ success: true, route: String(prop) });
    },
  }));

  delete require.cache[superadminRoutesModulePath];
  const superadminRouter = require('../src/routes/superadmin.routes');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.headers['x-role'];
    if (role) req.user = { role };
    next();
  });
  app.use('/api/superadmin', superadminRouter);

  const unauthStats = await request(app).get('/api/superadmin/stats');
  assert.strictEqual(unauthStats.status, 403, 'unauthenticated request must be denied by requireSuperadmin');

  const firmUserStats = await request(app).get('/api/superadmin/stats').set('x-role', 'USER');
  assert.strictEqual(firmUserStats.status, 403, 'firm user request must be denied');

  const firmAdminStats = await request(app).get('/api/superadmin/stats').set('x-role', 'ADMIN');
  assert.strictEqual(firmAdminStats.status, 403, 'firm admin request must be denied');

  const primaryAdminStats = await request(app).get('/api/superadmin/stats').set('x-role', 'PRIMARY_ADMIN');
  assert.strictEqual(primaryAdminStats.status, 403, 'primary admin request must be denied');

  assert.strictEqual(controllerCalls.stats, 0, 'rejected identities must not reach /stats controller');

  const superadminStats = await request(app).get('/api/superadmin/stats').set('x-role', 'SUPER_ADMIN');
  assert.strictEqual(superadminStats.status, 200, 'superadmin must access /stats');
  assert.strictEqual(controllerCalls.stats, 1, 'superadmin /stats should hit controller exactly once');

  const superadminFirms = await request(app).get('/api/superadmin/firms').set('x-role', 'SUPER_ADMIN');
  assert.strictEqual(superadminFirms.status, 200, 'superadmin must access /firms');
  assert.strictEqual(controllerCalls.firms, 1, 'superadmin /firms should hit controller exactly once');

  const rejectedMutation = await request(app).post('/api/superadmin/switch-firm').set('x-role', 'ADMIN').send({ firmId: '507f1f77bcf86cd799439011' });
  assert.strictEqual(rejectedMutation.status, 403, 'firm admin must be denied for mutation route');

  const superadminMutation = await request(app).post('/api/superadmin/switch-firm').set('x-role', 'SUPER_ADMIN').send({ firmId: '507f1f77bcf86cd799439011' });
  assert.strictEqual(superadminMutation.status, 200, 'superadmin must access mutation route');
  assert.strictEqual(controllerCalls.switchFirm, 1, 'only accepted mutation should hit controller');

  console.log('superadminRealRouter.isolation.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  delete require.cache[superadminRoutesModulePath];
});
