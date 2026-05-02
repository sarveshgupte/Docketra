#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') return { findById: () => ({ select(){return this;}, lean: async()=>null }) };
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => null };
    if (request === '../utils/encryption') return { encrypt: (v)=>v };
    if (request === '../utils/log') return { warn: () => {} };
    return originalLoad.apply(this, arguments);
  };
  clear('../src/controllers/ai.controller');
  const { getAiConfiguration } = require('../src/controllers/ai.controller');
  const req = { firmId: 'tenant-default' };
  const res = { statusCode: 200, payload: null, status(c){this.statusCode=c; return this;}, json(p){this.payload=p; return this;} };
  await getAiConfiguration(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.payload.message, 'Tenant mapping missing');
  console.log('aiMissingOwnershipFailsClosed.test.js passed');
}
run().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{Module._load=originalLoad;});
