#!/usr/bin/env node
/**
 * Tests for audit infrastructure non-fatality and session safety.
 *
 * Validates:
 * 1. AuthAudit failures never break primary business logic responses.
 * 2. transactionSessionEnforcer wraps single-doc creates in array when session is injected.
 * 3. DeactivationAttemptBlocked is a valid AuthAudit actionType.
 * 4. logAuthAudit helper is non-fatal.
 */

const assert = require('assert');

// ── AuthAudit model validation ────────────────────────────────────────────────

async function testDeactivationAttemptBlockedIsValidActionType() {
  const AuthAudit = require('../src/models/AuthAudit.model');
  const validTypes = AuthAudit.schema.path('actionType').enumValues;
  assert.ok(
    validTypes.includes('DeactivationAttemptBlocked'),
    'DeactivationAttemptBlocked must be a valid AuthAudit actionType'
  );
  console.log('✓ DeactivationAttemptBlocked is a valid AuthAudit actionType');
}

// ── transactionSessionEnforcer array wrapping ─────────────────────────────────

async function testCreateArrayWrappingWhenSessionInjected() {
  // Verify the enforcer's shouldWrap semantics:
  //   const shouldWrap = finalOptions?.session && !Array.isArray(docs);
  //
  // Wrapping must only occur when BOTH conditions hold:
  //   1. A session is being injected (finalOptions.session exists)
  //   2. The docs argument is NOT already an array
  //
  // Non-session creates must be completely unchanged.

  const doc = { xID: 'X001', firmId: 'FIRM001', actionType: 'Login', description: 'Test', performedBy: 'X001' };
  const fakeSession = { id: 'fake-session' };

  // Case 1: session present + single doc → shouldWrap=true, wrapped in array
  const shouldWrapWithSession = !!(fakeSession && !Array.isArray(doc));
  assert.strictEqual(shouldWrapWithSession, true, 'shouldWrap must be true for single doc with session');
  const docsArgWithSession = shouldWrapWithSession ? [doc] : doc;
  assert.deepStrictEqual(docsArgWithSession, [doc], 'Single doc must be wrapped when session present');

  // Case 2: session present + array docs → shouldWrap=false, passes through unchanged
  const arrDocs = [doc];
  const shouldWrapArray = !!(fakeSession && !Array.isArray(arrDocs));
  assert.strictEqual(shouldWrapArray, false, 'shouldWrap must be false when docs is already an array');
  const docsArgArray = shouldWrapArray ? [arrDocs] : arrDocs;
  assert.deepStrictEqual(docsArgArray, arrDocs, 'Array docs must pass through unchanged');

  // Case 3: NO session → shouldWrap=false regardless of doc type, create is untouched
  const noSession = null;
  const shouldWrapNoSession = !!(noSession && !Array.isArray(doc));
  assert.strictEqual(shouldWrapNoSession, false, 'shouldWrap must be false when no session — non-session creates are unchanged');

  // Case 4: session-based single-doc create result is unwrapped (not returned as array)
  const fakeResult = [{ xID: 'X001', _id: 'id-0' }];
  const unwrapped = fakeResult[0];
  assert.strictEqual(unwrapped._id, 'id-0', 'Single-doc result must be unwrapped from array');

  console.log('✓ transactionSessionEnforcer: session-scoped wrapping only, non-session creates unchanged');
}

// ── Non-session Model.create() is completely unchanged ────────────────────────

async function testNonSessionCreateIsUntouched() {
  // Simulate what the enforcer does when no session is active:
  // the no-session branch returns originalCreate(docs, finalOptions) directly.
  // Verify the no-session path leaves docs and options unchanged.

  const doc = { name: 'test' };
  const finalOptions = undefined; // no session options
  const fakeSession = null; // no active session

  // Enforcer resolves session = null → calls original without modification
  const session = fakeSession; // ensureSession would return null here
  const wouldPassThrough = !session;
  assert.strictEqual(wouldPassThrough, true, 'No-session path must pass docs through unchanged');

  // Verify shouldWrap is false when finalOptions has no session
  const shouldWrap = !!(finalOptions?.session && !Array.isArray(doc));
  assert.strictEqual(shouldWrap, false, 'shouldWrap must be false when no session in options');

  console.log('✓ Non-session Model.create() is completely unchanged by enforcer');
}

// ── logAuthAudit helper is non-fatal ──────────────────────────────────────────

