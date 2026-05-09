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

const DocketraManagedStorageProvider = require('../src/services/storage/providers/DocketraManagedStorageProvider');

(() => {
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

    delete process.env.DRIVE_ROOT_FOLDER_ID;
    assert.throws(() => new DocketraManagedStorageProvider({ firmId: 'F001' }), /Managed storage backend is not configured/);

    process.env.DRIVE_ROOT_FOLDER_ID = 'root123';
    delete process.env.MANAGED_GOOGLE_CLIENT_EMAIL;
    assert.throws(() => new DocketraManagedStorageProvider({ firmId: 'F001' }), /Managed storage backend is not configured/);

    console.log('docketraManagedStorageProvider.test.js passed');
  } finally {
    Module._load = originalLoad;
  }
})();
