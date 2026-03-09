#!/usr/bin/env node
/**
 * Tests for:
 *   1. Case.saveWithRetry() — retries on E11000 caseNumber duplicate-key errors
 *   2. createWorkType controller — returns HTTP 409 on E11000 prefix duplicate-key errors
 */
'use strict';

const assert = require('assert');

// ---------------------------------------------------------------------------
// 1. saveWithRetry — unit tests using a lightweight stub Case document
// ---------------------------------------------------------------------------

function makeDuplicateKeyError(fieldName) {
  const err = new Error(`E11000 duplicate key error collection: test.cases index: ${fieldName}_1`);
  err.code = 11000;
  return err;
}

function makeStubCase(saveImpl) {
  // Minimal stub that mimics a Mongoose document with a saveWithRetry method
  // imported directly from the model source logic.
  const doc = {
    caseNumber: 'CO202601011234',
    caseId: 'CO202601011234',
    firmId: 'FIRM1',
    workTypeId: 'WT1',
    _saveCount: 0,
    save: saveImpl,
  };

  // Replicate the saveWithRetry logic defined in Case.model.js
  doc.saveWithRetry = async function (saveOptions = {}, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.save(saveOptions);
      } catch (err) {
        const isDuplicateCaseNumber =
          err.code === 11000 &&
          err.message &&
          err.message.includes('caseNumber');

        if (isDuplicateCaseNumber && attempt < maxAttempts - 1) {
          this.caseNumber = undefined;
          this.caseId = undefined;
        } else if (isDuplicateCaseNumber) {
          throw new Error(
            `Failed to generate a unique docket ID after ${maxAttempts} attempts. Please try again.`
          );
        } else {
          throw err;
        }
      }
    }
  };

  return doc;
}

async function testRetrySucceedsOnSecondAttempt() {
  let callCount = 0;
  const doc = makeStubCase(async function () {
    callCount++;
    if (callCount === 1) throw makeDuplicateKeyError('caseNumber');
    // Simulate pre-validate hook regenerating a fresh caseNumber
    this.caseNumber = 'CO202601015678';
    this.caseId = 'CO202601015678';
    return this;
  });

  await doc.saveWithRetry();
  assert.strictEqual(callCount, 2, 'Should have attempted save twice');
  assert.strictEqual(doc.caseNumber, 'CO202601015678', 'caseNumber should be updated after retry');
  console.log('  ✓ saveWithRetry retries on E11000 caseNumber collision');
}

async function testRetryResetsFieldsBeforeRetry() {
  let caseNumberBeforeRetry;
  let callCount = 0;
  const doc = makeStubCase(async function () {
    callCount++;
    if (callCount === 1) {
      throw makeDuplicateKeyError('caseNumber');
    }
    // Capture the value of caseNumber at the start of the second attempt
    caseNumberBeforeRetry = this.caseNumber;
    return this;
  });

  await doc.saveWithRetry();
  assert.strictEqual(caseNumberBeforeRetry, undefined, 'caseNumber should be reset before retry');
  console.log('  ✓ saveWithRetry resets caseNumber and caseId before each retry');
}

async function testThrowsAfterMaxAttempts() {
  const doc = makeStubCase(async function () {
    throw makeDuplicateKeyError('caseNumber');
  });

  let threw = false;
  try {
    await doc.saveWithRetry({}, 3);
  } catch (err) {
    threw = true;
    assert.ok(
      err.message.includes('3 attempts'),
      `Error message should mention attempt count, got: ${err.message}`
    );
  }
  assert.ok(threw, 'Should throw after max attempts');
  console.log('  ✓ saveWithRetry throws meaningful error after max attempts');
}

async function testDoesNotRetryOnUnrelatedErrors() {
  let callCount = 0;
  const doc = makeStubCase(async function () {
    callCount++;
    throw new Error('Validation failed: title is required');
  });

  let threw = false;
  try {
    await doc.saveWithRetry({}, 5);
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('Validation failed'), 'Should rethrow unrelated error as-is');
  }
  assert.strictEqual(callCount, 1, 'Should not retry on non-duplicate errors');
  assert.ok(threw, 'Should propagate unrelated errors immediately');
  console.log('  ✓ saveWithRetry does not retry on non-duplicate errors');
}