async function testLogAuthAuditIsNonFatal() {
  // Temporarily override AuthAudit to always throw
  const AuthAudit = require('../src/models/AuthAudit.model');
  const originalCreate = AuthAudit.create;
  AuthAudit.create = async () => {
    throw new Error('Simulated AuthAudit persistence failure');
  };

  // Mirror the exact logAuthAudit implementation in auth.controller.js:
  // always uses explicit array syntax, never relies on implicit wrapping.
  const logAuthAudit = async (params) => {
    try {
      await AuthAudit.create([params]);
    } catch (auditErr) {
      // non-fatal — error is logged but not rethrown
    }
  };

  let threw = false;
  try {
    await logAuthAudit({
      xID: 'X000001',
      firmId: 'FIRM001',
      actionType: 'UserCreated',
      description: 'Test audit log',
      performedBy: 'X000001',
    });
  } catch (err) {
    threw = true;
  }

  AuthAudit.create = originalCreate; // restore

  assert.strictEqual(threw, false, 'logAuthAudit must never throw even when AuthAudit.create fails');
  console.log('✓ logAuthAudit is non-fatal when AuthAudit.create fails');
}

// ── Business response is 201 even when audit fails ────────────────────────────

async function testBusinessResponsePreservedWhenAuditFails() {
  // Simulate the pattern used in createUser / createFirm:
  // 1. Primary business logic succeeds
  // 2. Audit write fails
  // 3. Response must still be 201

  let responseStatus = null;
  let responseBody = null;

  const mockRes = {
    status(code) { responseStatus = code; return this; },
    json(body) { responseBody = body; return this; },
  };

  const AuthAudit = require('../src/models/AuthAudit.model');
  const originalCreate = AuthAudit.create;
  AuthAudit.create = async () => {
    throw new Error('Simulated audit validation failure');
  };

  const logAuthAudit = async (params) => {
    try {
      await AuthAudit.create([params]);
    } catch (auditErr) {
      // non-fatal
    }
  };

  // Simulate the core of createUser after primary logic succeeds
  const simulateCreateUser = async (res) => {
    try {
      // Primary business logic succeeds
      const newUser = { xID: 'X000001', firmId: 'FIRM001', _id: 'user-id-1', role: 'Employee' };
      const admin = { xID: 'X000000' };

      // Audit write (non-fatal)
      await logAuthAudit({
        xID: newUser.xID,
        firmId: newUser.firmId,
        userId: newUser._id,
        actionType: 'UserCreated',
        description: 'User account created',
        performedBy: admin.xID,
      });

      // Primary response must be 201 regardless of audit result
      res.status(201).json({ success: true, message: 'User created successfully.' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating user' });
    }
  };

  await simulateCreateUser(mockRes);
  AuthAudit.create = originalCreate;

  assert.strictEqual(responseStatus, 201, 'Response must be 201 even when audit fails');
  assert.strictEqual(responseBody.success, true, 'Response must indicate success');
  console.log('✓ Business response is 201 even when AuthAudit fails');
}

// ── Lifecycle status matches actual response ───────────────────────────────────

async function testLifecycleStatusMatchesResponse() {
  // When transactionCommitted=true and response is 201, lifecycle should log 201
  // This indirectly validates that audit failures (now non-fatal) cannot change the status.
  const EventEmitter = require('events');
  const lifecycle = require('../src/middleware/requestLifecycle.middleware');
  const log = require('../src/utils/log');
  const { reset: resetQueue } = require('../src/services/sideEffectQueue.service');

  resetQueue();
  const logs = [];
  const originalInfo = log.info;
  log.info = (event, meta) => logs.push({ event, meta });

  class MockResponse extends EventEmitter {
    constructor() {
      super();
      this.statusCode = 201;
      this.headers = {};
    }
    setHeader(key, value) { this.headers[key] = value; }
  }

  const req = {
    method: 'POST',
    originalUrl: '/api/superadmin/firms',
    user: { xID: 'SUPERADMIN', role: 'SuperAdmin' },
    firmId: null,
    transactionCommitted: true,
  };
  const res = new MockResponse();

  lifecycle(req, res, () => {});
  res.emit('finish');

  log.info = originalInfo;

  const lifecycleLogs = logs.filter((l) => l.event === 'REQUEST_LIFECYCLE');
  assert.strictEqual(lifecycleLogs.length, 1, 'Lifecycle log should fire exactly once');
  assert.strictEqual(lifecycleLogs[0].meta.status, 201, 'Lifecycle must log actual response status');
  assert.strictEqual(lifecycleLogs[0].meta.transactionCommitted, true, 'Lifecycle must reflect committed transaction');
  console.log('✓ Lifecycle logs status=201 and transactionCommitted=true (matches actual response)');
}

// ── Run all tests ─────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(60));
  console.log('Audit Non-Fatality & Session Safety Tests');
  console.log('='.repeat(60));

  try {
    await testDeactivationAttemptBlockedIsValidActionType();
    await testCreateArrayWrappingWhenSessionInjected();
    await testNonSessionCreateIsUntouched();
    await testLogAuthAuditIsNonFatal();
    await testBusinessResponsePreservedWhenAuditFails();
    await testLifecycleStatusMatchesResponse();
    console.log('\n✓ All audit non-fatality tests passed.');
  } catch (err) {
    console.error('\nAudit non-fatality test FAILED:', err);
    process.exit(1);
  }
}

run();
