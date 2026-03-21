#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let isAdmin = true;
let storageConfigDoc = null;

const mockStorageConfiguration = {
  findOne() {
    return {
      select() {
        return {
          lean: async () => storageConfigDoc,
        };
      },
      lean: async () => storageConfigDoc,
    };
  },
};

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
  if (request === '../models/StorageConfiguration.model') return mockStorageConfiguration;
  if (request === '../models/TenantStorageConfig.model') return { findOne: () => ({ select: async () => null }), updateMany: async () => {}, findOneAndUpdate: async () => {} };
  if (request === '../models/TenantStorageHealth.model') return { findOne: () => ({ select: () => ({ lean: async () => null }) }) };
  if (request === '../models/Firm.model') return { findById: () => ({ select: () => ({ lean: async () => ({ storage: { mode: 'docketra_managed' } }) }) }) };
  if (request === '../storage/services/TokenEncryption.service') return { encrypt: (v) => `enc:${v}`, decrypt: () => 'refresh' };
  if (request === '../utils/role.utils') return { isAdminRole: () => isAdmin };
  if (request === '../utils/requestCookies') return { getCookieValue: () => 'state' };
  if (request === '../storage/providers/GoogleDriveProvider') return class { async createFolder() { return { folderId: 'id' }; } };
  if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: { getProvider: async () => ({ testConnection: async () => ({}) }) } };
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
const { oauthLimiter } = require('../src/storage/middleware/oauthLimiter');

async function testGetStorageConfiguration() {
  storageConfigDoc = {
    provider: 'google-drive',
    rootFolderId: 'root',
    credentials: { connectedEmail: 'admin@example.com' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const req = { firmId: 'FIRM1' };
  const res = createRes();
  await controller.getStorageConfiguration(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.provider, 'google-drive');
  console.log('  ✓ getStorageConfiguration returns google-drive config');
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

async function run() {
  console.log('Running storageController tests...');
  try {
    await testGetStorageConfiguration();
    await testGoogleConnectAdminOnly();
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
