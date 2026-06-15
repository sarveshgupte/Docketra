#!/usr/bin/env node
const assert = require('assert');

async function run() {
  const repoPath = require.resolve('../src/repositories');
  const caseServicePath = require.resolve('../src/services/case.service');
  const caseActionServicePath = require.resolve('../src/services/caseAction.service');
  const commentPath = require.resolve('../src/models/Comment.model');
  const caseAuditPath = require.resolve('../src/models/CaseAudit.model');
  const caseHistoryPath = require.resolve('../src/models/CaseHistory.model');
  const auditLogPath = require.resolve('../src/services/auditLog.service');

  const backup = {
    repo: require.cache[repoPath],
    caseService: require.cache[caseServicePath],
    caseActionService: require.cache[caseActionServicePath],
    comment: require.cache[commentPath],
    caseAudit: require.cache[caseAuditPath],
    caseHistory: require.cache[caseHistoryPath],
    auditLog: require.cache[auditLogPath],
  };

  let capturedUpdateArgs = null;

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      CaseRepository: {
        findByCaseId: async () => ({
          caseId: 'DOCKET-20260527-00001',
          firmId: 'firm-1',
          status: 'ASSIGNED',
          lifecycle: 'IN_WORKLIST',
          assignedToXID: 'X000005',
        }),
      },
    },
  };

  require.cache[caseServicePath] = {
    id: caseServicePath,
    filename: caseServicePath,
    loaded: true,
    exports: {
      updateStatus: async (caseId, newStatus, context) => {
        capturedUpdateArgs = { caseId, newStatus, context };
      },
    },
  };

  require.cache[commentPath] = {
    id: commentPath,
    filename: commentPath,
    loaded: true,
    exports: { create: async () => ({}) },
  };

  require.cache[caseAuditPath] = {
    id: caseAuditPath,
    filename: caseAuditPath,
    loaded: true,
    exports: { create: async () => ({}) },
  };

  require.cache[caseHistoryPath] = {
    id: caseHistoryPath,
    filename: caseHistoryPath,
    loaded: true,
    exports: {},
  };

  require.cache[auditLogPath] = {
    id: auditLogPath,
    filename: auditLogPath,
    loaded: true,
    exports: { logCaseHistory: async () => null },
  };

  delete require.cache[caseActionServicePath];
  const caseActionService = require('../src/services/caseAction.service');

  try {
    await caseActionService.pendCase(
      'firm-1',
      'DOCKET-20260527-00001',
      'pending',
      '2026-06-16',
      { xID: 'X000005', email: 'user@example.com', role: 'USER', name: 'User' },
      { ip: '127.0.0.1', get: () => 'test-agent' }
    );

    assert.ok(capturedUpdateArgs, 'pendCase should call CaseService.updateStatus');
    assert.strictEqual(capturedUpdateArgs.newStatus, 'PENDING');
    assert.strictEqual(capturedUpdateArgs.context.statusPatch.pendingReason, 'pending');
    assert.strictEqual(capturedUpdateArgs.context.auditMetadata.reason, 'pending');
    console.log('✓ pendCase sends pendingReason in the status patch payload');
  } finally {
    for (const [key, entry] of Object.entries(backup)) {
      const pathMap = {
        repo: repoPath,
        caseService: caseServicePath,
        caseActionService: caseActionServicePath,
        comment: commentPath,
        caseAudit: caseAuditPath,
        caseHistory: caseHistoryPath,
        auditLog: auditLogPath,
      };
      if (entry) {
        require.cache[pathMap[key]] = entry;
      } else {
        delete require.cache[pathMap[key]];
      }
    }
  }
}

run().catch((error) => {
  console.error('casePendServicePayload.test.js failed:', error);
  process.exit(1);
});
