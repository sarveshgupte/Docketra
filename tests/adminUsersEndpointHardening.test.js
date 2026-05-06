#!/usr/bin/env node
process.env.NODE_ENV = 'test';
const assert = require('assert');
const request = require('supertest');
const express = require('express');

const authControllerPath = require.resolve('../src/controllers/auth.controller');
const userModelPath = require.resolve('../src/models/User.model');
const restore = [];
const swap = (p, e) => { restore.push({ p, o: require.cache[p] }); delete require.cache[p]; require.cache[p] = { id: p, filename: p, loaded: true, exports: e }; };

(async () => {
  const users = [{ _id:'U2', xID:'X2', firmId:'F1', status:'active', name:'Member', email:'m@d.com', role:'ADMIN', isPrimaryAdmin:false, createdAt:new Date() }];
  swap(userModelPath, {
    find: (query) => ({
      select: () => ({ populate: () => ({ sort: async () => users.filter((u)=>u.firmId===query.firmId && u.status!=='deleted') }) }),
    }),
  });
  delete require.cache[authControllerPath];
  const { getAllUsers } = require(authControllerPath);

  const app = express();
  app.get('/api/admin/users', (req,res,next)=>{ req.user={ firmId:req.headers['x-firm']||'F1', xID:'X1', role:req.headers['x-role']||'PRIMARY_ADMIN', name:'Primary', email:'p@d.com', _id:'U1' }; next(); }, getAllUsers);

  const ok = await request(app).get('/api/admin/users');
  assert.strictEqual(ok.status, 200);
  assert.ok(Array.isArray(ok.body.data));
  assert.ok(ok.body.data.some((u)=>u.xID==='X1'), 'response should include current primary admin fallback record');

  const isolated = await request(app).get('/api/admin/users').set('x-firm','F2');
  assert.strictEqual(isolated.status, 200);
  assert.ok(isolated.body.data.every((u)=>u.xID==='X1'), 'tenant isolation should not leak users from another firm');

  const missingFirm = await request(app).get('/api/admin/users').set('x-firm','');
  assert.strictEqual(missingFirm.status, 403);

  console.log('adminUsersEndpointHardening.test.js passed');
})().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{for(const {p,o} of restore){delete require.cache[p]; if(o) require.cache[p]=o;}});
