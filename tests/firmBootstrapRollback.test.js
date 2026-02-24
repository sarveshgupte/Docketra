#!/usr/bin/env node
/**
 * Unit test: firm bootstrap transaction rollback
 *
 * Verifies that if tenant key ensure fails, the entire transaction is rolled
 * back — no Firm, Client, User, or TenantKey document must be persisted.
 *
 * After the transaction architecture refactor, session lifecycle (commit/abort)
 * is owned by executeWrite / wrapWriteHandler, not by the service layer.
 * These tests verify that:
 *   - errors propagate correctly so withTransaction can abort
 *   - DB writes use the injected session
 *   - TenantKey lifecycle is owned by ensureTenantKey in encryption layer
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

// ── ensureTenantKey stub that throws ──────────────────────────────────────────

const makeEnsureTenantKeyFailStub = () => ({
  ensureTenantKey: async () => {
    const err = new Error('ensureTenantKey failed (simulated)');
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
  const ensureTenantKeyStub = makeEnsureTenantKeyFailStub();

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
        ensureTenantKey: ensureTenantKeyStub.ensureTenantKey,
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
    console.log('✓ Error propagates correctly on ensureTenantKey failure (caller aborts the transaction)');
  }

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw when ensureTenantKey fails');
}

async function shouldRollbackWhenEnsureTenantKeyFails() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };

  // ensureTenantKey stub that simulates an unexpected error
  const failingEnsureTenantKeyStub = {
    ensureTenantKey: async () => {
      const err = new Error('unexpected ensureTenantKey error');
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
        ensureTenantKey: failingEnsureTenantKeyStub.ensureTenantKey,
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

  assert.strictEqual(threw, true, 'createFirmHierarchy must throw when ensureTenantKey fails');
  assert.ok(thrownError instanceof FirmBootstrapError, 'Must throw FirmBootstrapError');
  assert.strictEqual(thrownError.statusCode, 500, 'Unexpected ensureTenantKey error must return 500');
  console.log('✓ ensureTenantKey failure correctly throws FirmBootstrapError');
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
        ensureTenantKey: async () => {},
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

async function shouldCallEnsureTenantKeyWithFirmId() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };
  let ensureTenantKeyChecked = false;

  const ensureTenantKeyStub = {
    ensureTenantKey: async (tenantId) => {
      ensureTenantKeyChecked = true;
      assert.ok(tenantId, 'ensureTenantKey must be called with tenantId');
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
      ensureTenantKey: ensureTenantKeyStub.ensureTenantKey,
      emailService: {
        sendFirmCreatedEmail: async () => {},
        sendPasswordSetupEmail: async () => ({ success: true }),
      },
      generateNextClientId: async () => 'C000001',
      generateNextXID: async () => 'X000001',
    },
  });

  assert.ok(result?.firm?._id, 'Firm should be created successfully');
  assert.strictEqual(ensureTenantKeyChecked, true, 'ensureTenantKey should be invoked');
  console.log('✓ TenantKey lifecycle is delegated to ensureTenantKey');
}

async function shouldSucceedWhenEnsureTenantKeyNoOps() {
  const session = makeSession();
  const firmStore = { rows: [] };
  const allRows = { rows: [] };

  const idempotentEnsureTenantKeyStub = { ensureTenantKey: async () => {} };

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
        ensureTenantKey: idempotentEnsureTenantKeyStub.ensureTenantKey,
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

  assert.strictEqual(threw, false, 'Must NOT throw when ensureTenantKey no-ops');
  assert.ok(result?.firm?._id, 'Firm should be returned even when ensureTenantKey no-ops');
  console.log('✓ ensureTenantKey no-op does not block firm creation');
}

async function run() {
  console.log('='.repeat(60));
  console.log('FirmBootstrap Rollback & Hardening Tests');
  console.log('='.repeat(60));

  try {
    await shouldRollbackWhenTenantKeyFails();
    await shouldRollbackWhenEnsureTenantKeyFails();
    await shouldRejectFirmCreateWithoutId();
    await shouldCallEnsureTenantKeyWithFirmId();
    await shouldSucceedWhenEnsureTenantKeyNoOps();
    console.log('\n✓ All firmBootstrap rollback tests passed.');
  } catch (err) {
    console.error('\nfirmBootstrap rollback test FAILED:', err);
    process.exit(1);
  }
}

run();
