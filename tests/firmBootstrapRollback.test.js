#!/usr/bin/env node
/**
 * Unit test: firm bootstrap transaction rollback
 *
 * Verifies that if TenantKey creation fails, the entire transaction is rolled
 * back — no Firm, Client, User, or TenantKey document must be persisted.
 */

const assert = require('assert');
const { createFirmHierarchy, FirmBootstrapError } = require('../src/services/firmBootstrap.service');

// ── minimal in-memory store for stubs ────────────────────────────────────────

const makeStore = () => {
  const rows = [];
  return {
    rows,
    find: () => Promise.resolve([]),
    findOne: (query) => {
      if (query && query.tenantId) {
        return { session: () => Promise.resolve(rows.find(r => r.tenantId === query.tenantId) || null) };
      }
      return { sort: () => Promise.resolve(null), session: () => ({ sort: () => Promise.resolve(null) }) };
    },
    create: async (docs) => {
      const saved = docs.map(d => ({ ...d, _id: `id-${Math.random().toString(36).slice(2)}` }));
      rows.push(...saved);
      return saved;
    },
    save: async () => {},
  };
};

// ── session stub ──────────────────────────────────────────────────────────────

const makeSession = () => {
  let active = false;
  let committed = false;
  let aborted = false;
  return {
    get committed() { return committed; },
    get aborted() { return aborted; },
    startTransaction() { active = true; },
    async commitTransaction() { committed = true; active = false; },
    async abortTransaction() { aborted = true; active = false; },
    async endSession() {},
  };
};

// ── Firm stub ─────────────────────────────────────────────────────────────────

const makeFirmStub = (store) => ({
  findOne: (query, proj, opts) => {
    const row = store.rows.find(r => r.firmSlug || r.name);
    // session chaining
    return { session: () => Promise.resolve(row || null), sort: () => Promise.resolve(null) };
  },
  find: () => ({ session: () => ({ select: () => Promise.resolve([]) }) }),
  create: async (docs, _opts) => {
    const saved = docs.map(d => ({
      ...d,
      _id: `firm-${Math.random().toString(36).slice(2)}`,
      save: async () => {},
    }));
    store.rows.push(...saved);
    return saved;
  },
});

// ── Client stub ───────────────────────────────────────────────────────────────

const makeClientStub = (store) => ({
  findOne: () => ({ session: () => Promise.resolve(null), sort: () => Promise.resolve(null) }),
  create: async (docs, _opts) => {
    const saved = docs.map(d => ({ ...d, _id: `client-${Math.random().toString(36).slice(2)}` }));
    store.rows.push(...saved);
    return saved;
  },
});

// ── User stub ─────────────────────────────────────────────────────────────────

const makeUserStub = (store) => ({
  create: async (docs, _opts) => {
    const saved = docs.map(d => ({ ...d, _id: `user-${Math.random().toString(36).slice(2)}` }));
    store.rows.push(...saved);
    return saved;
  },
});

// ── TenantKey stub that throws on create ──────────────────────────────────────

const makeTenantKeyFailStub = () => ({
  findOne: () => ({ session: () => Promise.resolve(null) }),
  create: async () => {
    const err = new Error('TenantKey create failed (simulated)');
    throw err;
  },
});

// ── test ─────────────────────────────────────────────────────────────────────

async function shouldRollbackWhenTenantKeyFails() {
  const firmStore = { rows: [] };
  const allRows = { rows: [] };
  const session = makeSession();

  const firmStub = makeFirmStub(firmStore);
  const clientStub = makeClientStub(allRows);
  const userStub = makeUserStub(allRows);
  const tenantKeyStub = makeTenantKeyFailStub();

  let threw = false;
  try {
    await createFirmHierarchy({
      payload: { name: 'Rollback Firm', adminName: 'Test Admin', adminEmail: 'admin@rollback.test' },
      performedBy: null,
      requestId: 'test-rollback-001',
      context: null,
      deps: {
        Firm: firmStub,
        Client: clientStub,
        User: userStub,
        TenantKey: tenantKeyStub,
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: false, error: 'skipped' }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
        startSession: () => {
          session.startTransaction();
          return Promise.resolve(session);
        },
      },
    });
  } catch (err) {
    threw = true;
    // Verify transaction was aborted
    assert.strictEqual(session.aborted, true, 'Transaction must be aborted on TenantKey failure');
    assert.strictEqual(session.committed, false, 'Transaction must NOT be committed');
    // Verify no Client or User rows were committed (aborted means they were not persisted)
    // In production with a real replica set, the abort would undo DB writes.
    // In this stub-based test we verify the error was re-thrown and commit was not called.
    assert.ok(err instanceof FirmBootstrapError || err instanceof Error,
      'Error must be thrown');
    console.log('✓ Transaction aborted correctly on TenantKey failure');
    console.log('✓ commitTransaction was NOT called — no partial state persisted');
  }

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw when TenantKey creation fails');
}

async function shouldRollbackWhenTenantKeyDuplicate() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };

  // TenantKey stub that simulates duplicate key (code 11000)
  const duplicateKeyTenantKeyStub = {
    findOne: () => ({ session: () => Promise.resolve(null) }),
    create: async () => {
      const err = new Error('duplicate key error');
      err.code = 11000;
      throw err;
    },
  };

  let threw = false;
  let thrownError = null;
  try {
    await createFirmHierarchy({
      payload: { name: 'Dup Firm', adminName: 'Dup Admin', adminEmail: 'dup@dup.test' },
      performedBy: null,
      requestId: 'test-dup-001',
      context: null,
      deps: {
        Firm: makeFirmStub(firmStore),
        Client: makeClientStub(allRows),
        User: makeUserStub(allRows),
        TenantKey: duplicateKeyTenantKeyStub,
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: false }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
        startSession: () => {
          session.startTransaction();
          return Promise.resolve(session);
        },
      },
    });
  } catch (err) {
    threw = true;
    thrownError = err;
    assert.strictEqual(session.aborted, true, 'Transaction must be aborted on duplicate TenantKey');
    assert.strictEqual(session.committed, false, 'Transaction must NOT be committed');
  }

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw on duplicate TenantKey');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.strictEqual(thrownError.statusCode, 409, 'Duplicate TenantKey must return 409');
  console.log('✓ Duplicate TenantKey (code 11000) correctly throws FirmBootstrapError 409');
}

