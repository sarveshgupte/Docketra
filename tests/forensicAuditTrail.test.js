#!/usr/bin/env node
const assert = require('assert');

async function testAuditSchemaImmutabilityAndNoHashFields() {
  const AuditLog = require('../src/models/AuditLog.model');
  const schemaPaths = Object.keys(AuditLog.schema.paths);

  assert.ok(!schemaPaths.includes('previousHash'), 'previousHash must not exist in schema');
  assert.ok(!schemaPaths.includes('currentHash'), 'currentHash must not exist in schema');
  assert.strictEqual(AuditLog.schema.options.strict, true, 'strict mode must remain enabled');
  assert.strictEqual(AuditLog.schema.options.versionKey, false, 'versionKey must be disabled');

  const pres = AuditLog.schema.s.hooks._pres;
  assert.ok((pres.get('updateOne') || []).length > 0, 'updateOne hook must block mutations');
  assert.ok((pres.get('deleteOne') || []).length > 0, 'deleteOne hook must block deletions');

  const indexes = AuditLog.schema.indexes().map(([spec]) => JSON.stringify(spec));
  assert.strictEqual(indexes.filter((x) => x === JSON.stringify({ tenantId: 1, entityId: 1 })).length, 1);
  assert.strictEqual(indexes.filter((x) => x === JSON.stringify({ tenantId: 1, createdAt: -1 })).length, 1);
  assert.strictEqual(indexes.filter((x) => x === JSON.stringify({ tenantId: 1, action: 1 })).length, 1);

  console.log('✓ Audit schema hardened (immutable, strict, no hash fields, expected indexes)');
}

async function testTenantRequiredAndNoPlatformFallback() {
  const forensic = require('../src/services/forensicAudit.service');
  const AuditLog = require('../src/models/AuditLog.model');

  await assert.rejects(
    () => forensic.logForensicAudit({
      entityType: 'AUTH',
      entityId: 'X1',
      action: 'Login',
      performedBy: 'X1',
      ipAddress: '127.0.0.1',
      userAgent: 'ua',
    }),
    /tenantId is required/
  );

  const originalCreate = AuditLog.create;
  let captured = null;
  AuditLog.create = async (docs) => {
    captured = docs;
    return docs;
  };

  await forensic.logForensicAudit({
    tenantId: 'FIRM001',
    entityType: 'AUTH',
    entityId: 'X1',
    action: 'Login',
    performedBy: 'X1',
    ipAddress: '127.0.0.1',
    userAgent: 'ua',
  });

  AuditLog.create = originalCreate;

  assert.ok(Array.isArray(captured) && captured.length === 1, 'audit create should receive one payload');
  assert.strictEqual(captured[0].tenantId, 'FIRM001', 'tenant must remain caller-provided; no PLATFORM fallback');
  console.log('✓ tenantId is mandatory and no implicit PLATFORM fallback occurs');
}

async function testSessionIsPropagatedToAuditInsert() {
  const forensic = require('../src/services/forensicAudit.service');
  const AuditLog = require('../src/models/AuditLog.model');

  const originalCreate = AuditLog.create;
  let receivedOptions = null;
  AuditLog.create = async (_docs, options) => {
    receivedOptions = options;
    return null;
  };

  const session = { id: 'tx-session' };
  await forensic.logForensicAudit({
    tenantId: 'FIRM001',
    entityType: 'CASE',
    entityId: 'CASE-1',
    action: 'CASE_STATUS_CHANGED',
    performedBy: 'X100',
    ipAddress: '127.0.0.1',
    userAgent: 'ua',
  }, { session });

  AuditLog.create = originalCreate;

  assert.deepStrictEqual(receivedOptions, { session }, 'logForensicAudit must pass session into AuditLog.create');
  console.log('✓ forensic audit insert is session-aware');
}

