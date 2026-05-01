#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  Module._load = function(request, parent, isMain) {
    if (request === '../services/tenantIdentity.service') return { resolveCanonicalTenantFromFirmId: async () => { throw new Error('sensitive details'); } };
    if (request === '../utils/role.utils') return { isSuperAdminRole: () => false };
    if (request === '../utils/status.utils') return { isActiveStatus: () => true };
    if (request === '../utils/log') return { warn: () => {}, error: () => {}, info: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/middleware/firmContext');
  const { firmContext } = require('../src/middleware/firmContext');
  const req = { jwt: { firmId: '507f1f77bcf86cd799439011' }, user: { role: 'ADMIN' }, method: 'GET', originalUrl: '/x' };
  const res = { statusCode: 200, payload: null, status(c){ this.statusCode=c; return this; }, json(p){ this.payload=p; return this; } };
  await firmContext(req, res, () => {});
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(Boolean(res.payload.error), false);
  process.env.NODE_ENV = prevEnv;
  console.log('firmContextProductionErrorSanitization.test.js passed');
}
run().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{Module._load=originalLoad;});
