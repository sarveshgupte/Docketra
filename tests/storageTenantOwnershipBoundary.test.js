#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  const lookedUpFirmIds = [];
  let clientFirmId = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return {
        findById: (id) => ({ select() { return this; }, lean: async () => { lookedUpFirmIds.push(id); return { storageConfig: null, storage: { mode: 'docketra_managed' } }; } }),
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return { resolveStorageContextFromTenantId: async () => ({ tenantId: 'tenant-default', ownershipFirmId: 'firm-owner-abc' }) };
    }
    if (request === '../services/googleDrive.service') {
      return { googleDriveService: { getOAuthClient: () => ({}), getClient: async (firmId) => { clientFirmId = firmId; return { providerType: 'google_drive', rootFolderId: null }; } }, PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' } };
    }
    if (request.includes('TokenEncryption.service')) return { encrypt: (v) => v, decrypt: () => '{}' };
    if (request === '../services/storageBackup.service') return { storageBackupService: {} };
    if (request === '../services/storage/providers/GoogleDriveProvider') return function G() {};
    if (request === '../services/storage/providers/OneDriveProvider') return function O() {};
    if (request === '../services/storage/errors/StorageErrors') return { StorageValidationError: class extends Error {} };
    if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
    if (request === '../services/storageAdapter.service') return { S3Adapter: function() {} };
    if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {} };
    if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
    if (request === '../utils/log') return { warn: () => {}, error: () => {}, info: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/storage.controller');
  const { getStorageStatus } = require('../src/controllers/storage.controller');
  const req = { firmId: 'tenant-default', user: { role: 'PRIMARY_ADMIN' } };
  const res = { code: 200, payload: null, status(c){ this.code=c; return this;}, json(p){this.payload=p; return this;} };
  await getStorageStatus(req, res);

  assert.strictEqual(lookedUpFirmIds[0], 'firm-owner-abc');
  assert.strictEqual(clientFirmId, 'firm-owner-abc');
  assert.strictEqual(res.code, 200);
  console.log('storageTenantOwnershipBoundary.test.js passed');
}
run().catch((e)=>{console.error(e);process.exit(1);}).finally(()=>{Module._load=originalLoad;});
