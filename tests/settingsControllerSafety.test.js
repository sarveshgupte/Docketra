#!/usr/bin/env node
'use strict';

/**
 * Settings Controller Safety Test
 *
 * Loads the REAL controllers (not mocked) and verifies:
 *   1. admin.getFirmSettings         → normalized safe defaults, no tokens/passwords
 *   2. admin.getCmsIntakeSettings    → plaintext intakeApiKey is NOT in the GET response
 *   3. storage.getStorageConfiguration  → no refreshToken/accessToken/clientSecret/secretAccessKey
 *   4. storage.getStorageOwnershipSummary → no raw credential fields even when credentials exist
 *   5. ai.getAiConfiguration         → no apiKey/encryptedKey even when config has an encrypted key
 *
 * DB/IO dependencies are stubbed via Module._load. All controller logic is real.
 */

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = '';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.MASTER_ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clearModuleCache = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

// ── Minimal mock response builder ─────────────────────────────────────────────
function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
  };
}

const OWNERSHIP_FIRM_ID = '507f1f77bcf86cd799439099';
const TENANT_ID = '507f1f77bcf86cd799439011';

// ── Chainable query builder for Team/Category/User find().select().sort().lean() ──
const chainLean = (val) => ({
  select: () => chainLean(val),
  sort: () => chainLean(val),
  lean: () => Promise.resolve(val),
});

// ── Firm model mock ───────────────────────────────────────────────────────────
// Returns different shapes depending on which fields are selected,
// matching the real query patterns used by each controller function.
function makeFirmModel() {
  return {
    findById: (id) => ({
      select: (fields) => {
        const f = fields || '';

        // admin.getFirmSettings → Firm.findById().select('settings')   [no .lean()]
        if (f === 'settings') {
          return Promise.resolve({ _id: id, settings: { firm: {}, work: {} } });
        }

        // admin.getCmsIntakeSettings → Firm.findById().select('intakeConfig.cms firmId')  [no .lean()]
        if (f.includes('intakeConfig')) {
          return Promise.resolve({
            _id: id,
            firmId: TENANT_ID,
            intakeConfig: {
              cms: {
                intakeApiEnabled: true,
                // Simulates a real firm that has a stored API key – should NOT appear in GET response
                intakeApiKey: 'plaintext-secret-123',
              },
            },
          });
        }

        // storage + ai controllers → Firm.findById().select(...).lean()
        const doc = {
          _id: id,
          storage: null,
          storageConfig: {
            // non-empty so decodeFirmStorageConfig actually calls decrypt()
            credentials: 'fake-credentials-blob',
            createdAt: null,
            updatedAt: null,
          },
          settings: { storageBackup: {} },
          aiConfig: {
            enabled: false,
            provider: 'openai',
            model: 'gpt-4',
            // Encrypted key – must NOT appear in getAiConfiguration response
            encryptedKey: 'enc::super-secret-key-that-must-not-leak',
            credentialMode: 'encrypted_key',
          },
        };
        return { lean: () => Promise.resolve(doc) };
      },
    }),
  };
}

