#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
}

function loadClientRepository({
  findResult = [],
  findOneResult = null,
  decryptImpl = async (value) => value,
  looksEncryptedImpl = (value) => typeof value === 'string' && value.startsWith('enc:'),
} = {}) {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        find: () => findResult,
        findOne: () => findOneResult,
        create: async (payload) => payload,
        countDocuments: async () => 0,
      };
    }

    if (request === '../security/encryption.service') {
      class ForbiddenError extends Error {}

      return {
        decrypt: decryptImpl,
        ensureTenantKey: async () => {},
        ForbiddenError,
      };
    }

    if (request === '../security/encryption.utils') {
      return {
        looksEncrypted: looksEncryptedImpl,
      };
    }

    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/repositories/ClientRepository');
  return require('../src/repositories/ClientRepository');
}

async function testEncryptedFieldsDecryptForListings() {
  const ClientRepository = loadClientRepository({
    findResult: [{
      clientId: 'C000001',
      businessName: 'Acme Legal',
      businessEmail: 'enc:ops@acme.test',
      primaryContactNumber: 'enc:9999999999',
      status: 'ACTIVE',
      createdAt: '2026-03-10T00:00:00.000Z',
    }],
    decryptImpl: async (value) => value.slice(4),
  });

  const clients = await ClientRepository.find('firm-1', {}, 'Admin');

  assert.strictEqual(clients[0].businessEmail, 'ops@acme.test');
  assert.strictEqual(clients[0].primaryContactNumber, '9999999999');
  console.log('  ✓ client repository decrypts encrypted email and phone for listings');
}

async function testDecryptFailurePreservesStoredValue() {
  const encryptedEmail = 'enc:broken@example.test';
  const ClientRepository = loadClientRepository({
    findOneResult: {
      clientId: 'C000002',
      businessName: 'Broken Client',
      businessEmail: encryptedEmail,
      primaryContactNumber: 'enc:1234567890',
      status: 'ACTIVE',
    },
    decryptImpl: async (value) => (value === encryptedEmail ? null : value.slice(4)),
  });

  const client = await ClientRepository.findByClientId('firm-1', 'C000002', 'Admin');

  assert.strictEqual(client.businessEmail, encryptedEmail);
  assert.strictEqual(client.primaryContactNumber, '1234567890');
  console.log('  ✓ client repository preserves stored values when decrypt fails');
}

async function testEmptyDisplayValuesNormalizeToNotAvailable() {
  const ClientRepository = loadClientRepository({
    findOneResult: {
      clientId: 'C000003',
      businessName: 'Empty Contact Client',
      businessEmail: 'enc:',
      primaryContactNumber: '',
      status: 'ACTIVE',
    },
    decryptImpl: async () => '',
  });

  const client = await ClientRepository.findByClientId('firm-1', 'C000003', 'Admin');

  assert.strictEqual(client.businessEmail, 'Not Available');
  assert.strictEqual(client.primaryContactNumber, 'Not Available');
  console.log('  ✓ client repository normalizes empty contact values to Not Available');
}

async function run() {
  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  process.env.MASTER_ENCRYPTION_KEY = 'test-master-key';

  try {
    await testEncryptedFieldsDecryptForListings();
    await testDecryptFailurePreservesStoredValue();
    await testEmptyDisplayValuesNormalizeToNotAvailable();
    console.log('Client repository display normalization tests passed.');
  } finally {
    Module._load = originalLoad;
    clearModule('../src/repositories/ClientRepository');
    if (originalKey !== undefined) {
      process.env.MASTER_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.MASTER_ENCRYPTION_KEY;
    }
  }
}

run().catch((error) => {
  console.error(error);
  Module._load = originalLoad;
  process.exit(1);
});
