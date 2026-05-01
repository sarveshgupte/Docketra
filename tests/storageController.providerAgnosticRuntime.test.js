#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let mockFirmDoc = { storage: { mode: 'docketra_managed', provider: 'docketra_managed' }, storageConfig: null };
let mockProvider = { providerName: 'docketra_managed', testConnection: async () => {}, listFiles: async () => [] };
let googleClientCallCount = 0;
let googleMarkDisconnectedCallCount = 0;
let firmUpdatePayloads = [];

const mockFirmModel = {
  findById: () => ({
    select: () => ({ lean: async () => mockFirmDoc }),
  }),
  findByIdAndUpdate: async () => ({}),
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    mockFirmModel.findByIdAndUpdate = async (id, update) => {
      firmUpdatePayloads.push({ id, update });
      return {};
    };
    return mockFirmModel;
  }
  if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'firm-1' }) };
  if (request === '../services/googleDrive.service') {
    return {
      PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' },
      googleDriveService: {
        getClient: async () => { googleClientCallCount += 1; return { drive: { files: { list: async () => ({}) } } }; },
        markStorageDisconnected: async () => { googleMarkDisconnectedCallCount += 1; },
        markStorageError: async () => {},
        getOAuthClient: () => ({ generateAuthUrl: () => 'x' }),
      },
    };
  }
  if (request === '../services/storage/StorageProviderFactory') {
    return { StorageProviderFactory: { getProvider: async () => mockProvider } };
  }
  if (request === '../services/storage/services/TokenEncryption.service') return { encrypt: (v) => `enc:${v}`, decrypt: () => '{}' };
  if (request === '../services/storageBackup.service') return { storageBackupService: {} };
  if (request === '../services/storage/providers/GoogleDriveProvider') return class {};
  if (request === '../services/storage/providers/OneDriveProvider') return class {};
  if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
  if (request === '../utils/role.utils') return { isAdminRole: () => true, isPrimaryAdminRole: () => true };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => {} };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === 'jsonwebtoken') return { verify: () => ({ type: 'otp_verification', purpose: 'storage_change', jti: 'j', identifier: 'a', exp: Date.now() / 1000 + 1000 }) };
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

(async () => {
  const req = { firmId: 'tenant-1', user: { role: 'Primary Admin', primary_email: 'a' }, body: { verificationToken: 'x' } };

  mockFirmDoc = { storage: { mode: 'docketra_managed', provider: 'docketra_managed' }, storageConfig: null };
  mockProvider = { providerName: 'docketra_managed', testConnection: async () => {} };
  googleClientCallCount = 0;
  let res = resFactory();
  await controller.storageHealthCheck(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(googleClientCallCount, 0);

  mockFirmDoc = { storage: { mode: 'firm_connected', provider: 'google_drive' }, storageConfig: { provider: 'google_drive', credentials: 'enc:x' } };
  mockProvider = { providerName: 'google_drive', testConnection: async () => {} };
  res = resFactory();
  await controller.storageHealthCheck(req, res);
  assert.strictEqual(res.statusCode, 200);

  mockProvider = { providerName: 'onedrive', listFiles: async () => [{ size: 10 }, { size: 5 }] };
  res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.totalFiles, 2);
  assert.strictEqual(res.body.totalSizeBytes, 15);

  mockProvider = { providerName: 'onedrive' };
  res = resFactory();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.code, 'STORAGE_PROVIDER_UNSUPPORTED_OPERATION');

  googleMarkDisconnectedCallCount = 0;
  firmUpdatePayloads = [];
  res = resFactory();
  await controller.disconnectStorage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(googleMarkDisconnectedCallCount, 0);
  assert.strictEqual(googleClientCallCount, 0);
  assert.strictEqual(res.body.status, 'ACTIVE_MANAGED');
  assert.strictEqual(res.body.connectionStatus, 'ACTIVE_MANAGED');
  assert.strictEqual(res.body.action, 'SWITCHED_TO_MANAGED_FALLBACK');
  assert.strictEqual(res.body.provider, 'docketra_managed');
  assert.strictEqual(res.body.previousProvider, 'google-drive');
  assert(firmUpdatePayloads.length > 0, 'Expected Firm.findByIdAndUpdate call');
  const lastUpdate = firmUpdatePayloads[firmUpdatePayloads.length - 1].update;
  assert.strictEqual(lastUpdate.$set['storage.mode'], 'docketra_managed');
  assert.strictEqual(lastUpdate.$set['storage.provider'], 'docketra_managed');
  assert.strictEqual(lastUpdate.$set.storageConfig, null);

  assert.strictEqual(typeof controller.googleConnect, 'function');
  assert.strictEqual(typeof controller.googleCallback, 'function');

  console.log('storageController provider-agnostic runtime tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
});
