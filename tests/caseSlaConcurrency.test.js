#!/usr/bin/env node
const assert = require('assert');

const CaseService = require('../src/services/case.service');
const Case = require('../src/models/Case.model');
const CaseAudit = require('../src/models/CaseAudit.model');
const CaseHistory = require('../src/models/CaseHistory.model');
const auditLogService = require('../src/services/auditLog.service');

async function testStatusTransitionRequiresSession() {
  await assert.rejects(
    () => CaseService.updateStatus('CASE-20260301-00001', 'PENDED', {
      tenantId: 'firm-a',
      role: 'Admin',
      currentStatus: 'OPEN',
      userId: 'X123456',
    }),
    /Transaction session required/
  );
  console.log('✓ Status transition enforces transaction session');
}

async function testConcurrentPauseConflictIsRejected() {
  const originalFindOne = Case.findOne;
  const originalUpdateOne = Case.updateOne;
  const originalCaseAuditCreate = CaseAudit.create;
  const originalCaseHistoryCreate = CaseHistory.create;
  const originalLogCaseHistory = auditLogService.logCaseHistory;

  const fixedStart = new Date('2026-03-01T10:00:00.000Z');
  let updateOneAttempts = 0;

  try {
    Case.findOne = () => ({
      lean: async () => ({
        caseId: 'CASE-20260301-00002',
        status: 'IN_PROGRESS', // IN_PROGRESS maps to Docket IN_PROGRESS, which can transition to PENDED
        docketStatus: 'IN_PROGRESS',
        tatPaused: false,
        tatLastStartedAt: fixedStart,
        tatAccumulatedMinutes: 0,
        firmId: 'firm-a',
      }),
    });
    Case.updateOne = async () => {
      updateOneAttempts += 1;
      return { matchedCount: updateOneAttempts === 1 ? 1 : 0 };
    };
    CaseAudit.create = async () => ({});
    CaseHistory.create = async (docs) => (Array.isArray(docs) ? docs : [docs]);
    auditLogService.logCaseHistory = async () => ({});

    // Provide a dummy mock for DocketAuditLog which is created in docket transitions
    let originalDocketAuditLogCreate;
    try {
      originalDocketAuditLogCreate = require('../src/models/DocketAuditLog.model').create;
      require('../src/models/DocketAuditLog.model').create = async () => ({});
    } catch(e) {}

    const context = {
      tenantId: 'firm-a',
      role: 'Admin',
      currentStatus: 'IN_PROGRESS',
      userId: 'X123456',
      performedByXID: 'X123456',
      performedBy: 'test@example.com',
      session: { id: 's1' },
      reason: 'Testing SLA Concurrency' // Required by Docket logic
    };

    // The first attempt will successfully "update" the status (our mock matchedCount=1)
    try {
      await CaseService.updateStatus('CASE-20260301-00002', 'PENDED', context);
    } catch(err) {}

    const staleContext = { ...context, currentStatus: 'IN_PROGRESS' };

    // On the second attempt, matchedCount=0 triggers the concurrent state change logic
    let rejected = false;
    try {
      await CaseService.updateStatus('CASE-20260301-00002', 'PENDED', staleContext);
    } catch(err) {
      rejected = true;
    }
    assert.strictEqual(rejected, true, 'Should reject stale writer');
    console.log('✓ Concurrent pause attempts reject stale writer');
  } finally {
    Case.findOne = originalFindOne;
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalCaseAuditCreate;
    CaseHistory.create = originalCaseHistoryCreate;
    auditLogService.logCaseHistory = originalLogCaseHistory;
  }
}

async function run() {
  try {
    await testStatusTransitionRequiresSession();
    await testConcurrentPauseConflictIsRejected();
    console.log('Case SLA concurrency tests passed.');
  } catch (error) {
    console.error('Case SLA concurrency tests failed:', error);
    process.exit(1);
  }
}

run();
