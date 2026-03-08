#!/usr/bin/env node
const assert = require('assert');
const { idempotencyMiddleware, resetIdempotencyCache } = require('../src/middleware/idempotency.middleware');
const domainInvariantGuard = require('../src/middleware/domainInvariantGuard');
const { executeWrite } = require('../src/utils/executeWrite');
const wrapWriteHandler = require('../src/middleware/wrapWriteHandler');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (this.statusCode == null) {
        this.statusCode = 200;
      }
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
};

const runMiddleware = (middleware, req, res) => new Promise((resolve, reject) => {
  middleware(req, res, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });
});

const buildRequest = (overrides = {}) => {
  const headers = { 'Idempotency-Key': 'k', ...(overrides.headers || {}) };
  const req = {
    method: 'POST',
    originalUrl: '/api/cases',
    body: { title: 'A' },
    firmId: 'FIRM001',
    user: { _id: 'u1' },
    headers,
    get: (key) => {
      if (typeof key !== 'string') return undefined;
      const normalized = key.toLowerCase();
      const direct = headers[key] ?? headers[normalized];
      if (direct !== undefined) return direct;
      if (normalized === 'idempotency-key') {
        return headers['Idempotency-Key'] ?? headers['idempotency-key'];
      }
      return undefined;
    },
    ...overrides,
  };
  return req;
};

async function testIdempotentReplay() {
  resetIdempotencyCache();
  let handlerInvocations = 0;
  const reqA = buildRequest({ headers: { 'Idempotency-Key': 'k1' } });
  const resA = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqA, resA);
  handlerInvocations += 1;
  reqA.transactionCommitted = true;
  resA.json({ ok: true });

  const reqB = buildRequest({ headers: { 'Idempotency-Key': 'k1' } });
  const resB = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqB, resB);

  assert.strictEqual(handlerInvocations, 1, 'Handler should not re-run on replay');
  assert.strictEqual(resB.headers['Idempotent-Replay'], 'true');
  assert.strictEqual(resB.body.ok, true);
}

async function testConcurrentFingerprintConflict() {
  resetIdempotencyCache();
  const reqA = buildRequest({ headers: { 'Idempotency-Key': 'k2' }, body: { title: 'A' } });
  const resA = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqA, resA);
  reqA.transactionCommitted = true;
  resA.json({ ok: true });

  const reqB = buildRequest({ headers: { 'Idempotency-Key': 'k2' }, body: { title: 'B' } });
  const resB = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqB, resB);
  assert.strictEqual(resB.statusCode, 409, 'Conflicting fingerprint should be rejected');
}

async function testRetryAfterDelay() {
  resetIdempotencyCache();
  const req = buildRequest({ method: 'PATCH', originalUrl: '/api/clients/1', body: { name: 'X' }, headers: { 'Idempotency-Key': 'k3' } });
  const res = createMockRes();
  await runMiddleware(idempotencyMiddleware, req, res);
  await new Promise((resolve) => setTimeout(resolve, 10));
  req.transactionCommitted = true;
  res.json({ ok: true });

  const resRetry = createMockRes();
  await runMiddleware(idempotencyMiddleware, req, resRetry);
  assert.strictEqual(resRetry.body.ok, true);
}

async function testCrossFirmGuard() {
  const req = { method: 'POST', firmId: 'FIRM001', body: { firmId: 'FIRM002' } };
  const res = createMockRes();
  await runMiddleware(domainInvariantGuard, req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.error, 'cross_firm_access_denied');
}

async function testInvalidStateGuard() {
  const req = { method: 'PATCH', body: { previousStatus: 'CLOSED', status: 'IN_PROGRESS' } };
  const res = createMockRes();
  await runMiddleware(domainInvariantGuard, req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'invalid_state_transition');
}

async function testExecuteWriteEnforcesTransaction() {
  const mongoose = require('mongoose');

  // Test skipTransaction path — no DB needed
  const skipReq = { skipTransaction: true };
  const skipResult = await executeWrite(skipReq, async () => 'skip');
  assert.strictEqual(skipResult, 'skip');
  assert.strictEqual(skipReq.transactionSkipped, true, 'Skip transactions should mark skipped for idempotency');

  // Test successful transaction with a mocked session
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  });
  try {
    const req = {};
    const result = await executeWrite(req, async () => 'ok');
    assert.strictEqual(result, 'ok');
    assert.strictEqual(req.transactionCommitted, true, 'Commit flag should be set after successful transaction');
  } finally {
    mongoose.startSession = originalStartSession;
  }
}

