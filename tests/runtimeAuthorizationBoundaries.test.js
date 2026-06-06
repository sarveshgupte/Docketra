#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const express = require('express');
const request = require('supertest');

const { mountPlatformRoutes } = require('../src/app/routes/mountPlatformRoutes');
const { mountTenantRoutes } = require('../src/app/routes/mountTenantRoutes');
const invariantGuard = require('../src/middleware/invariantGuard');
const requireTenant = require('../src/middleware/requireTenant');

const identityAuth = (req, res, next) => {
  const identity = String(req.headers['x-test-identity'] || 'none').toLowerCase();
  if (identity === 'none') {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (identity === 'superadmin') {
    req.user = { _id: 'superadmin-id', role: 'SuperAdmin', firmId: null };
    req.jwt = { userId: 'superadmin-id', role: 'SuperAdmin', firmId: null, isSuperAdmin: true };
    req.isSuperAdmin = true;
    return next();
  }

  const role = identity === 'firmadmin' ? 'PRIMARY_ADMIN' : 'USER';
  req.user = { _id: `${identity}-id`, role, firmId: '507f1f77bcf86cd799439011' };
  req.jwt = { userId: `${identity}-id`, role, firmId: '507f1f77bcf86cd799439011', isSuperAdmin: false };
  req.isSuperAdmin = false;
  return next();
};

const stubFirmContext = (req, _res, next) => {
  if (req.user?.firmId) {
    req.firmId = req.user.firmId;
    req.firm = { id: req.user.firmId, _id: req.user.firmId, firmSlug: 'acme' };
    req.tenant = { id: req.user.firmId };
  }
  next();
};

const pass = (_req, _res, next) => next();

function buildPlatformApp({ tenantResolver }) {
  const app = express();
  const superadminRouter = express.Router();
  superadminRouter.use((req, res, next) => {
    if (!req.user || req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Superadmin access required' });
    }
    return next();
  });
  superadminRouter.get('/stats', (_req, res) => res.status(200).json({ success: true }));

  const authRouter = express.Router();
  authRouter.get('/profile', (_req, res) => res.status(200).json({ success: true }));
  const publicRouter = express.Router();
  publicRouter.get('/firm/acme', (_req, res) => res.status(200).json({ success: true }));
  const adminRouter = express.Router();
  adminRouter.get('/stats', (_req, res) => res.status(200).json({ success: true }));

  mountPlatformRoutes(app, {
    isProduction: false,
    writeGuardChain: pass,
    authRoutes: authRouter,
    publicRoutes: publicRouter,
    publicSignupRoutes: express.Router(),
    contactRoutes: express.Router(),
    categoryRoutes: express.Router(),
    workTypeRoutes: express.Router(),
    adminRoutes: adminRouter,
    dashboardRoutes: express.Router(),
    slaRoutes: express.Router(),
    superadminRoutes: superadminRouter,
    firmRoutes: express.Router(),
    securityRoutes: express.Router(),
    tenantScopedApiAccess: [identityAuth, stubFirmContext, requireTenant, pass, invariantGuard({ requireFirm: true, forbidSuperAdmin: true })],
    adminTenantScopedApiAccess: [identityAuth, stubFirmContext, requireTenant, pass, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), pass],
    loginLimiter: pass,
    publicLimiter: pass,
    contactLimiter: pass,
    superadminLimiter: pass,
    authenticate: identityAuth,
    noFirmNoTransaction: pass,
    tenantResolver,
    login: (_req, res) => res.status(200).json({ success: true }),
    firmSlugGuard: pass,
    adminAuditTrail: () => pass,
    log: { info: () => {} },
    RESERVED_FIRM_SLUGS: ['auth', 'public', 'superadmin', 'sa', 'admin'],
    requireTenant,
    invariantGuard,
    requireAdmin: pass,
    firmContext: stubFirmContext,
  });

  return app;
}

function buildTenantApp() {
  const app = express();
  const taskRouter = express.Router();
  taskRouter.get('/guard-probe', (_req, res) => res.status(200).json({ success: true }));

  mountTenantRoutes(app, {
    writeGuardChain: pass,
    authenticate: identityAuth,
    firmContext: stubFirmContext,
    requireTenant,
    tenantThrottle: pass,
    invariantGuard,
    authLimiter: pass,
    tenantScopedApiAccess: [identityAuth, stubFirmContext, requireTenant, pass, invariantGuard({ requireFirm: true, forbidSuperAdmin: true })],
    adminTenantScopedApiAccess: [identityAuth, stubFirmContext, requireTenant, pass, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), pass],
    adminAuditTrail: () => pass,
    userRoutes: express.Router(), selfUserRoutes: express.Router(), taskRoutes: taskRouter, complianceCalendarRoutes: express.Router(), caseRoutes: express.Router(), docketRoutes: express.Router(), docketSessionRoutes: express.Router(), attachmentRoutes: express.Router(), searchRoutes: express.Router(), clientApprovalRoutes: express.Router(), clientRoutes: express.Router(), crmClientRoutes: express.Router(), leadRoutes: express.Router(), formRoutes: express.Router(), landingPageRoutes: express.Router(), dealRoutes: express.Router(), invoiceRoutes: express.Router(), reportsRoutes: express.Router(), insightsRoutes: express.Router(), firmMetricsRoutes: express.Router(), storageRoutes: express.Router(), aiRoutes: express.Router(), firmStorageRoutes: express.Router(), filesRoutes: express.Router(), tenantRoutes: express.Router(), docketFileStorageRoutes: express.Router(), notificationsRoutes: express.Router(), teamRoutes: express.Router(), bulkUploadRoutes: express.Router(), productUpdateRoutes: express.Router(), settingsRoutes: express.Router(), knowledgeItemRoutes: express.Router(),
  });

  return app;
}

(async () => {
  let tenantResolverCalls = 0;
  const tenantResolver = (_req, _res, next) => {
    tenantResolverCalls += 1;
    next();
  };

  const platformApp = buildPlatformApp({ tenantResolver });

  await request(platformApp).get('/api/superadmin/stats').expect(401);
  await request(platformApp).get('/api/superadmin/stats').set('x-test-identity', 'user').expect(403);
  await request(platformApp).get('/api/superadmin/stats').set('x-test-identity', 'firmadmin').expect(403);
  await request(platformApp).get('/api/superadmin/stats').set('x-test-identity', 'superadmin').expect(200);

  await request(platformApp).get('/api/sa/stats').set('x-test-identity', 'user').expect(403);
  await request(platformApp).get('/superadmin/stats').set('x-test-identity', 'user').expect(403);

  const tenantApp = buildTenantApp();
  await request(tenantApp).get('/api/tasks/guard-probe').set('x-test-identity', 'superadmin').expect(400);
  await request(tenantApp).get('/api/tasks/guard-probe').expect(401);
  await request(tenantApp).get('/api/tasks/guard-probe').set('x-test-identity', 'user').expect(200);

  const before = tenantResolverCalls;
  await request(platformApp).post('/api/superadmin/login').send({ email: 'sa@example.com', password: 'x' }).expect(200);
  await request(platformApp).get('/api/auth/profile').set('x-test-identity', 'user').expect(200);
  await request(platformApp).get('/api/public/firm/acme').expect(200);
  await request(platformApp).get('/api/admin/stats').set('x-test-identity', 'firmadmin').expect(200);
  assert.strictEqual(tenantResolverCalls, before, 'reserved namespaces must not call tenantResolver');

  console.log('runtimeAuthorizationBoundaries.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