// ── Main test ─────────────────────────────────────────────────────────────────
async function run() {
  Module._load = function(request, parent, isMain) {
    // ── Shared model stubs ──────────────────────────────────────────────────
    if (request === '../models/Firm.model') return makeFirmModel();
    if (request === '../models/User.model') return { find: () => chainLean([]) };
    if (request === '../models/Team.model') return { find: () => chainLean([]) };
    if (request === '../models/Category.model') return { find: () => chainLean([]) };
    if (request === '../utils/log') return { warn: () => {}, error: () => {}, info: () => {}, debug: () => {} };

    // ── Storage-specific stubs ──────────────────────────────────────────────
    if (request === '../services/storage/resolveFirmStorageState') {
      return {
        normalizeProvider: (p) => p || null,
        resolveFirmStorageState: () => ({
          canonicalProvider: null,
          connectionStatus: 'ACTIVE_MANAGED',
          connectedEmail: null,
          rootFolderId: null,
          driveId: null,
          isManaged: true,
          mode: 'docketra_managed',
          warnings: [],
        }),
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return { resolveStorageContextFromTenantId: async () => null };
    }
    // Stub decrypt so decodeFirmStorageConfig returns an object WITH token fields.
    // This proves the controller does NOT copy those token fields into the HTTP response.
    if (request === '../services/storage/services/TokenEncryption.service') {
      return {
        encrypt: (v) => v,
        decrypt: () => JSON.stringify({
          connectedEmail: 'connected@example.com',
          lastCheckedAt: null,
          lastError: null,
          // Raw credential fields that must never leak into the API response:
          refreshToken: 'raw-refresh-token-should-not-appear',
          accessToken: 'raw-access-token-should-not-appear',
          clientSecret: 'raw-client-secret-should-not-appear',
          secretAccessKey: 'raw-s3-secret-should-not-appear',
        }),
      };
    }
    if (request === '../services/storageBackup.service') {
      return { storageBackupService: { listBackups: async () => [] } };
    }
    if (request === '../services/storage/StorageProviderFactory') return { StorageProviderFactory: {} };
    if (request === '../services/googleDrive.service') return { googleDriveService: {}, PROVIDER_TYPES: {} };
    if (request === '../services/storage/providers/GoogleDriveProvider') return class {};
    if (request === '../services/storage/providers/OneDriveProvider') return class {};
    if (request === '../services/storage/errors/StorageErrors') return { StorageValidationError: class extends Error {} };
    if (request === '../services/storage/providers/S3Provider') return { S3Provider: class {} };
    if (request === '../services/storage/providerCapabilities') {
      return { supportsListFiles: () => false, supportsHealthCheck: () => false };
    }
    if (request === '../services/productAudit.service') {
      return { writeSettingsAudit: async () => {}, listSettingsAudit: async () => ({ rows: [], pagination: {} }) };
    }
    if (request === '../services/pilotDiagnostics.service') {
      return { REASON_CODES: {}, logPilotEvent: async () => {} };
    }

    // ── AI-specific stubs ───────────────────────────────────────────────────
    if (request === '../services/ai/providers/providerRegistry') {
      return { getProviderMetadata: () => null, buildProviderStatus: () => null, isSupportedProvider: () => true };
    }
    if (request === '../services/ai/audit/aiAuditWriter.service') return { writeAiAuditEvent: async () => {} };
    if (request === '../services/ai/credentials/aiCredentialResolver.service') {
      return { resolveAiCredentials: async () => ({ status: 'not_configured' }) };
    }
    if (request === '../services/ai/policy/aiPolicy.service') {
      return {
        evaluateAiPolicy: () => ({ allowed: false, safeMessage: 'x', reasonCode: 'NO', policyVersion: 1 }),
        POLICY_VERSION: 1,
      };
    }

    return originalLoad.apply(this, arguments);
  };

  // Clear cached controllers so they reload fresh through the intercept above
  clearModuleCache('../src/controllers/admin.controller');
  clearModuleCache('../src/controllers/storage.controller');
  clearModuleCache('../src/controllers/ai.controller');

  const adminCtl = require('../src/controllers/admin.controller');
  const storageCtl = require('../src/controllers/storage.controller');
  const aiCtl = require('../src/controllers/ai.controller');

  // ══════════════════════════════════════════════════════════════════════════
  // 1. admin.getFirmSettings — empty firm settings → normalized safe defaults
  // ══════════════════════════════════════════════════════════════════════════
  {
    const req = {
      ownershipFirmId: OWNERSHIP_FIRM_ID,
      user: { firmId: TENANT_ID, role: 'PRIMARY_ADMIN' },
      query: {},
    };
    const res = makeRes();
    await adminCtl.getFirmSettings(req, res);

    assert.strictEqual(res.statusCode, 200, 'getFirmSettings: expected 200');
    assert.strictEqual(res.payload?.success, true, 'getFirmSettings: expected success:true');
    const firmData = res.payload?.data;
    assert.ok(typeof firmData?.firm === 'object', 'getFirmSettings: data.firm must be an object');
    assert.ok(typeof firmData?.work === 'object', 'getFirmSettings: data.work must be an object');
    // Normalized defaults from the real normalizeFirmSettings/normalizeWorkSettings:
    assert.ok(typeof firmData.firm.slaDefaultDays === 'number', 'getFirmSettings: slaDefaultDays must be a number default');
    assert.ok(typeof firmData.firm.escalationInactivityThresholdHours === 'number', 'getFirmSettings: escalationInactivityThresholdHours must be present');
    assert.ok(typeof firmData.firm.workloadThreshold === 'number', 'getFirmSettings: workloadThreshold must be present');
    assert.ok(typeof firmData.firm.brandLogoUrl === 'string', 'getFirmSettings: brandLogoUrl must be a string');
    assert.ok(typeof firmData.work.assignmentStrategy === 'string', 'getFirmSettings: assignmentStrategy must be a string default');
    assert.ok(typeof firmData.work.statusWorkflowMode === 'string', 'getFirmSettings: statusWorkflowMode must be present');
    // Response must contain ONLY the expected keys at the top data level, no extras
    const firmKeys = Object.keys(firmData);
    assert.deepStrictEqual(firmKeys.sort(), ['firm', 'work'], 'getFirmSettings: data must have only firm and work keys');
    // No passwords/tokens in the response body
    const body = JSON.stringify(res.payload);
    assert.ok(!body.includes('password'), 'getFirmSettings: no passwords in response');
    assert.ok(!body.includes('apiKey'), 'getFirmSettings: no apiKey in response');
    assert.ok(!body.includes('token'), 'getFirmSettings: no tokens in response');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. admin.getCmsIntakeSettings — plaintext intakeApiKey must NOT leak
  // ══════════════════════════════════════════════════════════════════════════
  {
    const req = {
      ownershipFirmId: OWNERSHIP_FIRM_ID,
      user: { firmId: TENANT_ID, role: 'PRIMARY_ADMIN' },
      query: {},  // includeApiKey defaults to false
    };
    const res = makeRes();
    await adminCtl.getCmsIntakeSettings(req, res);

    assert.strictEqual(res.statusCode, 200, 'getCmsIntakeSettings: expected 200');
    assert.strictEqual(res.payload?.success, true, 'getCmsIntakeSettings: expected success:true');
    const intake = res.payload?.data?.intake;
    assert.ok(typeof intake === 'object', 'getCmsIntakeSettings: data.intake must be an object');

    // The plaintext API key value must not appear anywhere in the response body
    const body = JSON.stringify(res.payload);
    assert.ok(
      !body.includes('plaintext-secret-123'),
      'getCmsIntakeSettings: plaintext intakeApiKey must not appear in GET response (real controller)',
    );
    // intakeApiKey field must be falsy (null) when includeApiKey is not requested
    assert.ok(
      !intake?.intakeApiKey,
      'getCmsIntakeSettings: intakeApiKey must be null/falsy without includeApiKey=true',
    );
    // Safe masked indicator must be present when a key is configured
    assert.ok(
      'intakeApiKeyConfigured' in intake,
      'getCmsIntakeSettings: intakeApiKeyConfigured indicator must be present',
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. storage.getStorageConfiguration — no raw OAuth/S3 credentials
  // ══════════════════════════════════════════════════════════════════════════
  {
    const req = {
      ownershipFirmId: OWNERSHIP_FIRM_ID,
      firmId: TENANT_ID,
      originalUrl: '/api/storage/configuration',
    };
    const res = makeRes();
    await storageCtl.getStorageConfiguration(req, res);

    assert.strictEqual(res.statusCode, 200, 'getStorageConfiguration: expected 200');
    const body = JSON.stringify(res.payload);
    assert.ok(!body.includes('refreshToken'), 'getStorageConfiguration: must not expose refreshToken');
    assert.ok(!body.includes('accessToken'), 'getStorageConfiguration: must not expose accessToken');
    assert.ok(!body.includes('clientSecret'), 'getStorageConfiguration: must not expose clientSecret');
    assert.ok(!body.includes('secretAccessKey'), 'getStorageConfiguration: must not expose secretAccessKey');
    // Must still return safe provider metadata
    assert.strictEqual(res.payload?.provider, 'docketra_managed', 'getStorageConfiguration: must return managed provider default');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. storage.getStorageOwnershipSummary — credentials decoded but NOT leaked
  //    (decrypt() stub returns an object with raw tokens; response must not include them)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const req = {
      ownershipFirmId: OWNERSHIP_FIRM_ID,
      firmId: TENANT_ID,
      originalUrl: '/api/storage/ownership-summary',
      user: { role: 'PRIMARY_ADMIN' },
    };
    const res = makeRes();
    await storageCtl.getStorageOwnershipSummary(req, res);

    assert.strictEqual(res.statusCode, 200, 'getStorageOwnershipSummary: expected 200');
    const body = JSON.stringify(res.payload);
    // The decoded credentials object contains these but the response must not
    assert.ok(!body.includes('raw-refresh-token-should-not-appear'), 'getStorageOwnershipSummary: must not expose refreshToken');
    assert.ok(!body.includes('raw-access-token-should-not-appear'), 'getStorageOwnershipSummary: must not expose accessToken');
    assert.ok(!body.includes('raw-client-secret-should-not-appear'), 'getStorageOwnershipSummary: must not expose clientSecret');
    assert.ok(!body.includes('raw-s3-secret-should-not-appear'), 'getStorageOwnershipSummary: must not expose secretAccessKey');
    // Safe fields from credentials are allowed (email, not tokens)
    assert.ok(typeof res.payload?.activeStorage === 'object', 'getStorageOwnershipSummary: must have activeStorage');
    assert.ok(typeof res.payload?.fallbackStorage === 'object', 'getStorageOwnershipSummary: must have fallbackStorage');
    assert.ok(typeof res.payload?.backupExport === 'object', 'getStorageOwnershipSummary: must have backupExport');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. ai.getAiConfiguration — encryptedKey/apiKey must not appear in response
  //    (firm has encryptedKey set; buildSafeAiConfig must strip it)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const req = {
      firmId: TENANT_ID,
      originalUrl: '/api/ai/configuration',
    };
    const res = makeRes();
    await aiCtl.getAiConfiguration(req, res);

    assert.strictEqual(res.statusCode, 200, 'getAiConfiguration: expected 200');
    assert.strictEqual(res.payload?.success, true, 'getAiConfiguration: expected success:true');
    const cfg = res.payload?.configuration;
    assert.ok(typeof cfg === 'object', 'getAiConfiguration: must return configuration object');

    // Raw key fields must be absent
    assert.ok(!('apiKey' in cfg), 'getAiConfiguration: apiKey must not be in response');
    assert.ok(!('encryptedKey' in cfg), 'getAiConfiguration: encryptedKey must not be in response');
    // hasEncryptedKey is the safe boolean indicator – must be present and true (since firm has key)
    assert.strictEqual(cfg.hasEncryptedKey, true, 'getAiConfiguration: hasEncryptedKey must be true when key is configured');
    // The raw encrypted key string must not appear anywhere in the response body
    const body = JSON.stringify(res.payload);
    assert.ok(
      !body.includes('enc::super-secret-key-that-must-not-leak'),
      'getAiConfiguration: raw encryptedKey value must not appear in response body',
    );
  }

  console.log('settingsControllerSafety.test.js passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
  clearModuleCache('../src/controllers/admin.controller');
  clearModuleCache('../src/controllers/storage.controller');
  clearModuleCache('../src/controllers/ai.controller');
});
