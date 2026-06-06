#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let isAdmin = true;
let lastUpdate = null;

function createRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    setHeader() {},
    redirect(url) { this.redirectUrl = url; return this; },
  };
}

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../models/TenantStorageConfig.model') return { findOne: () => ({ select: async () => null }), updateMany: async () => {}, findOneAndUpdate: async () => ({}) };
  if (request === '../models/Firm.model') {
    return {
      findById: () => ({
        select: () => ({
          lean: async () => ({
            storage: { mode: 'firm_connected', provider: 'google_drive' },
            storageConfig: { provider: 'google_drive', credentials: 'enc:stub', createdAt: new Date(), updatedAt: new Date() },
            settings: { storageBackup: { enabled: true } },
          }),
        }),
      }),
      findByIdAndUpdate: async (_id, update) => { lastUpdate = update; return {}; },
    };
  }
  if (request === '../services/storage/services/TokenEncryption.service') {
    return {
      encrypt: (v) => `enc:${v}`,
      decrypt: () => JSON.stringify({
        refreshToken: 'refresh',
        accessToken: 'access',
        privateKey: 'private',
        clientSecret: 'client-secret',
        rootFolderId: 'root-folder-id',
        connectedEmail: 'admin@example.com',
        status: 'ACTIVE_BYOS',
      }),
    };
  }
  if (request === '../utils/role.utils') return { isAdminRole: () => isAdmin, isPrimaryAdminRole: () => isAdmin };
  if (request === '../utils/requestCookies') return { getCookieValue: () => 'state' };
  if (request === '../services/storage/providers/GoogleDriveProvider') return class { async createFolder() { return { folderId: 'id' }; } };
  if (request === '../services/storage/providers/OneDriveProvider') return class {};
  if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => ({ testConnection: async () => ({}), getFolderPath: async () => '/Docketra/root-folder-id', getStorageQuota: async () => ({ provider: 'google_drive', quotaAvailable: true, totalBytes: 15, usedBytes: 8.2, availableBytes: 6.8, usagePercent: 54.67, displayTotal: '15 GB', displayUsed: '8.2 GB', displayAvailable: '6.8 GB', lastCheckedAt: new Date().toISOString() }) }) } };
  if (request === '../services/googleDrive.service') return {
    googleDriveService: {
      validateRootFolder: async () => ({ valid: true, folderName: 'Docketra — firm' }),
      buildCanonicalFirmFolderName: () => 'Docketra — firm',
      getOAuthClient: () => ({ setCredentials() {} }),
    },
    PROVIDER_TYPES: { USER_GOOGLE_DRIVE: 'google_drive' },
  };
  if (request === '../services/storage/resolveFirmStorageState') {
    return {
      normalizeProvider: (provider) => provider,
      resolveFirmStorageState: () => ({
        canonicalProvider: 'google_drive',
        connectionStatus: 'ACTIVE_BYOS',
        connectedEmail: 'admin@example.com',
        rootFolderId: 'root-folder-id',
        driveId: null,
        warnings: [],
        isManaged: false,
        mode: 'firm_connected',
      }),
    };
  }
  if (request === '../services/storageBackup.service') return { storageBackupService: { listBackups: async () => [] } };
  if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => ({ ownershipFirmId: 'FIRM1' }) };
  if (request === '../services/productAudit.service') return { writeSettingsAudit: async () => ({}) };
  if (request === '../services/pilotDiagnostics.service') return { REASON_CODES: {}, logPilotEvent: () => {} };
  if (request === 'googleapis') {
    return {
      google: {
        auth: {
          OAuth2: class {
            generateAuthUrl() { return 'https://accounts.google.com/o/oauth2/v2/auth'; }
            setCredentials() {}
            async getToken() { return { tokens: { refresh_token: 'refresh' } }; }
          },
        },
        drive: () => ({ about: { get: async () => ({ data: { user: { emailAddress: 'a@b.com' } } }) }, drives: { list: async () => ({ data: { drives: [] } }) } }),
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const controller = require('../src/controllers/storage.controller');
const { oauthLimiter } = require('../src/services/storage/middleware/oauthLimiter');

async function testGetStorageConfiguration() {
  const req = { firmId: 'FIRM1', ownershipFirmId: 'FIRM1', user: { role: 'PRIMARY_ADMIN' } };
  const res = createRes();
  await controller.getStorageConfiguration(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.provider, 'google-drive');
  assert.strictEqual(res.body.connectedEmail, 'admin@example.com');
  assert.ok(Object.prototype.hasOwnProperty.call(res.body, 'status'), 'response should include status');
  assert.ok(Object.prototype.hasOwnProperty.call(res.body, 'backup'), 'response should include backup section');
  assert.ok(!Object.prototype.hasOwnProperty.call(res.body, 'rootFolderId'), 'response must not expose folder IDs');
  assert.ok(!Object.prototype.hasOwnProperty.call(res.body, 'driveId'), 'response must not expose drive IDs');
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes('refreshToken'), 'response must not include refresh tokens');
  assert.ok(!serialized.includes('accessToken'), 'response must not include access tokens');
  assert.ok(!serialized.includes('privateKey'), 'response must not include private keys');
  assert.ok(!serialized.includes('clientSecret'), 'response must not include client secrets');
  console.log('  ✓ getStorageConfiguration returns sanitized storage config');
}

async function testGoogleConnectAdminOnly() {
  isAdmin = false;
  const req = { user: { role: 'User' }, firmId: 'FIRM1' };
  const res = createRes();
  controller.googleConnect(req, res);
  assert.strictEqual(res.statusCode, 403);
  console.log('  ✓ googleConnect enforces admin-only access');
}

async function testOauthLimiter() {
  const reqBase = {
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/api/storage/google/connect',
    headers: {},
    app: { get: () => false },
  };
  const runLimiter = async () => {
    const res = createRes();
    await new Promise((resolve) => {
      oauthLimiter(reqBase, res, () => resolve());
      setTimeout(resolve, 0);
    });
    return res;
  };
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await runLimiter();
    assert.notStrictEqual(res.statusCode, 429);
  }
  const blockedRes = await runLimiter();
  assert.strictEqual(blockedRes.statusCode, 429);
  console.log('  ✓ oauthLimiter blocks requests beyond threshold');
}


async function testDisconnectStorage() {
  isAdmin = true;
  const req = { firmId: 'FIRM1', ownershipFirmId: 'FIRM1', user: { role: 'PRIMARY_ADMIN' } };
  const res = createRes();
  await controller.disconnectStorage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.provider, 'docketra_managed');
  assert.strictEqual(res.body.status, 'ACTIVE_MANAGED');
  assert.strictEqual(lastUpdate.$set['storage.mode'], 'docketra_managed');
  assert.strictEqual(lastUpdate.$set['storage.provider'], 'docketra_managed');
  assert.strictEqual(lastUpdate.$set.storageConfig, null);
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes('refreshToken'));
  assert.ok(!serialized.includes('accessToken'));
  assert.ok(!serialized.includes('rootFolderId'));
  assert.ok(!serialized.includes('driveId'));
  assert.ok(!serialized.includes('clientSecret'));
  console.log('  ✓ disconnectStorage resets BYOS and returns sanitized response');
}

async function testStorageUsageSanitizedQuota() {
  const req = { firmId: 'FIRM1', ownershipFirmId: 'FIRM1', user: { role: 'PRIMARY_ADMIN' } };
  const res = createRes();
  await controller.storageUsage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.provider, 'google_drive');
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes('refreshToken'));
  assert.ok(!serialized.includes('accessToken'));
  assert.ok(!serialized.includes('rootFolderId'));
  assert.ok(!serialized.includes('driveId'));
  assert.ok(!serialized.includes('privateKey'));
  assert.ok(!serialized.includes('clientSecret'));
  console.log('  ✓ storageUsage returns sanitized usage payload');
}


async function run() {
  console.log('Running storageController tests...');
  try {
    await testGetStorageConfiguration();
    await testGoogleConnectAdminOnly();
    await testDisconnectStorage();
    await testStorageUsageSanitizedQuota();
    await testOauthLimiter();
    console.log('All storageController tests passed.');
  } catch (error) {
    console.error('storageController tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
