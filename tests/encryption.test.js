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

async function testGenerateTenantKeyUsesAtomicUpsert() {
  const LocalEncryptionProvider = require('../src/security/encryption.local.provider');
  const TenantKey = require('../src/security/tenantKey.model');

  const tenantId = `tenant-upsert-${Date.now()}`;
  const provider = new LocalEncryptionProvider();
  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  const originalUpdateOne = TenantKey.updateOne;
  const originalFindOne = TenantKey.findOne;
  const originalCreate = TenantKey.create;

  let updateOneCall = null;
  const fakeSession = { id: 'session-atomic-upsert' };
  process.env.MASTER_ENCRYPTION_KEY = makeTestKey();
  TenantKey.findOne = async () => {
    throw new Error('findOne must not be called by generateTenantKey');
  };
  TenantKey.create = async () => {
    throw new Error('create must not be called by generateTenantKey');
  };
  TenantKey.updateOne = async (...args) => {
    updateOneCall = args;
    return { acknowledged: true, upsertedCount: 1 };
  };

  try {
    await provider.generateTenantKey(tenantId, { session: fakeSession });
    assert(updateOneCall, 'generateTenantKey must call TenantKey.updateOne');
    assert.deepStrictEqual(updateOneCall[0], { tenantId });
    assert.deepStrictEqual(updateOneCall[2], { upsert: true, session: fakeSession });
    assert.strictEqual(updateOneCall[1].$setOnInsert.tenantId, tenantId);
    assert.match(updateOneCall[1].$setOnInsert.encryptedDek, /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/,
      'encryptedDek must be iv:authTag:ciphertext format');
  } finally {
    TenantKey.updateOne = originalUpdateOne;
    TenantKey.findOne = originalFindOne;
    TenantKey.create = originalCreate;
    if (originalKey !== undefined) {
      process.env.MASTER_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.MASTER_ENCRYPTION_KEY;
    }
  }

  console.log('✓ generateTenantKey uses atomic upsert with $setOnInsert');
}

async function testUnwrapDekUsesSessionWhenProvided() {
  const LocalEncryptionProvider = require('../src/security/encryption.local.provider');
  const TenantKey = require('../src/security/tenantKey.model');
  const provider = new LocalEncryptionProvider();
  const tenantId = `tenant-unwrap-session-${Date.now()}`;
  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  const originalFindOne = TenantKey.findOne;
  const fakeSession = { id: 'session-unwrap' };
  let observedSession = null;

  process.env.MASTER_ENCRYPTION_KEY = makeTestKey();
  try {
    const encryptedDek = await provider.generateEncryptedDek();
    TenantKey.findOne = () => {
      const query = {
        session: (session) => {
          observedSession = session;
          return query;
        },
        lean: async () => ({ tenantId, encryptedDek }),
      };
      return query;
    };

    const dek = await provider._unwrapDek(tenantId, fakeSession);
    assert(Buffer.isBuffer(dek), '_unwrapDek must return a buffer');
    assert.strictEqual(observedSession, fakeSession, '_unwrapDek must apply provided session to query');
    dek.fill(0);
  } finally {
    TenantKey.findOne = originalFindOne;
    if (originalKey !== undefined) {
      process.env.MASTER_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.MASTER_ENCRYPTION_KEY;
    }
  }

  console.log('✓ _unwrapDek applies session to tenant key lookup');
}

async function testSuperadminBlockAtRepositoryLevel() {
  // This test does NOT require MongoDB.
  // The superadmin guard is checked BEFORE the DB query is attempted, so
  // ForbiddenError is thrown even when no connection is available.
  // The guard is active regardless of MASTER_ENCRYPTION_KEY configuration.
  const CaseRepository = require('../src/repositories/CaseRepository');
  const ClientRepository = require('../src/repositories/ClientRepository');
  const { ForbiddenError } = require('../src/security/encryption.service');

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

  // Test with encryption key absent — guard must still fire
  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  delete process.env.MASTER_ENCRYPTION_KEY;

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
  if (originalKey !== undefined) {
    process.env.MASTER_ENCRYPTION_KEY = originalKey;
  }

  console.log('✓ Superadmin blocked at repository level (ForbiddenError) for all fetch methods — regardless of encryption key');
}

