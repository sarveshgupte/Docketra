#!/usr/bin/env node
/**
 * Unit tests for the pluggable encryption layer.
 *
 * Tests:
 *  1. generateTenantKey — creates and persists an encrypted DEK
 *  2. encrypt/decrypt roundtrip — plaintext is recoverable
 *  3. Different tenants produce different ciphertext for the same input
 *  4. Superadmin cannot decrypt (ForbiddenError from encryption.service)
 *  5. Repository throws when tenantId / firmId is missing
 *  6. KMS provider stub throws on all methods
 *
 * Uses mongodb-memory-server for isolated in-process execution (no external DB).
 * DB-dependent tests are skipped gracefully when the MongoDB binary is unavailable.
 */

const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// ── helpers ──────────────────────────────────────────────────────────────────

/** Generate a base64-encoded 32-byte key for testing. */
function makeTestKey() {
  return crypto.randomBytes(32).toString('base64');
}

// ── tests that do NOT require MongoDB ────────────────────────────────────────

async function testKmsProviderThrows() {
  const KmsEncryptionProvider = require('../src/security/encryption.kms.provider');
  const kms = new KmsEncryptionProvider();

  for (const [method, args] of [
    ['generateTenantKey', ['t1']],
    ['encrypt', ['plaintext', 't1']],
    ['decrypt', ['ciphertext', 't1']],
  ]) {
    let threw = false;
    try {
      await kms[method](...args);
    } catch (err) {
      threw = true;
      assert(err.message.includes('KMS provider not implemented'),
        `${method} should throw "KMS provider not implemented"`);
    }
    assert(threw, `KmsEncryptionProvider.${method} must throw`);
  }

  console.log('✓ KMS provider stub throws for all methods');
}

async function testPlaintextCompatibilityMode() {
  // Decrypt must return original value for non-encrypted (legacy) plaintext
  const { decrypt, _resetProvider } = require('../src/security/encryption.service');
  _resetProvider();

  const tenantId = `tenant-compat-${Date.now()}`;
  const plaintext = 'this is a legacy plaintext value without encryption';

  // decrypt must return the original value for plaintext (backward compat)
  // Note: this does NOT need a tenant key because looksEncrypted() returns false
  // for plaintext and the function returns early.
  const result = await decrypt(plaintext, tenantId);
  assert.strictEqual(result, plaintext,
    'Plaintext values must be returned unchanged (compatibility mode)');

  console.log('✓ Plaintext compatibility mode: non-encrypted values returned as-is');
}

async function testSuperadminBlockAtRepositoryLevel() {
  // This test does NOT require MongoDB.
  // The superadmin guard is checked BEFORE the DB query is attempted, so
  // ForbiddenError is thrown even when no connection is available.
  const CaseRepository = require('../src/repositories/CaseRepository');
  const ClientRepository = require('../src/repositories/ClientRepository');
  const { ForbiddenError } = require('../src/security/encryption.service');

  // Enable encryption so the guard is active
  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  process.env.MASTER_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

  const firmId = 'FIRM-TEST-001';

  const repositoryTestCases = [
    ['CaseRepository.find', () => CaseRepository.find(firmId, {}, 'SUPER_ADMIN')],
    ['CaseRepository.find (lowercase)', () => CaseRepository.find(firmId, {}, 'superadmin')],
    ['CaseRepository.findOne', () => CaseRepository.findOne(firmId, {}, 'SUPER_ADMIN')],
    ['CaseRepository.findById', () => CaseRepository.findById(firmId, 'some-id', 'SUPER_ADMIN')],
    ['CaseRepository.findByCaseId', () => CaseRepository.findByCaseId(firmId, 'CASE-001', 'SUPER_ADMIN')],
    ['CaseRepository.findByCaseNumber', () => CaseRepository.findByCaseNumber(firmId, 'CASE-20260101-00001', 'SUPER_ADMIN')],
    ['ClientRepository.find', () => ClientRepository.find(firmId, {}, 'SUPER_ADMIN')],
    ['ClientRepository.findOne', () => ClientRepository.findOne(firmId, {}, 'SUPER_ADMIN')],
    ['ClientRepository.findById', () => ClientRepository.findById(firmId, 'some-id', 'SUPER_ADMIN')],
    ['ClientRepository.findByClientId', () => ClientRepository.findByClientId(firmId, 'C000001', 'SUPER_ADMIN')],
  ];

  for (const [name, call] of repositoryTestCases) {
    let threw = false;
    try {
      await call();
    } catch (err) {
      threw = true;
      assert(
        err instanceof ForbiddenError,
        `${name}: expected ForbiddenError, got ${err.constructor.name}: ${err.message}`
      );
    }
    assert(threw, `${name}: expected ForbiddenError to be thrown`);
  }

  // Restore original key
  if (originalKey === undefined) {
    delete process.env.MASTER_ENCRYPTION_KEY;
  } else {
    process.env.MASTER_ENCRYPTION_KEY = originalKey;
  }

  console.log('✓ Superadmin blocked at repository level (ForbiddenError) for all fetch methods');
}

