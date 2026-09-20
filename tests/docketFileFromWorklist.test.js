const assert = require('assert');
const {
  DocketLifecycle,
  isValidTransition,
  assertValidLifecycleTransition,
  toLifecycleFromStatus,
} = require('../src/domain/docketLifecycle');

const caseModelPath = require.resolve('../src/models/Case.model');
const auditServicePath = require.resolve('../src/services/docketAudit.service');
const transitionServicePath = require.resolve('../src/services/docketTransition.service');

const originalCaseModel = require.cache[caseModelPath];
const originalAuditService = require.cache[auditServicePath];
delete require.cache[transitionServicePath];

let capturedUpdate = null;
let capturedFilter = null;

require.cache[caseModelPath] = {
  exports: {
    findOne: () => ({
      lean: async () => ({
        _id: 'mongo-file-1',
        caseId: 'DOCKET-20260421-00001',
        caseNumber: 'DOCKET-20260421-00001',
        firmId: 'firm-gupte-opc',
        status: 'ASSIGNED',
        lifecycle: DocketLifecycle.WL,
        version: 0,
      }),
    }),
    updateOne: async (filter, update) => {
      capturedFilter = filter;
      capturedUpdate = update;
      return { matchedCount: 1 };
    },
  },
};

require.cache[auditServicePath] = {
  exports: {
    logStatusChange: async () => {},
  },
};

const { transitionDocket } = require('../src/services/docketTransition.service');

(async () => {
  // 1. Verify domain level transitions
  assert.strictEqual(
    isValidTransition(DocketLifecycle.WL, DocketLifecycle.DONE),
    true,
    'Worklist (WL) lifecycle must be able to transition directly to DONE (FILED/RESOLVED)'
  );
  assert.doesNotThrow(() => {
    assertValidLifecycleTransition(DocketLifecycle.WL, DocketLifecycle.DONE);
  });

  assert.strictEqual(toLifecycleFromStatus('FILED'), 'DONE');
  assert.strictEqual(toLifecycleFromStatus('RESOLVED'), 'DONE');

  // 2. Verify transitionDocket service execution
  const result = await transitionDocket('DOCKET-20260421-00001', 'FILED', 'X_SARVESH', {
    firmId: 'firm-gupte-opc',
    notes: 'filing',
    skipAudit: true,
  });

  assert.strictEqual(result.toState, 'FILED');
  assert.ok(capturedUpdate, 'Expected status update to be sent to Mongo');
  assert.strictEqual(capturedUpdate.$set.status, 'FILED');

  console.log('docketFileFromWorklist.test.js passed');
})()
  .finally(() => {
    if (originalCaseModel) require.cache[caseModelPath] = originalCaseModel;
    else delete require.cache[caseModelPath];

    if (originalAuditService) require.cache[auditServicePath] = originalAuditService;
    else delete require.cache[auditServicePath];

    delete require.cache[transitionServicePath];
  })
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
