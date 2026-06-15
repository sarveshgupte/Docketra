#!/usr/bin/env node
const assert = require('assert');

async function run() {
  const repoPath = require.resolve('../src/repositories');
  const caseAuditPath = require.resolve('../src/models/CaseAudit.model');
  const caseSlaPath = require.resolve('../src/services/caseSla.service');
  const auditLogPath = require.resolve('../src/services/auditLog.service');
  const forensicPath = require.resolve('../src/services/forensicAudit.service');
  const transitionPath = require.resolve('../src/services/docketTransition.service');
  const caseServicePath = require.resolve('../src/services/case.service');

  const backup = {
    repo: require.cache[repoPath],
    caseAudit: require.cache[caseAuditPath],
    caseSla: require.cache[caseSlaPath],
    auditLog: require.cache[auditLogPath],
    forensic: require.cache[forensicPath],
    transition: require.cache[transitionPath],
    caseService: require.cache[caseServicePath],
  };

  let capturedExpectedCurrentStatus = null;
  let capturedPatch = null;

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      CaseRepository: {
        findByCaseId: async () => ({
          caseId: 'DOCKET-20260527-00001',
          status: 'ASSIGNED',
          lifecycle: 'IN_WORKLIST',
          assignedToXID: 'X000005',
          version: 7,
          qcOutcome: null,
        }),
        updateStatus: async (_caseId, _tenantId, _newStatus, patch, _session, expectedCurrentStatus) => {
          capturedExpectedCurrentStatus = expectedCurrentStatus;
          capturedPatch = patch;
          return { matchedCount: 1 };
        },
      },
    },
  };

  require.cache[caseAuditPath] = {
    id: caseAuditPath,
    filename: caseAuditPath,
    loaded: true,
    exports: { create: async () => ([{}]) },
  };

  require.cache[caseSlaPath] = {
    id: caseSlaPath,
    filename: caseSlaPath,
    loaded: true,
    exports: { handleStatusTransition: () => ({ patch: {}, auditEvent: null }) },
  };

  require.cache[auditLogPath] = {
    id: auditLogPath,
    filename: auditLogPath,
    loaded: true,
    exports: { logCaseHistory: async () => null },
  };

  require.cache[forensicPath] = {
    id: forensicPath,
    filename: forensicPath,
    loaded: true,
    exports: {
      safeLogForensicAudit: async () => null,
      computeChangedFields: () => ({ oldValue: { status: 'ASSIGNED' }, newValue: { status: 'PENDING' } }),
      getRequestIp: () => '127.0.0.1',
      getRequestUserAgent: () => 'test-agent',
    },
  };

  require.cache[transitionPath] = {
    id: transitionPath,
    filename: transitionPath,
    loaded: true,
    exports: { transitionDocket: async () => ({ success: true }) },
  };

  delete require.cache[caseServicePath];
  const caseService = require('../src/services/case.service');

  try {
    await caseService.updateStatus('DOCKET-20260527-00001', 'PENDING', {
      tenantId: 'firm-1',
      role: 'USER',
      userId: 'X000005',
      performedByXID: 'X000005',
      performedBy: 'user@example.com',
      actorRole: 'USER',
      session: { id: 'tx-1' },
      reason: 'pending',
      statusPatch: {
        pendingReason: 'pending',
        pendingUntil: new Date('2026-06-16T02:30:00.000Z'),
      },
    });

    assert.strictEqual(
      capturedExpectedCurrentStatus,
      'PENDING',
      'status patch write must expect the already-transitioned persistence status'
    );
    assert.strictEqual(capturedPatch.pendingReason, 'pending', 'pending status patch should persist pendingReason');
    console.log('✓ case status patch expects transitioned status and preserves pendingReason');
  } finally {
    for (const [key, entry] of Object.entries(backup)) {
      const pathMap = {
        repo: repoPath,
        caseAudit: caseAuditPath,
        caseSla: caseSlaPath,
        auditLog: auditLogPath,
        forensic: forensicPath,
        transition: transitionPath,
        caseService: caseServicePath,
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
  console.error('case status transition expected-current-status test failed:', error);
  process.exit(1);
});