async function testExecuteWriteAllowsMissingTransactionSession() {
  const mongoose = require('mongoose');
  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => {
    throw new Error('sessions unavailable');
  };

  try {
    const req = {};
    const result = await executeWrite(req, async (session) => {
      assert.strictEqual(session, null, 'handler should receive a null session when transactions are unavailable');
      return { ok: true };
    });
    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual(req.transactionSkipped, true, 'request should continue without a transaction');
    assert.strictEqual(req.transactionCommitted, false);
  } finally {
    mongoose.startSession = originalStartSession;
  }
}

async function testExecuteWriteRollsBackErrorResponses() {
  const mongoose = require('mongoose');
  const originalStartSession = mongoose.startSession;
  let ended = 0;
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      await fn();
    },
    endSession: async () => {
      ended += 1;
    },
  });

  try {
    const req = {
      _transactionResponse: {
        statusCode: 400,
      },
    };
    const result = await executeWrite(req, async () => ({ success: false, statusCode: 400, message: 'bad request' }));
    assert.strictEqual(result.success, false);
    assert.strictEqual(req.transactionCommitted, false, 'error responses must not mark the transaction as committed');
    assert.strictEqual(ended, 1, 'session should always be ended');
  } finally {
    mongoose.startSession = originalStartSession;
  }
}

async function testIdempotencySkipsCacheOnRollback() {
  resetIdempotencyCache();
  let handlerRuns = 0;
  const mongoose = require('mongoose');
  const originalStartSession = mongoose.startSession;

  const makeReq = () => buildRequest({
    headers: { 'Idempotency-Key': 'k4' },
    transactionCommitted: false,
  });

  // Simulate a failing transaction: withTransaction throws after the handler runs
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => {
      await fn();
      throw new Error('fail-before-commit');
    },
    endSession: async () => {},
  });
  const failingReq = makeReq();
  const res1 = createMockRes();
  await runMiddleware(idempotencyMiddleware, failingReq, res1);
  try {
    await executeWrite(failingReq, async () => {
      handlerRuns += 1;
      res1.json({ ok: true });
      throw new Error('fail-after-json');
    });
  } catch (err) {
    // expected
  }
  assert.strictEqual(failingReq.transactionCommitted, false, 'Commit flag should remain false on rollback');

  // Simulate a successful transaction
  mongoose.startSession = async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  });
  const successReq = makeReq();
  const res2 = createMockRes();
  await runMiddleware(idempotencyMiddleware, successReq, res2);
  await executeWrite(successReq, async () => {
    handlerRuns += 1;
    res2.json({ ok: true });
  });

  mongoose.startSession = originalStartSession;

  assert.strictEqual(handlerRuns, 2, 'Handler should run again after rollback');
  assert.strictEqual(res2.headers['Idempotent-Replay'], undefined, 'Replay header should not be set after rollback');
  assert.strictEqual(successReq.transactionCommitted, true, 'Commit flag should be true after successful transaction');
}

async function testControllerGuardWithoutTransaction() {
  const { createUser } = require('../src/controllers/user.controller');
  let nextError = null;
  const req = {};
  const res = createMockRes();
  const next = (err) => { nextError = err; };

  // With no DB connection, executeWrite (called by wrapWriteHandler) will fail
  // and wrapWriteHandler must pass the error to next() — never throw unhandled.
  await createUser(req, res, next);

  assert.ok(nextError, 'Mutating controller should pass error to next when DB is unavailable');
}

async function testNestedWrapperGuard() {
  let nextError = null;
  const handler = wrapWriteHandler(async () => ({ success: true }));
  const req = { transactionSession: { session: {} } };
  const res = createMockRes();
  const next = (err) => { nextError = err; };

  await handler(req, res, next);
  assert.ok(nextError, 'Nested wrapper should forward an error');
  assert.strictEqual(nextError.message, 'Nested transaction wrapper detected');
}

async function run() {
  try {
    await testIdempotentReplay();
    await testConcurrentFingerprintConflict();
    await testRetryAfterDelay();
    await testCrossFirmGuard();
    await testInvalidStateGuard();
    await testExecuteWriteEnforcesTransaction();
    await testExecuteWriteAllowsMissingTransactionSession();
    await testExecuteWriteRollsBackErrorResponses();
    await testIdempotencySkipsCacheOnRollback();
    await testControllerGuardWithoutTransaction();
    await testNestedWrapperGuard();
    console.log('Write safety tests passed.');
  } catch (err) {
    console.error('Write safety tests failed:', err);
    process.exit(1);
  }
}

run();