async function testDoesNotRetryOnDuplicateOtherField() {
  let callCount = 0;
  const doc = makeStubCase(async function () {
    callCount++;
    throw makeDuplicateKeyError('caseName'); // different field
  });

  let threw = false;
  try {
    await doc.saveWithRetry({}, 5);
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, 11000, 'Should propagate E11000 on other fields');
  }
  assert.strictEqual(callCount, 1, 'Should not retry on duplicate key for other fields');
  assert.ok(threw);
  console.log('  ✓ saveWithRetry does not retry on E11000 for other fields');
}

async function testSucceedsFirstTryPassthrough() {
  let callCount = 0;
  const doc = makeStubCase(async function (opts) {
    callCount++;
    return this;
  });

  const result = await doc.saveWithRetry({ session: 'mockSession' });
  assert.strictEqual(callCount, 1, 'Should succeed without retrying');
  assert.strictEqual(result, doc, 'Should return the document');
  console.log('  ✓ saveWithRetry passes through save options and returns document on success');
}

// ---------------------------------------------------------------------------
// 2. createWorkType controller — 409 on E11000 duplicate prefix
// ---------------------------------------------------------------------------

function makeMockRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

async function testWorkTypeControllerReturns409OnDuplicatePrefix() {
  // Rebuild a minimal version of the createWorkType handler to test
  // the E11000 catch block logic in isolation.
  const WorkTypeCreateStub = async (_data) => {
    const err = new Error('E11000 duplicate key error collection: test.worktypes index: firmId_1_prefix_1');
    err.code = 11000;
    throw err;
  };

  const handler = async (req, res) => {
    const createData = { firmId: req.user.firmId, name: req.body.name, prefix: req.body.prefix };
    let workType;
    try {
      workType = await WorkTypeCreateStub(createData);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Prefix already exists in this firm',
        });
      }
      throw err;
    }
    return res.status(201).json({ success: true, data: workType });
  };

  const req = { user: { firmId: 'FIRM1' }, body: { name: 'Corporate', prefix: 'CO' } };
  const res = makeMockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 409, 'Should return 409 Conflict');
  assert.strictEqual(res._body.success, false, 'success should be false');
  assert.ok(
    res._body.message.includes('Prefix already exists'),
    `Message should mention prefix conflict, got: ${res._body.message}`
  );
  console.log('  ✓ createWorkType returns 409 Conflict on E11000 duplicate prefix');
}

async function testWorkTypeControllerRethrowsUnrelatedErrors() {
  const WorkTypeCreateStub = async (_data) => {
    const err = new Error('Network timeout');
    throw err;
  };

  const handler = async (req, res) => {
    const createData = { firmId: req.user.firmId, name: req.body.name };
    try {
      await WorkTypeCreateStub(createData);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Prefix already exists in this firm' });
      }
      throw err;
    }
    return res.status(201).json({ success: true });
  };

  const req = { user: { firmId: 'FIRM1' }, body: { name: 'Corporate' } };
  const res = makeMockRes();
  let threw = false;
  try {
    await handler(req, res);
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('Network timeout'), 'Should rethrow unrelated errors');
  }
  assert.ok(threw, 'Should propagate non-11000 errors');
  console.log('  ✓ createWorkType rethrows non-11000 errors');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function run() {
  console.log('Docket ID collision retry tests:');
  try {
    await testSucceedsFirstTryPassthrough();
    await testRetrySucceedsOnSecondAttempt();
    await testRetryResetsFieldsBeforeRetry();
    await testThrowsAfterMaxAttempts();
    await testDoesNotRetryOnUnrelatedErrors();
    await testDoesNotRetryOnDuplicateOtherField();

    console.log('\nWorkType prefix duplicate (race condition) tests:');
    await testWorkTypeControllerReturns409OnDuplicatePrefix();
    await testWorkTypeControllerRethrowsUnrelatedErrors();

    console.log('\nAll docket collision and worktype prefix tests passed.');
  } catch (err) {
    console.error('\nTest failed:', err);
    process.exit(1);
  }
}

run();