async function testCaseStatusAuditUsesTransactionSession() {
  const forensic = require('../src/services/forensicAudit.service');
  const originalSafe = forensic.safeLogForensicAudit;

  let capturedOptions = null;
  forensic.safeLogForensicAudit = async (_payload, options = {}) => {
    capturedOptions = options;
    return null;
  };

  const repoPath = require.resolve('../src/repositories');
  const caseAuditPath = require.resolve('../src/models/CaseAudit.model');
  const caseHistoryPath = require.resolve('../src/services/auditLog.service');
  const slaPath = require.resolve('../src/services/caseSla.service');
  const statePath = require.resolve('../src/domain/case/caseStateMachine');
  const caseServicePath = require.resolve('../src/services/case.service');

  const backup = {
    repo: require.cache[repoPath],
    caseAudit: require.cache[caseAuditPath],
    caseHistory: require.cache[caseHistoryPath],
    sla: require.cache[slaPath],
    state: require.cache[statePath],
    caseService: require.cache[caseServicePath],
  };

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      CaseRepository: {
        findByCaseId: async () => ({ caseId: 'CASE-1', caseInternalId: 'INT-1', status: 'OPEN' }),
        updateStatus: async () => null,
      },
    },
  };

  require.cache[caseAuditPath] = {
    id: caseAuditPath,
    filename: caseAuditPath,
    loaded: true,
    exports: { create: async () => null },
  };

  require.cache[caseHistoryPath] = {
    id: caseHistoryPath,
    filename: caseHistoryPath,
    loaded: true,
    exports: { logCaseHistory: async () => null },
  };

  require.cache[slaPath] = {
    id: slaPath,
    filename: slaPath,
    loaded: true,
    exports: { handleStatusTransition: () => ({ patch: {}, auditEvent: null }) },
  };

  require.cache[statePath] = {
    id: statePath,
    filename: statePath,
    loaded: true,
    exports: {
      canTransition: () => true,
      normalizeStatus: (v) => v,
    },
  };

  delete require.cache[caseServicePath];
  const caseService = require('../src/services/case.service');

  const session = { id: 'tx-session' };
  await caseService.updateStatus('CASE-1', 'FILED', {
    tenantId: 'FIRM001',
    role: 'Admin',
    userId: 'X100',
    performedByXID: 'X100',
    actorRole: 'ADMIN',
    session,
    req: { headers: { 'user-agent': 'ua' }, ip: '127.0.0.1' },
  });

  forensic.safeLogForensicAudit = originalSafe;

  for (const [key, entry] of Object.entries(backup)) {
    const pathMap = {
      repo: repoPath,
      caseAudit: caseAuditPath,
      caseHistory: caseHistoryPath,
      sla: slaPath,
      state: statePath,
      caseService: caseServicePath,
    };
    if (entry) {
      require.cache[pathMap[key]] = entry;
    } else {
      delete require.cache[pathMap[key]];
    }
  }

  assert.deepStrictEqual(capturedOptions, { session }, 'case status path must pass same session to forensic audit call');
  console.log('✓ case status forensic audit is attached to transaction session (rollback-safe)');
}

async function testSafeLoggerIsNonFatal() {
  const forensic = require('../src/services/forensicAudit.service');
  const AuditLog = require('../src/models/AuditLog.model');
  const originalCreate = AuditLog.create;
  AuditLog.create = async () => {
    throw new Error('forced failure');
  };

  let threw = false;
  try {
    await forensic.safeLogForensicAudit({
      tenantId: 'FIRM001',
      entityType: 'AUTH',
      entityId: 'X1',
      action: 'Login',
      performedBy: 'X1',
      ipAddress: '127.0.0.1',
      userAgent: 'ua',
    });
  } catch (e) {
    threw = true;
  }

  AuditLog.create = originalCreate;
  assert.strictEqual(threw, false, 'safeLogForensicAudit must remain non-fatal');
  console.log('✓ safe forensic logger remains non-fatal');
}

async function run() {
  await testAuditSchemaImmutabilityAndNoHashFields();
  await testTenantRequiredAndNoPlatformFallback();
  await testSessionIsPropagatedToAuditInsert();
  await testCaseStatusAuditUsesTransactionSession();
  await testSafeLoggerIsNonFatal();
  console.log('\nForensic hardening tests passed.');
}

run().catch((error) => {
  console.error('Forensic hardening tests failed');
  console.error(error);
  process.exit(1);
});
