const assert = require('assert');

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
        _id: 'mongo-1',
        caseId: 'DOCKET-20260527-00001',
        caseNumber: 'DOCKET-20260527-00001',
        firmId: 'firm-1',
        status: 'ASSIGNED',
        lifecycle: 'IN_WORKLIST',
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
  const result = await transitionDocket('DOCKET-20260527-00001', 'PENDING', 'X000005', {
    firmId: 'firm-1',
    reason: 'pending',
    skipAudit: true,
  });

  assert.strictEqual(result.toState, 'PENDING');
  assert.ok(capturedUpdate, 'Expected docket transition to persist status update for legacy IN_WORKLIST lifecycle.');
  assert.ok(capturedFilter, 'Expected docket transition to send an optimistic-lock filter.');
  assert.strictEqual(capturedUpdate.$set.status, 'PENDING');
  assert.deepStrictEqual(
    capturedFilter.$or,
    [{ version: 0 }, { version: { $exists: false } }],
    'Legacy dockets without version should still transition as version 0.'
  );

  console.log('docketTransitionLegacyLifecycle.test.js passed');
})()
  .finally(() => {
    if (originalCaseModel) require.cache[caseModelPath] = originalCaseModel;
    else delete require.cache[caseModelPath];

    if (originalAuditService) require.cache[auditServicePath] = originalAuditService;
    else delete require.cache[auditServicePath];

    delete require.cache[transitionServicePath];
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
