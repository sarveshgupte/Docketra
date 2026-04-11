#!/usr/bin/env node
const assert = require('assert');

const CaseService = require('../src/services/case.service');
const Case = require('../src/models/Case.model');
const CaseAudit = require('../src/models/CaseAudit.model');
const DocketAudit = require('../src/models/DocketAuditLog.model');
const CaseHistory = require('../src/models/CaseHistory.model');
const auditLogService = require('../src/services/auditLog.service');

async function testStatusTransitionRequiresSession() {
  await assert.rejects(
    () => CaseService.updateStatus('CASE-20260301-00001', 'PENDING', {
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
        status: 'IN_PROGRESS',
        docketState: 'IN_PROGRESS',
        tatPaused: false,
        tatLastStartedAt: fixedStart,
        tatAccumulatedMinutes: 0,
        firmId: 'firm-a',
      })
    });
    /*
      caseId: 'CASE-20260301-00002',
      status: 'OPEN',
      tatPaused: false,
      tatLastStartedAt: fixedStart,
      tatAccumulatedMinutes: 0,
      firmId: 'firm-a',
    }); */
    Case.updateOne = async () => {
      updateOneAttempts += 1;
      return { matchedCount: updateOneAttempts === 1 ? 1 : 0 };
    };
    CaseAudit.create = async () => ({});
    DocketAudit.create = async () => ({});
    CaseHistory.create = async (docs) => (Array.isArray(docs) ? docs : [docs]);
    auditLogService.logCaseHistory = async () => ({});

    const context = {
      tenantId: 'firm-a',
      role: 'Admin',
      currentStatus: 'OPEN',
      userId: 'X123456',
      performedByXID: 'X123456',
      performedBy: 'test@example.com',
      session: { id: 's1' },
    };

    // update1
    await CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }).catch(e => { if (e.message !== 'Case state changed concurrently' && !e.message.includes('Version mismatch')) throw e; });
    // update2
    await assert.rejects(
      () => CaseService.updateStatus('CASE-20260301-00002', 'PENDING', { ...context, reason: 'test' }),
      /Case state changed concurrently|Version mismatch: docket was updated by another request/
    );
    console.log('✓ Concurrent pause attempts reject stale writer');
  } finally {
    Case.findOne = originalFindOne;
    Case.updateOne = originalUpdateOne;
    CaseAudit.create = originalCaseAuditCreate;
    DocketAudit.create = undefined;
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
