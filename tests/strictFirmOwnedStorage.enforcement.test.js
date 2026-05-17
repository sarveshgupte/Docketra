#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

async function testRequireWritableBusinessStorage() {
  const mocks = {
    mongoose: { connection: { readyState: 1 } },
    '../models/Firm.model': {
      findById: () => ({
        select: () => ({ lean: async () => ({ settings: { firm: { strictFirmOwnedStorage: true } }, storage: { mode: 'docketra_managed', provider: 'docketra_managed' }, storageConfig: null }) }),
      }),
      findOne: () => ({ select: () => ({ lean: async () => null }) }),
    },
    './storage/resolveFirmStorageState': { resolveFirmStorageState: () => ({ canonicalProvider: 'docketra_managed', connectionStatus: 'ACTIVE_MANAGED', isManaged: true }) },
  };

  Module._load = function(request, parent, isMain) {
    if (mocks[request]) return mocks[request];
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/services/strictStoragePolicy.service')];
  const { requireWritableBusinessStorage } = require('../src/services/strictStoragePolicy.service');

  let blocked = false;
  try {
    await requireWritableBusinessStorage({ firmId: '507f1f77bcf86cd799439011', requestId: 'req-1' });
  } catch (error) {
    blocked = error?.payload?.error === 'strict_storage_unavailable';
  }
  assert.ok(blocked, 'strict mode should block non-BYOS writable storage');

  Module._load = originalLoad;
}

async function testStrictAllowsHealthyByos() {
  const mocks = {
    mongoose: { connection: { readyState: 1 } },
    '../models/Firm.model': {
      findById: () => ({ select: () => ({ lean: async () => ({ settings: { firm: { strictFirmOwnedStorage: true } } }) }) }),
      findOne: () => ({ select: () => ({ lean: async () => null }) }),
    },
    './storage/resolveFirmStorageState': { resolveFirmStorageState: () => ({ canonicalProvider: 'google_drive', connectionStatus: 'ACTIVE_BYOS', isManaged: false }) },
  };

  Module._load = function(request, parent, isMain) {
    if (mocks[request]) return mocks[request];
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/services/strictStoragePolicy.service')];
  const { requireWritableBusinessStorage } = require('../src/services/strictStoragePolicy.service');
  const result = await requireWritableBusinessStorage({ firmId: '507f1f77bcf86cd799439011' });
  assert.strictEqual(result.strictFirmOwnedStorage, true);

  Module._load = originalLoad;
}

async function testStorageConfigurationExposesStrict() {
  const controllerPath = require.resolve('../src/controllers/storage.controller');
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return { findById: () => ({ select: () => ({ lean: async () => ({ settings: { firm: { strictFirmOwnedStorage: true }, storageBackup: {} } }) }) }) };
    }
    if (request === '../utils/role.utils') return { isAdminRole: () => true, isPrimaryAdminRole: () => true };
    if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => ({ getFolderPath: async () => null }) } };
    if (request === '../services/storage/resolveFirmStorageState') return { resolveFirmStorageState: () => ({ canonicalProvider: 'google_drive', connectionStatus: 'ACTIVE_BYOS', connectedEmail: null, warnings: [], isManaged: false, mode: 'firm_connected' }), normalizeProvider: (v) => v };
    if (request === '../services/storage/services/TokenEncryption.service') return { encrypt: (v) => v, decrypt: () => '{}' };
    if (request === '../services/storageBackup.service') return { storageBackupService: { listBackups: async () => [] } };
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: '507f1f77bcf86cd799439011' }) };
    if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => ({}) };
    if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
    if (request === '../utils/requestCookies') return { getCookieValue: () => 's' };
    if (request === 'googleapis') return { google: { auth: { OAuth2: class {} }, drive: () => ({}) } };
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[controllerPath];
  const controller = require(controllerPath);
  const req = { firmId: '507f1f77bcf86cd799439011', ownershipFirmId: '507f1f77bcf86cd799439011', user: { role: 'PRIMARY_ADMIN' } };
  const res = { statusCode: 200, headers: {}, set(k,v){this.headers[k]=v;}, status(c){this.statusCode=c; return this;}, json(b){this.body=b; return this;} };
  await controller.getStorageConfiguration(req, res);
  assert.strictEqual(res.body.strictFirmOwnedStorage, true);
  assert.ok(!JSON.stringify(res.body).includes('refreshToken'));
  Module._load = originalLoad;
}

(async () => {
  await testRequireWritableBusinessStorage();
  await testStrictAllowsHealthyByos();
  await testStorageConfigurationExposesStrict();
  console.log('strictFirmOwnedStorage.enforcement.test.js passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
