#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

let jwtArgs = null;
const mocks = {
  googleapis: {
    google: {
      auth: {
        JWT: class MockJWT {
          constructor(args) { jwtArgs = args; }
        },
      },
    },
  },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};

const GoogleDriveProvider = require('../src/services/storage/providers/GoogleDriveProvider');
const DocketraManagedStorageProvider = require('../src/services/storage/providers/DocketraManagedStorageProvider');

(async () => {
  try {
    process.env.MANAGED_STORAGE_PROVIDER = 'google_drive';
    process.env.DRIVE_ROOT_FOLDER_ID = 'root123';
    process.env.MANAGED_GOOGLE_CLIENT_EMAIL = 'svc@example.iam.gserviceaccount.com';
    process.env.MANAGED_GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';

    const provider = new DocketraManagedStorageProvider({ firmId: 'F001' });
    assert.strictEqual(provider.providerName, 'docketra_managed');
    assert.strictEqual(provider.rootFolderId, 'root123');
    assert.strictEqual(jwtArgs.email, process.env.MANAGED_GOOGLE_CLIENT_EMAIL);
    assert.ok(String(jwtArgs.key).includes('BEGIN PRIVATE KEY'));

    const originalGetOrCreateFolder = GoogleDriveProvider.prototype.getOrCreateFolder;
    const capturedCalls = [];
    GoogleDriveProvider.prototype.getOrCreateFolder = async function(parentFolderId, folderName) {
      capturedCalls.push({ parentFolderId, folderName });
      return `${parentFolderId}/${folderName}`;
    };

    const resolvedFirmFolder = await provider.getOrCreateFolder(null, 'firm_F001');
    assert.strictEqual(resolvedFirmFolder, 'root123/firm_F001');
    assert.deepStrictEqual(capturedCalls[0], { parentFolderId: 'root123', folderName: 'firm_F001' });

    const clientFolder = await provider.getOrCreateFolder('firm-folder-id', 'client_C000001');
    assert.strictEqual(clientFolder, 'firm-folder-id/client_C000001');
    assert.deepStrictEqual(capturedCalls[1], { parentFolderId: 'firm-folder-id', folderName: 'client_C000001' });
    GoogleDriveProvider.prototype.getOrCreateFolder = originalGetOrCreateFolder;

    delete process.env.DRIVE_ROOT_FOLDER_ID;
    assert.throws(() => new DocketraManagedStorageProvider({ firmId: 'F001' }), /Managed storage backend is not configured/);

    process.env.DRIVE_ROOT_FOLDER_ID = 'root123';
    delete process.env.MANAGED_GOOGLE_CLIENT_EMAIL;
    assert.throws(() => new DocketraManagedStorageProvider({ firmId: 'F001' }), /Managed storage backend is not configured/);

    console.log('docketraManagedStorageProvider.test.js passed');
  } finally {
    Module._load = originalLoad;
  }
})().catch((error) => { console.error(error); process.exit(1); });
