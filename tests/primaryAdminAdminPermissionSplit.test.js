#!/usr/bin/env node
const assert = require('assert');
const request = require('supertest');
const express = require('express');

const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const adminControllerModulePath = require.resolve('../src/controllers/admin.controller');
const workbasketControllerModulePath = require.resolve('../src/controllers/workbasket.controller');
const storageControllerModulePath = require.resolve('../src/controllers/storage.controller');
const aiControllerModulePath = require.resolve('../src/controllers/ai.controller');

const restore = [];
const swapModule = (modulePath, exportsValue) => { restore.push({ modulePath, original: require.cache[modulePath] }); delete require.cache[modulePath]; require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue }; };

(async () => {
  const authGate = (req, res, next) => {
    req.user = { role: String(req.headers['x-test-role'] || 'PRIMARY_ADMIN').toUpperCase(), firmId: 'F1', xID: 'X1', _id: 'U1' };
    next();
  };
  const tenantGate = (req, res, next) => {
    if (req.headers['x-test-missing-firm-context'] === '1') return res.status(403).json({ success: false, message: 'Firm context is required' });
    req.firm = { id: 'F1' }; req.firmId = 'F1'; next();
  };

  swapModule(routeGroupsModulePath, { adminBaseAccess: [authGate, tenantGate] });
  const originalPermission = require(permissionMiddlewareModulePath);
  swapModule(permissionMiddlewareModulePath, { ...originalPermission, authorizeFirmPermission: () => (_req, _res, next) => next() });

  const ok = (_req, res) => res.status(200).json({ success: true });
  swapModule(authControllerModulePath, new Proxy({ getAllUsers: (_req, res) => res.status(200).json({ success: true, data: [] }) }, { get: (t, p) => t[p] || ok }));
  swapModule(adminControllerModulePath, new Proxy({ getAdminStats: (_req, res) => res.status(200).json({ success: true, data: {} }), getHierarchyTree: (_req, res) => res.status(200).json({ success: true, data: [] }), listWorkbaskets: (_req, res) => res.status(200).json({ success: true, data: [] }) }, { get: (t, p) => t[p] || ok }));
  swapModule(workbasketControllerModulePath, { listWorkbaskets: (_req, res) => res.status(200).json({ success: true, data: [] }), createWorkbasket: ok, renameWorkbasket: ok, toggleWorkbasketStatus: ok, updateUserWorkbaskets: ok });
  swapModule(storageControllerModulePath, new Proxy({}, { get: () => ok }));
  swapModule(aiControllerModulePath, new Proxy({}, { get: () => ok }));

  delete require.cache[require.resolve('../src/routes/admin.routes')];
  delete require.cache[require.resolve('../src/routes/storage.routes')];
  delete require.cache[require.resolve('../src/routes/ai.routes')];
  const adminRoutes = require('../src/routes/admin.routes');
  const storageRoutes = require('../src/routes/storage.routes');
  const aiRoutes = require('../src/routes/ai.routes');

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/storage', authGate, tenantGate, storageRoutes);
  app.use('/api/ai', authGate, tenantGate, aiRoutes);

  for (const ep of ['/api/admin/stats', '/api/admin/users', '/api/admin/workbaskets', '/api/admin/hierarchy']) {
    const res = await request(app).get(ep).set('x-test-role', 'ADMIN');
    assert.strictEqual(res.status, 200);
  }

  const blocked = [['patch','/api/admin/users/X2/restrict-clients'],['post','/api/storage/disconnect'],['post','/api/ai/test-configuration'],['post','/api/admin/cms-intake-settings/intake-api-key/regenerate']];
  for (const [m, ep] of blocked) {
    const r = await request(app)[m](ep).set('x-test-role', 'ADMIN').send({});
    assert.ok([400, 403].includes(r.status));
    if (r.status === 403) assert.strictEqual(r.body.message, 'Primary admin access required');
    const p = await request(app)[m](ep).set('x-test-role', 'PRIMARY_ADMIN').send({});
    assert.notStrictEqual(p.status, 403);
  }

  const missing = await request(app).put('/api/admin/firm-settings').set('x-test-role', 'PRIMARY_ADMIN').set('x-test-missing-firm-context', '1').send({});
  assert.ok([400,403].includes(missing.status));
  console.log('primaryAdminAdminPermissionSplit.test.js passed');
})().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{for (const {modulePath,original} of restore){delete require.cache[modulePath]; if(original) require.cache[modulePath]=original;}});