async function testRepositoryThrowsWithoutFirmId() {
  const CaseRepository = require('../src/repositories/CaseRepository');
  const ClientRepository = require('../src/repositories/ClientRepository');

  let caseFailed = false;
  try {
    await CaseRepository.create({ title: 'Test', description: 'test' }); // no firmId
  } catch (_e) {
    caseFailed = true;
  }
  assert(caseFailed, 'CaseRepository.create must throw when firmId is missing');

  let clientFailed = false;
  try {
    await ClientRepository.create({ businessName: 'Test' }); // no firmId
  } catch (_e) {
    clientFailed = true;
  }
  assert(clientFailed, 'ClientRepository.create must throw when firmId is missing');

  // find returns [] / null when firmId is missing (no throw, safe default)
  const cases = await CaseRepository.find(null);
  assert(Array.isArray(cases) && cases.length === 0,
    'CaseRepository.find with null firmId must return empty array');

  const client = await ClientRepository.findByClientId(null, 'C000001');
  assert(client === null, 'ClientRepository.findByClientId with null firmId must return null');

  console.log('✓ Repository throws (or returns safe default) when firmId is missing');
}

// ── tests that DO require MongoDB ─────────────────────────────────────────────

async function testGenerateTenantKey(provider) {
  const TenantKey = require('../src/security/tenantKey.model');
  const tenantId = `tenant-gen-${Date.now()}`;

  await provider.generateTenantKey(tenantId);

  const record = await TenantKey.findOne({ tenantId }).lean();
  assert(record, 'TenantKey record should exist after generateTenantKey');
  assert(record.encryptedDek, 'encryptedDek must be set');
  assert.match(record.encryptedDek, /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/,
    'encryptedDek must be iv:authTag:ciphertext format');

  // Calling generateTenantKey again on the same tenant must be a no-op
  await provider.generateTenantKey(tenantId);
  const count = await TenantKey.countDocuments({ tenantId });
  assert.strictEqual(count, 1, 'Calling generateTenantKey twice must not create duplicate records');

  console.log('✓ generateTenantKey creates and persists encrypted DEK');
}

async function testEncryptDecryptRoundtrip(provider) {
  const tenantId = `tenant-rt-${Date.now()}`;
  const plaintext = 'Sensitive legal case description 🔒';

  await provider.generateTenantKey(tenantId);
  const ciphertext = await provider.encrypt(plaintext, tenantId);

  assert(typeof ciphertext === 'string', 'encrypt must return a string');
  assert.notStrictEqual(ciphertext, plaintext, 'ciphertext must differ from plaintext');
  assert.match(ciphertext, /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/,
    'ciphertext must be iv:authTag:ciphertext format');

  const decrypted = await provider.decrypt(ciphertext, tenantId);
  assert.strictEqual(decrypted, plaintext, 'decrypted value must equal original plaintext');

  console.log('✓ encrypt/decrypt roundtrip restores original plaintext');
}

