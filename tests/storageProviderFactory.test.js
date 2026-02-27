#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

let mockedConfig = null;

const mockTenantStorageConfig = {
  async findOne() {
    return mockedConfig;
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../models/TenantStorageConfig.model') return mockTenantStorageConfig;
  if (request === './services/TokenEncryption.service') return { decrypt: () => 'refresh-token' };
  if (request === 'googleapis') {
    return {
      google: {
        auth: {
          OAuth2: class {
            setCredentials() {}
          },
        },
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { getProviderForTenant } = require('../src/storage/StorageProviderFactory');

async function testGoogleProviderResolution() {
  mockedConfig = {
    tenantId: 'tenant-1',
    provider: 'google_drive',
    encryptedRefreshToken: 'enc',
    driveId: 'drive-1',
    status: 'ACTIVE',
    isActive: true,
  };
  const provider = await getProviderForTenant('tenant-1');
  assert.strictEqual(provider.providerName, 'google_drive');
  console.log('  ✓ resolves google_drive provider from active tenant config');
}

async function testInactiveStorageRejected() {
  mockedConfig = null;
  await assert.rejects(
    () => getProviderForTenant('tenant-1'),
    (error) => error && error.code === 'STORAGE_CONFIG_MISSING'
  );
  console.log('  ✓ rejects when no active storage config exists');
}

async function run() {
  console.log('Running storageProviderFactory tests...');
  try {
    await testGoogleProviderResolution();
    await testInactiveStorageRejected();
    console.log('All storageProviderFactory tests passed.');
  } catch (error) {
    console.error('storageProviderFactory tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
