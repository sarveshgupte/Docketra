#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        findOne: (query) => ({
          select() { return this; },
          lean() {
            if (query._id === 'tenant-default') return Promise.resolve({ _id: 'tenant-default', firmId: 'firm-legacy', isDefaultClient: true });
            return Promise.resolve(null);
          },
        }),
      };
    }
    if (request === '../models/Firm.model') {
      return {
        findById: (id) => ({ select() { return this; }, lean: async () => (id === 'firm-legacy' ? { _id: 'firm-legacy', defaultClientId: 'tenant-default' } : null) }),
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clear('../src/services/tenantIdentity.service');
  const svc = require('../src/services/tenantIdentity.service');

  const fromLegacy = await svc.resolveCanonicalTenantFromFirmId('firm-legacy');
  assert.strictEqual(fromLegacy.tenantId, 'tenant-default');
  assert.strictEqual(fromLegacy.ownershipFirmId, 'firm-legacy');

  const fromCanonical = await svc.resolveCanonicalTenantFromFirmId('tenant-default');
  assert.strictEqual(fromCanonical.tenantId, 'tenant-default');
  assert.strictEqual(fromCanonical.ownershipFirmId, 'firm-legacy');

  const ownership = await svc.resolveFirmOwnershipFromTenantId('tenant-default');
  assert.strictEqual(ownership, 'firm-legacy');

  console.log('tenantIdentityOwnershipResolution.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
