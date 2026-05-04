#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

let resolveRequestFirmRoleCalls = 0;
let resolveFirmRoleCalls = 0;
Module._load = function(request, parent, isMain) {
  if (request === '../services/authorization.service') {
    return {
      resolveRequestFirmRole: async () => {
        resolveRequestFirmRoleCalls += 1;
        return { role: 'USER', permissions: ['CASE_VIEW'] };
      },
      resolveFirmRole: async () => {
        resolveFirmRoleCalls += 1;
        return { role: 'PRIMARY_ADMIN', permissions: ['WORK_SETTINGS'] };
      },
    };
  }
  if (request === '../utils/role.utils') {
    return { isSuperAdminRole: () => false };
  }
  if (request === './authorization.middleware') {
    return { requireAdmin: (_req,_res,next)=>next() };
  }
  if (request === '../models/User.model') return {};
  if (request === '../utils/log') return { error: ()=>{} };
  return originalLoad.apply(this, arguments);
};

const { authorizeFirmPermission } = require('../src/middleware/permission.middleware');

(async () => {
  const req = { firm: { id: 'F1' }, user: { _id: 'U1', role: 'USER' } };
  let statusCode = 200; let body = null; let nextCalled = false;
  const res = { status: (s)=>{ statusCode=s; return { json: (b)=>{ body=b; } }; } };
  await authorizeFirmPermission('WORK_SETTINGS')(req, res, ()=>{ nextCalled=true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(resolveRequestFirmRoleCalls, 1);
  assert.strictEqual(resolveFirmRoleCalls, 1);
  assert.strictEqual(req.firmRole, 'PRIMARY_ADMIN');
  console.log('permission.middleware firm role refresh test passed');
})().catch((e)=>{ console.error(e); process.exit(1); }).finally(()=>{ Module._load = originalLoad; });
