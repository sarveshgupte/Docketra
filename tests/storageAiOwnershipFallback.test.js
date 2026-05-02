#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

function makeRes() { return { statusCode: 200, payload: null, status(c){ this.statusCode = c; return this; }, json(p){ this.payload = p; return this; } }; }

async function run() {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({ select(){ return this; }, lean: async () => null }),
        findByIdAndUpdate: async () => ({ ok: 1 }),
      };
    }
    if (request === '../services/tenantIdentity.service') return { resolveStorageContextFromTenantId: async () => null };
    if (request === '../services/storage/resolveFirmStorageState') {
      return {
        normalizeProvider: (p) => p || null,
        resolveFirmStorageState: () => ({
          canonicalProvider: null,
          connectionStatus: 'DISCONNECTED',
          connectedEmail: null,
          rootFolderId: null,
          driveId: null,
          isManaged: true,
          warnings: [],
        }),
      };
    }
    if (request === '../services/ai/providers/providerRegistry') return { getProviderMetadata: () => null, buildProviderStatus: () => null };
    if (request === '../services/googleDrive.service') return { googleDriveService: {}, PROVIDER_TYPES: {} };
    if (request === '../services/storageBackup.service') return { storageBackupService: {} };
    if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
    if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
    if (request === '../services/storage/providerCapabilities') return { supportsListFiles: () => false, supportsHealthCheck: () => false };
    if (request === '../services/storage/providers/GoogleDriveProvider') return class {};
    if (request === '../services/storage/providers/OneDriveProvider') return class {};
    if (request === '../services/storage/errors/StorageErrors') return { StorageValidationError: class extends Error {} };
    if (request === '../services/storage/services/TokenEncryption.service') return { encrypt: (v) => v, decrypt: () => '{}' };
    if (request === '../services/ai/audit/aiAuditWriter.service') return { writeAiAuditEvent: async () => {} };
    if (request === '../services/ai/credentials/aiCredentialResolver.service') return { resolveAiCredentials: async () => ({ status: 'not_configured' }) };
    if (request === '../services/ai/policy/aiPolicy.service') return { evaluateAiPolicy: () => ({ allowed: false, safeMessage: 'x', reasonCode: 'NO', policyVersion: 1 }), POLICY_VERSION: 1 };
    if (request === '../utils/log') return { warn: () => {}, error: () => {}, info: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/storage.controller');
  clear('../src/controllers/ai.controller');
  const storage = require('../src/controllers/storage.controller');
  const ai = require('../src/controllers/ai.controller');

  const storageRead = makeRes();
  await storage.getStorageConfiguration({ firmId: 'tenant-a', originalUrl: '/api/storage/configuration' }, storageRead);
  assert.strictEqual(storageRead.statusCode, 200);
  assert.strictEqual(storageRead.payload.provider, 'docketra_managed');
  assert.ok(!JSON.stringify(storageRead.payload).includes('refreshToken'));

  const aiRead = makeRes();
  await ai.getAiConfiguration({ firmId: 'tenant-a', originalUrl: '/api/ai/configuration' }, aiRead);
  assert.strictEqual(aiRead.statusCode, 200);
  assert.strictEqual(aiRead.payload.success, true);
  assert.ok(!('apiKey' in aiRead.payload.configuration));
  assert.ok(!('encryptedKey' in aiRead.payload.configuration));

  const storageWrite = makeRes();
  await storage.testStorageConnection({ firmId: 'tenant-a', originalUrl: '/api/storage/test-connection', user: { role: 'ADMIN' }, body: {} }, storageWrite);
  assert.strictEqual(storageWrite.statusCode, 400);

  const aiWrite = makeRes();
  await ai.testAiConfiguration({ firmId: 'tenant-a', originalUrl: '/api/ai/test' }, aiWrite);
  assert.strictEqual(aiWrite.statusCode, 400);

  console.log('storageAiOwnershipFallback.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
