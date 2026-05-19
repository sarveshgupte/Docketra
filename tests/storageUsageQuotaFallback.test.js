#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let mockFirmDoc = { storage: { mode: 'firm_connected', provider: 'google_drive' }, storageConfig: { provider: 'google_drive', credentials: 'enc:x' } };
let mockState = {
  canonicalProvider: 'google_drive',
  connectionStatus: 'ACTIVE_BYOS',
  isManaged: false,
  mode: 'firm_connected',
};
let mockProvider = { getStorageQuota: async () => ({ quotaAvailable: true, provider: 'google_drive' }) };

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      findById: () => ({
        select: () => ({ lean: async () => mockFirmDoc }),
      }),
    };
  }
  if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'firm-1' }) };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => mockProvider } };
  if (request === '../services/storage/resolveFirmStorageState') return { normalizeProvider: (p) => p, resolveFirmStorageState: () => mockState };
  if (request === '../services/storage/services/TokenEncryption.service') return { encrypt: (v) => `enc:${v}`, decrypt: () => '{}' };
  if (request === '../services/storageBackup.service') return { storageBackupService: {} };
  if (request === '../services/googleDrive.service') return { PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' }, googleDriveService: { getOAuthClient: () => ({ generateAuthUrl: () => 'x' }), markStorageDisconnected: async () => {}, markStorageError: async () => {} } };
  if (request === '../services/storage/providers/GoogleDriveProvider') return class {};
  if (request === '../services/storage/providers/OneDriveProvider') return class {};
  if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
  if (request === '../utils/role.utils') return { isAdminRole: () => true, isPrimaryAdminRole: () => true };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => ({}) };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === 'jsonwebtoken') return { verify: () => ({}) };
  return originalLoad.apply(this, arguments);
};

function resFactory() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const controller = require('../src/controllers/storage.controller');

async function run() {
  const req = { firmId: 'tenant-1', user: { role: 'PRIMARY_ADMIN' } };

  // connected google_drive firm + quota/about unavailable -> 200 with quotaAvailable:false and managedFallback:false
  mockState = { canonicalProvider: 'google_drive', connectionStatus: 'ACTIVE_BYOS', isManaged: false, mode: 'firm_connected' };
  mockProvider = { getStorageQuota: async () => { throw new Error('about.get failed: storageQuota unavailable for this account'); } };
  let res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.quotaAvailable, false);
  assert.strictEqual(res.body.managedFallback, false);
  assert.strictEqual(res.body.provider, 'google_drive');

  // connected google_drive firm + unexpected provider error -> still 500 usage_failed
  mockProvider = { getStorageQuota: async () => { throw new Error('socket timeout while contacting provider'); } };
  res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'usage_failed');

  // managed storage mode -> no false BYOS fallback
  mockState = { canonicalProvider: 'docketra_managed', connectionStatus: 'ACTIVE_MANAGED', isManaged: true, mode: 'docketra_managed' };
  mockProvider = { getStorageQuota: async () => { throw new Error('about.get failed: storageQuota unavailable for this account'); } };
  res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.provider, 'docketra_managed');
  assert.strictEqual(res.body.managedFallback, true);

  // non-google provider error -> no false BYOS fallback
  mockState = { canonicalProvider: 'onedrive', connectionStatus: 'ACTIVE_BYOS', isManaged: false, mode: 'firm_connected' };
  mockProvider = { getStorageQuota: async () => { throw new Error('about.get failed: storageQuota unavailable for this account'); } };
  res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.error, 'usage_failed');

  console.log('storageUsage quota fallback tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
});
