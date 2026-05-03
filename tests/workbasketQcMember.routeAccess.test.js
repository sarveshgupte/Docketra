#!/usr/bin/env node
process.env.NODE_ENV = 'test';
const assert = require('assert');
const express = require('express');
const request = require('supertest');

const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
const workbasketControllerModulePath = require.resolve('../src/controllers/workbasket.controller');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const adminControllerModulePath = require.resolve('../src/controllers/admin.controller');
const categoryControllerModulePath = require.resolve('../src/controllers/category.controller');
const clientControllerModulePath = require.resolve('../src/controllers/client.controller');
const restore = [];
const swapModule = (p, ex) => { restore.push({ p, o: require.cache[p] }); delete require.cache[p]; require.cache[p] = { id: p, filename: p, loaded: true, exports: ex }; };

(async () => {
  const authGate = (req, _res, next) => { req.user = { role: String(req.headers['x-test-role'] || 'MANAGER').toUpperCase(), firmId: 'F1', _id: 'U1', xID: 'X1' }; req.firm = { id: 'F1' }; next(); };
  swapModule(routeGroupsModulePath, { adminBaseAccess: [authGate] });
  const ok = (_q, r) => r.status(200).json({ success: true });
  swapModule(authControllerModulePath, new Proxy({}, { get: () => ok }));
  swapModule(adminControllerModulePath, new Proxy({}, { get: () => ok }));
  swapModule(categoryControllerModulePath, new Proxy({}, { get: () => ok }));
  swapModule(clientControllerModulePath, new Proxy({}, { get: () => ok }));
  const perm = require(permissionMiddlewareModulePath);
  swapModule(permissionMiddlewareModulePath, { ...perm, authorizeFirmPermission: () => (_req, _res, next) => next() });
  swapModule(workbasketControllerModulePath, { listWorkbaskets: (_q,r)=>r.json({success:true,data:[]}), createWorkbasket: (_q,r)=>r.json({success:true}), renameWorkbasket: (_q,r)=>r.json({success:true}), toggleWorkbasketStatus: (_q,r)=>r.json({success:true}), updateUserWorkbaskets: (_q,r)=>r.json({success:true}), addQcMember: (_q,r)=>r.status(200).json({success:true}) });

  delete require.cache[require.resolve('../src/routes/admin.routes')];
  const adminRoutes = require('../src/routes/admin.routes');
  const app = express(); app.use(express.json()); app.use('/api/admin', adminRoutes);

  const m = await request(app).post('/api/admin/workbaskets/507f1f77bcf86cd799439012/qc-members').set('x-test-role', 'MANAGER').send({ userId: '507f1f77bcf86cd799439013' });
  assert.strictEqual(m.status, 200);
  const u = await request(app).post('/api/admin/workbaskets/507f1f77bcf86cd799439012/qc-members').set('x-test-role', 'USER').send({ userId: '507f1f77bcf86cd799439013' });
  assert.strictEqual(u.status, 403);
  console.log('workbasketQcMember.routeAccess.test.js passed');
})().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{for (const {p,o} of restore){delete require.cache[p]; if (o) require.cache[p]=o;}});