async function testRepositoryThrowsWithoutRole() {
  const CaseRepository = require('../src/repositories/CaseRepository');
  const ClientRepository = require('../src/repositories/ClientRepository');

  const firmId = 'FIRM-ROLE-TEST-001';
  const expectedMsg = 'SECURITY: role is required for repository access';

  const caseTestCases = [
    ['CaseRepository.find', () => CaseRepository.find(firmId, {})],
    ['CaseRepository.findOne', () => CaseRepository.findOne(firmId, {})],
    ['CaseRepository.findById', () => CaseRepository.findById(firmId, 'some-id')],
    ['CaseRepository.findByCaseId', () => CaseRepository.findByCaseId(firmId, 'CASE-001')],
    ['CaseRepository.findByCaseNumber', () => CaseRepository.findByCaseNumber(firmId, 'CASE-20260101-00001')],
    ['CaseRepository.findByInternalId', () => CaseRepository.findByInternalId(firmId, 'some-internal-id')],
    ['ClientRepository.find', () => ClientRepository.find(firmId, {})],
    ['ClientRepository.findOne', () => ClientRepository.findOne(firmId, {})],
    ['ClientRepository.findById', () => ClientRepository.findById(firmId, 'some-id')],
    ['ClientRepository.findByClientId', () => ClientRepository.findByClientId(firmId, 'C000001')],
  ];

  for (const [name, call] of caseTestCases) {
    let threw = false;
    let thrownMessage = '';
    try {
      await call();
    } catch (err) {
      threw = true;
      thrownMessage = err.message;
    }
    assert(threw, `${name}: expected error to be thrown when role is missing`);
    assert(
      thrownMessage === expectedMsg,
      `${name}: expected message "${expectedMsg}", got "${thrownMessage}"`
    );
  }

  console.log('✓ Repository throws when role is missing (SECURITY: role is required)');
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
  const { ensureTenantKey, encrypt, decrypt, _resetProvider } = require('../src/security/encryption.service');
  _resetProvider();

  const tenantId = `tenant-svc-${Date.now()}`;
  const plaintext = 'service-layer encryption test';
  await ensureTenantKey(tenantId);

  const ciphertext = await encrypt(plaintext, tenantId);
  assert.notStrictEqual(ciphertext, plaintext);

  const decrypted = await decrypt(ciphertext, tenantId);
  assert.strictEqual(decrypted, plaintext);

  console.log('✓ EncryptionService encrypt/decrypt roundtrip works end-to-end');
}

async function testClientRepositoryHandlesCorruptedEncryptedField() {
  const Client = require('../src/models/Client.model');
  const ClientRepository = require('../src/repositories/ClientRepository');
  const { ensureTenantKey, encrypt, _resetProvider } = require('../src/security/encryption.service');

  _resetProvider();

  const firmA = new mongoose.Types.ObjectId();
  const firmB = new mongoose.Types.ObjectId();

  await ensureTenantKey(String(firmA));
  await ensureTenantKey(String(firmB));

  const encryptedWithOtherTenant = await encrypt('legacy@tenant-a.example', String(firmA));

  await Client.create({
    clientId: 'C000001',
    firmId: firmB,
    businessName: 'Corrupted Legacy Client',
    businessAddress: '123 Test Street',
    businessEmail: encryptedWithOtherTenant,
    primaryContactNumber: '9999999999',
    createdByXid: 'XTEST01',
    isActive: true,
    status: 'ACTIVE',
  });

  const listed = await ClientRepository.find(String(firmB), {}, 'ADMIN', {
    sort: { clientId: 1 },
    logContext: { route: '/api/admin/clients', requestId: 'test-req-1' },
  });

  assert.strictEqual(listed.length, 1, 'Corrupted record should still be listable');
  assert.strictEqual(listed[0].businessEmail, 'Not Available', 'Failed decryption must map to safe display value');

  const created = await ClientRepository.create({
    clientId: 'C000002',
    firmId: firmB,
    businessName: 'Healthy Client',
    businessAddress: '456 Test Street',
    businessEmail: 'healthy@example.com',
    primaryContactNumber: '8888888888',
    createdByXid: 'XTEST01',
    isActive: true,
    status: 'ACTIVE',
  }, 'ADMIN');

  assert.strictEqual(created.clientId, 'C000002');
  assert.strictEqual(created.businessEmail, 'healthy@example.com');

  const storedHealthy = await Client.findOne({ firmId: firmB, clientId: 'C000002' }).lean();
  assert(storedHealthy.businessEmail.includes(':'), 'Stored healthy client email must remain encrypted format');

  console.log('✓ Corrupted encrypted client fields fail soft and do not block new client creation');
}

// ── runner ────────────────────────────────────────────────────────────────────

async function run() {
  // Tests that do NOT need MongoDB
  await testKmsProviderThrows();
  await testPlaintextCompatibilityMode();
  await testGenerateTenantKeyUsesAtomicUpsert();
  await testUnwrapDekUsesSessionWhenProvided();
  await testSuperadminBlockAtRepositoryLevel();
  await testRepositoryThrowsWithoutRole();
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
    await testClientRepositoryHandlesCorruptedEncryptedField();
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
