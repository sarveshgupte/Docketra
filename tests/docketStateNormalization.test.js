const assert = require('assert');
const { getCanonicalDocketState } = require('../src/utils/docketStateMapper');
const { canTransition, canResolve, canFile } = require('../src/utils/docketStateTransitions');

(function run() {
  assert.strictEqual(getCanonicalDocketState({ status: 'UNASSIGNED' }), 'IN_WB');
  assert.strictEqual(getCanonicalDocketState({ status: 'OPEN', assignedToXID: 'USER1' }), 'IN_PROGRESS');
  assert.strictEqual(getCanonicalDocketState({ status: 'OPEN', assignedToXID: null }), 'IN_WB');
  assert.strictEqual(getCanonicalDocketState({ status: 'QC_PENDING' }), 'IN_QC');
  assert.strictEqual(getCanonicalDocketState({ status: 'PENDING' }), 'PENDED');
  assert.strictEqual(getCanonicalDocketState({ status: 'RESOLVED' }), 'RESOLVED');
  assert.strictEqual(getCanonicalDocketState({ status: 'FILED' }), 'FILED');
  assert.strictEqual(getCanonicalDocketState({ queueType: 'PERSONAL' }), 'IN_PROGRESS');
  assert.strictEqual(getCanonicalDocketState({}), 'IN_WB');

  assert.strictEqual(canTransition('IN_WB', 'IN_PROGRESS'), true);
  assert.strictEqual(canTransition('IN_PROGRESS', 'IN_QC'), true);
  assert.strictEqual(canTransition('IN_PROGRESS', 'PENDED'), true);
  assert.strictEqual(canTransition('IN_PROGRESS', 'RESOLVED'), true);
  assert.strictEqual(canTransition('PENDED', 'IN_PROGRESS'), true);
  assert.strictEqual(canTransition('IN_QC', 'RESOLVED'), true);
  assert.strictEqual(canTransition('IN_QC', 'IN_PROGRESS'), true);
  assert.strictEqual(canTransition('IN_WB', 'FILED'), false);

  assert.strictEqual(canResolve('IN_PROGRESS'), true);
  assert.strictEqual(canResolve('IN_QC'), true);
  assert.strictEqual(canResolve('IN_WB'), false);

  assert.strictEqual(canFile('IN_WB'), true);
  assert.strictEqual(canFile('RESOLVED'), true);

  console.log('✓ docket state normalization helpers');
})();