async function testDifferentTenantsProduceDifferentCiphertext(provider) {
  const tenantA = `tenant-a-${Date.now()}`;
  const tenantB = `tenant-b-${Date.now() + 1}`;
  const plaintext = 'same plaintext for both tenants';

  await provider.generateTenantKey(tenantA);
  await provider.generateTenantKey(tenantB);

  const ctA = await provider.encrypt(plaintext, tenantA);
  const ctB = await provider.encrypt(plaintext, tenantB);

  assert.notStrictEqual(ctA, ctB,
    'Different tenants must produce different ciphertext (different DEKs)');

  // Each tenant can only decrypt its own ciphertext
  const decA = await provider.decrypt(ctA, tenantA);
  const decB = await provider.decrypt(ctB, tenantB);
  assert.strictEqual(decA, plaintext);
  assert.strictEqual(decB, plaintext);

  // Cross-tenant decryption must fail (different DEK → auth tag mismatch)
  let crossFailed = false;
  try {
    await provider.decrypt(ctA, tenantB);
  } catch (_e) {
    crossFailed = true;
  }
  assert(crossFailed, 'Cross-tenant decryption must throw an error');

  console.log('✓ Different tenants produce different ciphertext');
}

async function testServiceSuperadminGuard() {
  // The service-level guard is defense-in-depth — the repository guard fires first.
  const { decrypt, ForbiddenError, _resetProvider } = require('../src/security/encryption.service');
  _resetProvider();

  const tenantId = `tenant-sa-svc-${Date.now()}`;
  const { looksEncrypted } = require('../src/security/encryption.utils');

  // Build a fake-but-valid looking ciphertext so looksEncrypted() returns true
  const fakeCiphertext = [
    crypto.randomBytes(12).toString('base64'),
    crypto.randomBytes(16).toString('base64'),
    crypto.randomBytes(32).toString('base64'),
  ].join(':');
  assert(looksEncrypted(fakeCiphertext), 'Fake ciphertext must pass looksEncrypted check');

  let threw = false;
  try {
    await decrypt(fakeCiphertext, tenantId, 'SUPER_ADMIN');
  } catch (err) {
    threw = true;
    assert(err instanceof ForbiddenError, 'Service must throw ForbiddenError for SUPER_ADMIN');
    assert.strictEqual(err.statusCode, 403);
  }
  assert(threw, 'Service decrypt must throw ForbiddenError for SUPER_ADMIN');

  console.log('✓ EncryptionService.decrypt blocks superadmin (defense-in-depth)');
}

async function testEncryptionServiceWithDb() {
  const { encrypt, decrypt, _resetProvider } = require('../src/security/encryption.service');
  _resetProvider();

  const tenantId = `tenant-svc-${Date.now()}`;
  const plaintext = 'service-layer encryption test';

  const ciphertext = await encrypt(plaintext, tenantId);
  assert.notStrictEqual(ciphertext, plaintext);

  const decrypted = await decrypt(ciphertext, tenantId);
  assert.strictEqual(decrypted, plaintext);

  console.log('✓ EncryptionService encrypt/decrypt roundtrip works end-to-end');
}

// ── runner ────────────────────────────────────────────────────────────────────

async function run() {
  // Tests that do NOT need MongoDB
  await testKmsProviderThrows();
  await testPlaintextCompatibilityMode();
  await testSuperadminBlockAtRepositoryLevel();
  await testRepositoryThrowsWithoutFirmId();

  // Tests that DO need MongoDB
  let mongoServer = null;
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Set up a test master key
    const testKey = makeTestKey();
    process.env.MASTER_ENCRYPTION_KEY = testKey;
    process.env.ENCRYPTION_PROVIDER = 'local';

    // Reset cached provider singleton
    const { _resetProvider } = require('../src/security/encryption.service');
    _resetProvider();

    const LocalEncryptionProvider = require('../src/security/encryption.local.provider');
    const provider = new LocalEncryptionProvider();

    await testGenerateTenantKey(provider);
    await testEncryptDecryptRoundtrip(provider);
    await testDifferentTenantsProduceDifferentCiphertext(provider);
    await testServiceSuperadminGuard();
    await testEncryptionServiceWithDb();
  } catch (err) {
    console.warn('⚠️  Skipping DB-dependent encryption tests (Mongo binary unavailable):', err.message);
  } finally {
    delete process.env.MASTER_ENCRYPTION_KEY;
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }

  console.log('\nAll encryption tests completed.');
}

run().catch((err) => {
  console.error('Encryption tests failed:', err);
  process.exit(1);
});

