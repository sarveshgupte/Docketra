const assert = require('assert');
const Case = require('./src/models/Case.model.js');
const docketWorkflow = require('./src/services/docketWorkflow.service.js');
const docketAuditService = require('./src/services/docketAudit.service.js');
const { REASON_CODES } = require('./src/services/pilotDiagnostics.service');
const mongoose = require('mongoose');

async function testReopenMovesToWorkbenchWithAudit() {
  const originalFind = Case.find;
  const originalUpdateOne = Case.updateOne;
  const originalLogDocketEvent = docketAuditService.logDocketEvent;
  const originalCreateLog = docketAuditService.createLog;

  let updatePayload = null;
  let observedFindFilter = null;
  const observed = [];
  mongoose.connection.readyState = 1;

  try {
    Case.find = async (filter) => {
      observedFindFilter = filter;
      return [{
        _id: 'doc-1',
        caseId: 'CASE-2',
        firmId: 'FIRM-2',
        status: 'PENDING',
        statusBeforePended: 'AVAILABLE',
        pendingUntil: new Date(Date.now() - 1000),
      }];
    };

    Case.updateOne = async (_filter, update) => {
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

    const result = await docketWorkflow.reopenDuePending();
    console.log("Result:", result);
    console.log("Observed filter:", JSON.stringify(observedFindFilter, null, 2));
    assert.ok(observedFindFilter?.status === 'PENDING' || (observedFindFilter?.status?.$in && observedFindFilter.status.$in.includes('PENDING')));
    assert.ok(observedFindFilter?.$or?.[0]?.reopenAt?.$lte instanceof Date);
    assert.ok(observedFindFilter?.$or?.[1]?.pendingUntil?.$lte instanceof Date);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.docketIds[0], 'CASE-2');
    assert.ok(updatePayload?.$set);
    assert.strictEqual(updatePayload.$set.state, 'IN_WB');
    assert.strictEqual(updatePayload.$set.status, 'AVAILABLE');

    const canonical = observed.find((entry) => entry.kind === 'canonical');
    assert.ok(canonical);
    assert.strictEqual(canonical.payload.toState, 'AVAILABLE');
    assert.strictEqual(canonical.payload.metadata.reasonCode, REASON_CODES.AUTO_REOPEN_DUE);
  } finally {
    Case.find = originalFind;
    Case.updateOne = originalUpdateOne;
    docketAuditService.logDocketEvent = originalLogDocketEvent;
    docketAuditService.createLog = originalCreateLog;
  }
}

testReopenMovesToWorkbenchWithAudit().catch(err => console.log(err));
