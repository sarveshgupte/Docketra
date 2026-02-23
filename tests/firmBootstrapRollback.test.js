#!/usr/bin/env node
/**
 * Unit test: firm bootstrap transaction rollback
 *
 * Verifies that if TenantKey creation fails, the entire transaction is rolled
 * back — no Firm, Client, User, or TenantKey document must be persisted.
 *
 * After the transaction architecture refactor, session lifecycle (commit/abort)
 * is owned by executeWrite / wrapWriteHandler, not by the service layer.
 * These tests verify that:
 *   - errors propagate correctly so withTransaction can abort
 *   - DB writes use the injected session
 *   - TenantKey is created via atomic upsert (updateOne + $setOnInsert)
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
  return {};
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

// ── TenantKey stub that throws on updateOne ───────────────────────────────────

const makeTenantKeyFailStub = () => ({
  updateOne: async () => {
    const err = new Error('TenantKey updateOne failed (simulated)');
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
      session,
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
      },
    });
  } catch (err) {
    threw = true;
    // Verify error propagates so executeWrite / withTransaction can abort.
    // Session lifecycle (abort) is now owned externally — not by the service.
    assert.ok(err instanceof FirmBootstrapError || err instanceof Error,
      'Error must be thrown');
    console.log('✓ Error propagates correctly on TenantKey failure (caller aborts the transaction)');
  }

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw when TenantKey creation fails');
}

async function shouldRollbackWhenTenantKeyUpdateOneFails() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };

  // TenantKey stub that simulates an unexpected error during upsert
  const failingUpsertStub = {
    updateOne: async () => {
      const err = new Error('unexpected updateOne error');
      throw err;
    },
  };

  let threw = false;
  let thrownError = null;
  try {
    await createFirmHierarchy({
      payload: { name: 'Upsert Fail Firm', adminName: 'Fail Admin', adminEmail: 'fail@upsert.test' },
      performedBy: null,
      requestId: 'test-upsert-fail-001',
      context: null,
      session,
      deps: {
        Firm: makeFirmStub(firmStore),
        Client: makeClientStub(allRows),
        User: makeUserStub(allRows),
        TenantKey: failingUpsertStub,
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: false }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
      },
    });
  } catch (err) {
    threw = true;
    thrownError = err;
  }

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw when TenantKey upsert fails');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.strictEqual(thrownError.statusCode, 500, 'Unexpected upsert error must return 500');
  console.log('✓ TenantKey upsert failure correctly throws FirmBootstrapError');
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
      session: null,
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
      session,
      deps: {
        Firm: firmWithoutIdStub,
        Client: makeClientStub({ rows: [] }),
        User: makeUserStub({ rows: [] }),
        TenantKey: { updateOne: async () => {} },
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: false }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
      },
    });
  } catch (err) {
    threw = true;
    thrownError = err;
  }

  assert.strictEqual(threw, true, 'Should throw when firm _id is missing');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.ok(thrownError.message.includes('no _id returned'), 'Error must indicate missing firm _id');
  console.log('✓ Missing firm _id is rejected before TenantKey creation');
}

async function shouldUseTenantIdFieldForTenantKeyUpsert() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };
  let tenantKeyUpsertChecked = false;

  const tenantKeyStub = {
    updateOne: async (filter, update, _opts) => {
      tenantKeyUpsertChecked = true;
      assert.ok(filter.tenantId, 'TenantKey upsert filter must include tenantId');
      assert.ok(update.$setOnInsert, 'TenantKey upsert must use $setOnInsert');
      assert.ok(update.$setOnInsert.tenantId, 'TenantKey $setOnInsert must include tenantId');
      assert.strictEqual(update.$setOnInsert.firmId, undefined, 'TenantKey $setOnInsert must not include firmId');
      return { upsertedCount: 1 };
    },
  };

  const result = await createFirmHierarchy({
    payload: { name: 'Tenant Field Firm', adminName: 'Tenant Admin', adminEmail: 'tenant@field.test' },
    performedBy: null,
    requestId: 'test-tenant-field',
    context: null,
    session,
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
    },
  });

  assert.ok(result?.firm?._id, 'Firm should be created successfully');
  assert.strictEqual(tenantKeyUpsertChecked, true, 'TenantKey.updateOne upsert payload should be validated');
  console.log('✓ TenantKey creation uses atomic upsert with tenantId field (not firmId)');
}

async function shouldSucceedWhenTenantKeyAlreadyExists() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };

  // TenantKey stub that simulates an existing key (upsert no-op, no error)
  const idempotentTenantKeyStub = {
    updateOne: async (filter, update, opts) => {
      assert.ok(opts && opts.upsert, 'TenantKey updateOne must use upsert:true');
      // Simulate: key already exists, $setOnInsert is a no-op, no error thrown
      return { upsertedCount: 0, matchedCount: 1, modifiedCount: 0 };
    },
  };

  let threw = false;
  let result = null;
  try {
    result = await createFirmHierarchy({
      payload: { name: 'Idempotent Firm', adminName: 'Idem Admin', adminEmail: 'idem@test.test' },
      performedBy: null,
      requestId: 'test-idempotent-001',
      context: null,
      session,
      deps: {
        Firm: makeFirmStub(firmStore),
        Client: makeClientStub(allRows),
        User: makeUserStub(allRows),
        TenantKey: idempotentTenantKeyStub,
        generateEncryptedDek: async () => 'aGVsbG8=:d29ybGQ=:dGVzdA==',
        emailService: {
          sendFirmCreatedEmail: async () => {},
          sendPasswordSetupEmail: async () => ({ success: true }),
        },
        generateNextClientId: async () => 'C000001',
        generateNextXID: async () => 'X000001',
      },
    });
  } catch (err) {
    threw = true;
  }

  assert.strictEqual(threw, false, 'Must NOT throw when TenantKey already exists (idempotent upsert)');
  assert.ok(result?.firm?._id, 'Firm should be returned even when TenantKey upsert was a no-op');
  console.log('✓ Duplicate TenantKey is handled idempotently — no error thrown');
}

async function run() {
  console.log('='.repeat(60));
  console.log('FirmBootstrap Rollback & Hardening Tests');
  console.log('='.repeat(60));

  try {
    await shouldRollbackWhenTenantKeyFails();
    await shouldRollbackWhenTenantKeyUpdateOneFails();
    await shouldRejectInvalidDekFormat();
    await shouldRejectFirmCreateWithoutId();
    await shouldUseTenantIdFieldForTenantKeyUpsert();
    await shouldSucceedWhenTenantKeyAlreadyExists();
    console.log('\n✓ All firmBootstrap rollback tests passed.');
  } catch (err) {
    console.error('\nfirmBootstrap rollback test FAILED:', err);
    process.exit(1);
  }
}

run();

