#!/usr/bin/env node
const assert = require('assert');
const DocketAudit = require('../src/models/DocketAudit.model');
const docketAuditService = require('../src/services/docketAudit.service');
const Case = require('../src/models/Case.model');
const { reopenDuePending } = require('../src/services/docketWorkflow.service');

async function testCanonicalAuditShape() {
  const originalCreate = DocketAudit.create;
  let captured = null;

  try {
    DocketAudit.create = async (rows) => {
      captured = Array.isArray(rows) ? rows[0] : rows;
      return rows;
    };

    await docketAuditService.logDocketEvent({
      docketId: 'CASE-1',
      firmId: 'FIRM-1',
      event: 'status_changed',
      userId: 'x101',
      userRole: 'admin',
      fromState: 'IN_PROGRESS',
      toState: 'QC_PENDING',
      metadata: { reasonCode: 'QC_REQUESTED', source: 'unit-test' },
    });

    assert.ok(captured);
    assert.strictEqual(captured.entityType, 'docket');
    assert.strictEqual(captured.entityId, 'CASE-1');
    assert.strictEqual(captured.action, 'STATUS_CHANGED');
    assert.strictEqual(captured.actorId, 'X101');
    assert.strictEqual(captured.actorRole, 'ADMIN');
    assert.strictEqual(captured.reasonCode, 'QC_REQUESTED');
  } finally {
    DocketAudit.create = originalCreate;
  }
}

async function testReopenMovesToWorkbenchWithAudit() {
  const originalFind = Case.find;
  const originalUpdateMany = Case.updateMany;
  const originalLogDocketEvent = docketAuditService.logDocketEvent;
  const originalCreateLog = docketAuditService.createLog;

  let updatePayload = null;
  const observed = [];

  try {
    Case.find = async () => ([{
      _id: 'doc-1',
      caseId: 'CASE-2',
      firmId: 'FIRM-2',
      status: 'PENDING',
      reopenAt: new Date(Date.now() - 1000),
    }]);

    Case.updateMany = async (_filter, update) => {
      updatePayload = update;
      return { acknowledged: true, modifiedCount: 1 };
    };

    docketAuditService.logDocketEvent = async (payload) => {
      observed.push({ kind: 'canonical', payload });
      return payload;
    };
    docketAuditService.createLog = async (payload) => {
      observed.push({ kind: 'legacy', payload });
      return payload;
    };

    const result = await reopenDuePending();
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.docketIds[0], 'CASE-2');
    assert.ok(updatePayload?.$set);
    assert.strictEqual(updatePayload.$set.state, 'IN_WB');
    assert.strictEqual(updatePayload.$set.queueType, 'GLOBAL');
    assert.strictEqual(updatePayload.$set.assignedToXID, null);

    const canonical = observed.find((entry) => entry.kind === 'canonical');
    assert.ok(canonical);
    assert.strictEqual(canonical.payload.toState, 'AVAILABLE');
    assert.strictEqual(canonical.payload.metadata.reasonCode, 'AUTO_REOPEN_DUE');
  } finally {
    Case.find = originalFind;
    Case.updateMany = originalUpdateMany;
    docketAuditService.logDocketEvent = originalLogDocketEvent;
    docketAuditService.createLog = originalCreateLog;
  }
}

async function run() {
  try {
    await testCanonicalAuditShape();
    await testReopenMovesToWorkbenchWithAudit();
    console.log('Docket audit integrity tests passed.');
  } catch (error) {
    console.error('Docket audit integrity tests failed:', error);
    process.exit(1);
  }
}

run();