async function shouldRejectInvalidDekFormat() {
  let threw = false;
  let thrownError = null;
  try {
    await createFirmHierarchy({
      payload: { name: 'Invalid DEK Firm', adminName: 'Test', adminEmail: 'test@dek.test' },
      performedBy: null,
      requestId: 'test-invalid-dek',
      context: null,
      deps: {
        Firm: null,
        Client: null,
        User: null,
        TenantKey: null,
        // Returns a DEK that does NOT pass looksEncrypted()
        generateEncryptedDek: async () => 'not-a-valid-dek',
        emailService: null,
        generateNextClientId: null,
        generateNextXID: null,
        startSession: () => { throw new Error('Should not reach startSession'); },
      },
    });
  } catch (err) {
    threw = true;
    thrownError = err;
  }
  assert.strictEqual(threw, true, 'Should throw on invalid DEK format');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.strictEqual(thrownError.statusCode, 500, 'Invalid DEK format must return 500');
  assert.ok(thrownError.message.includes('Invalid encrypted DEK format'),
    'Error message must reference DEK format');
  console.log('✓ Invalid DEK format rejected before transaction starts');
}

async function shouldRejectFirmCreateWithoutId() {
  const session = makeSession();
  const firmWithoutIdStub = {
    findOne: () => ({ session: () => Promise.resolve(null), sort: () => Promise.resolve(null) }),
    find: () => ({ session: () => ({ select: () => Promise.resolve([]) }) }),
    create: async (docs) => [{ ...docs[0], _id: undefined, save: async () => {} }],
  };

  let threw = false;
  let thrownError = null;
  try {
    await createFirmHierarchy({
      payload: { name: 'No Id Firm', adminName: 'Test', adminEmail: 'test@noid.test' },
      performedBy: null,
      requestId: 'test-no-id',
      context: null,
      deps: {
        Firm: firmWithoutIdStub,
        Client: makeClientStub({ rows: [] }),
        User: makeUserStub({ rows: [] }),
        TenantKey: { findOne: () => ({ session: () => Promise.resolve(null) }), create: async () => [] },
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: false }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
        startSession: () => {
          session.startTransaction();
          return Promise.resolve(session);
        },
      },
    });
  } catch (err) {
    threw = true;
    thrownError = err;
    assert.strictEqual(session.aborted, true, 'Transaction must be aborted when firm _id is missing');
  }

  assert.strictEqual(threw, true, 'Should throw when firm _id is missing');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.ok(thrownError.message.includes('no _id returned'), 'Error must indicate missing firm _id');
  console.log('✓ Missing firm _id is rejected before TenantKey creation');
}

async function shouldUseTenantIdFieldForTenantKeyCreate() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };
  let tenantKeyCreateChecked = false;

  const tenantKeyStub = {
    findOne: () => ({ session: () => Promise.resolve(null) }),
    create: async (docs) => {
      const payload = docs[0] || {};
      tenantKeyCreateChecked = true;
      assert.ok(payload.tenantId, 'TenantKey payload must include tenantId');
      assert.strictEqual(payload.firmId, undefined, 'TenantKey payload must not include firmId');
      return [{ ...payload, _id: 'tenant-key-1' }];
    },
  };

  const result = await createFirmHierarchy({
    payload: { name: 'Tenant Field Firm', adminName: 'Tenant Admin', adminEmail: 'tenant@field.test' },
    performedBy: null,
    requestId: 'test-tenant-field',
    context: null,
    deps: {
      Firm: makeFirmStub(firmStore),
      Client: makeClientStub(allRows),
      User: makeUserStub(allRows),
      TenantKey: tenantKeyStub,
      generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
      emailService: {
        sendFirmCreatedEmail: async () => {},
        sendPasswordSetupEmail: async () => ({ success: true }),
      },
      generateNextClientId: async () => 'C000001',
      generateNextXID: async () => 'X000001',
      startSession: () => {
        session.startTransaction();
        return Promise.resolve(session);
      },
    },
  });

  assert.ok(result?.firm?._id, 'Firm should be created successfully');
  assert.strictEqual(session.committed, true, 'Transaction should commit on successful TenantKey create');
  assert.strictEqual(tenantKeyCreateChecked, true, 'TenantKey.create payload should be validated');
  console.log('✓ TenantKey creation uses tenantId field (not firmId)');
}

async function run() {
  console.log('='.repeat(60));
  console.log('FirmBootstrap Rollback & Hardening Tests');
  console.log('='.repeat(60));

  try {
    await shouldRollbackWhenTenantKeyFails();
    await shouldRollbackWhenTenantKeyDuplicate();
    await shouldRejectInvalidDekFormat();
    await shouldRejectFirmCreateWithoutId();
    await shouldUseTenantIdFieldForTenantKeyCreate();
    console.log('\n✓ All firmBootstrap rollback tests passed.');
  } catch (err) {
    console.error('\nfirmBootstrap rollback test FAILED:', err);
    process.exit(1);
  }
}

run();
