#!/usr/bin/env node
const assert = require('assert');

const auditLogServicePath = require.resolve('../src/services/auditLog.service');
const caseHistoryModelPath = require.resolve('../src/models/CaseHistory.model');
const docketAuditServicePath = require.resolve('../src/services/docketAudit.service');
const narrativeStoragePath = require.resolve('../src/services/commentHistoryNarrativeStorage.service');

async function run() {
  const originalCaseHistory = require(caseHistoryModelPath);
  const originalDocketAudit = require(docketAuditServicePath);
  const originalNarrativeStorage = require(narrativeStoragePath);

  const calls = {
    caseHistoryOptions: null,
    docketAuditSession: undefined,
    uploadHistory: 0,
  };

  delete require.cache[auditLogServicePath];

  require.cache[caseHistoryModelPath] = {
    exports: {
      create: async (_docs, options) => {
        calls.caseHistoryOptions = options;
        return [{ _id: 'history-1' }];
      },
    },
  };

  require.cache[docketAuditServicePath] = {
    exports: {
      logDocketEvent: async (payload) => {
        calls.docketAuditSession = payload.session;
        return null;
      },
    },
  };

  require.cache[narrativeStoragePath] = {
    exports: {
      uploadHistory: async () => {
        calls.uploadHistory += 1;
        return null;
      },
    },
  };

  try {
    const { logCaseHistory } = require('../src/services/auditLog.service');
    const result = await logCaseHistory({
      caseId: 'CASE-1001',
      firmId: 'firm-1',
      actionType: 'CASE_COMMENT_ADDED',
      actionLabel: 'Comment added',
      description: 'Comment added',
      performedBy: 'agent@example.com',
      performedByXID: 'X000123',
      actorRole: 'USER',
      session: { hasEnded: true },
    });

    assert.ok(result, 'logCaseHistory should succeed when the provided session has already ended');
    assert.deepStrictEqual(calls.caseHistoryOptions || {}, {}, 'ended sessions should not be passed to CaseHistory.create');
    assert.strictEqual(calls.docketAuditSession, null, 'ended sessions should not be passed to docket audit logging');
    assert.strictEqual(calls.uploadHistory, 1, 'history narrative upload should still be attempted');
    console.log('✓ logCaseHistory ignores ended sessions and still writes audit history');
  } finally {
    delete require.cache[auditLogServicePath];
    require.cache[caseHistoryModelPath] = { exports: originalCaseHistory };
    require.cache[docketAuditServicePath] = { exports: originalDocketAudit };
    require.cache[narrativeStoragePath] = { exports: originalNarrativeStorage };
  }
}

run().catch((error) => {
  console.error('auditLog.sessionSafety.test.js failed:', error);
  process.exit(1);
});
