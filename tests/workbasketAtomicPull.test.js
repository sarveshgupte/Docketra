#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');
const CaseAudit = require('../src/models/CaseAudit.model');
const CaseStatus = require('../src/domain/case/caseStatus');

const servicePath = require.resolve('../src/services/caseAssignment.service');

function freshService() {
  delete require.cache[servicePath];
  return require('../src/services/caseAssignment.service');
}

async function testAtomicUpdateFilterAndSuccessResponse() {
  const originalUpdateOne = Case.updateOne;
  const originalAuditCreate = CaseAudit.create;
  let capturedFilter;
  let capturedUpdate;

  Case.updateOne = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { modifiedCount: 1 };
  };
  CaseAudit.create = async () => ({});

  try {
    const service = freshService();
    const result = await service.pullCaseFromWorkbasket({
      caseId: 'CASE-20260101-00001',
      tenantId: 'firm-1',
      userId: 'x123456',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'ASSIGNED');
    assert.strictEqual(result.caseId, 'CASE-20260101-00001');
    assert.strictEqual(result.assignedTo, 'X123456');
    assert.deepStrictEqual(capturedFilter, {
      caseId: 'CASE-20260101-00001',
      firmId: 'firm-1',
      assignedToXID: null,
      assignedTo: null,
      status: CaseStatus.UNASSIGNED,
    });
    assert.strictEqual(capturedUpdate.$set.assignedToXID, 'X123456');
    assert.strictEqual(capturedUpdate.$set.assignedTo, 'X123456');
    assert.strictEqual(capturedUpdate.$set.status, CaseStatus.OPEN);
    await new Promise((resolve) => setImmediate(resolve));
    console.log('✓ Atomic single-case pull updates with tenant and unassigned filter');
  } finally {
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalAuditCreate;
    delete require.cache[servicePath];
  }
}

async function testConflictWhenNoRowsUpdated() {
  const originalUpdateOne = Case.updateOne;
  const originalAuditCreate = CaseAudit.create;
  Case.updateOne = async () => ({ modifiedCount: 0 });
  CaseAudit.create = async () => ({});

  try {
    const service = freshService();
    const result = await service.pullCaseFromWorkbasket({
      caseId: 'CASE-20260101-00001',
      tenantId: 'firm-1',
      userId: 'x123456',
    });
    assert.deepStrictEqual(result, {
      success: false,
      status: 'CONFLICT',
      error: 'Case already assigned',
    });
    console.log('✓ Atomic pull returns deterministic conflict when no row is updated');
  } finally {
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalAuditCreate;
    delete require.cache[servicePath];
  }
}

async function testConcurrentPullsYieldSingleWinner() {
  const originalUpdateOne = Case.updateOne;
  const originalAuditCreate = CaseAudit.create;
  let assigned = false;
  Case.updateOne = async () => {
    if (assigned) {
      return { modifiedCount: 0 };
    }
    assigned = true;
    return { modifiedCount: 1 };
  };
  CaseAudit.create = async () => ({});

  try {
    const service = freshService();
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.pullCaseFromWorkbasket({
          caseId: 'CASE-20260101-00001',
          tenantId: 'firm-1',
          userId: 'x123456',
        })
      )
    );
    const successCount = attempts.filter((item) => item.success).length;
    const conflictCount = attempts.filter((item) => item.status === 'CONFLICT').length;
    assert.strictEqual(successCount, 1);
    assert.strictEqual(conflictCount, 9);
    await new Promise((resolve) => setImmediate(resolve));
    console.log('✓ Concurrent pulls allow exactly one assignment and reject the rest');
  } finally {
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalAuditCreate;
    delete require.cache[servicePath];
  }
}

async function testTenantScopedFilterPreventsCrossTenantAccess() {
  const originalUpdateOne = Case.updateOne;
  const originalAuditCreate = CaseAudit.create;
  let seenTenant;
  Case.updateOne = async (filter) => {
    seenTenant = filter.firmId;
    return { modifiedCount: 0 };
  };
  CaseAudit.create = async () => ({});

  try {
    const service = freshService();
    const result = await service.pullCaseFromWorkbasket({
      caseId: 'CASE-20260101-00001',
      tenantId: 'wrong-tenant',
      userId: 'x123456',
    });
    assert.strictEqual(seenTenant, 'wrong-tenant');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'CONFLICT');
    console.log('✓ Pull query remains tenant-scoped for cross-tenant safety');
  } finally {
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalAuditCreate;
    delete require.cache[servicePath];
  }
}

async function run() {
  try {
    await testAtomicUpdateFilterAndSuccessResponse();
    await testConflictWhenNoRowsUpdated();
    await testConcurrentPullsYieldSingleWinner();
    await testTenantScopedFilterPreventsCrossTenantAccess();
    console.log('Workbasket atomic pull tests passed.');
  } catch (error) {
    console.error('Workbasket atomic pull tests failed:', error);
    process.exit(1);
  }
}

run();
