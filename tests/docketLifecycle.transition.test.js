const assert = require('assert');
const {
  DocketLifecycle,
  isValidTransition,
  assertValidLifecycleTransition,
} = require('../src/domain/docketLifecycle');

assert.strictEqual(
  isValidTransition(DocketLifecycle.WL, DocketLifecycle.WAITING),
  true,
  'Assigned worklist dockets should be pendable before they are explicitly activated.',
);

assert.doesNotThrow(() => {
  assertValidLifecycleTransition(DocketLifecycle.WL, DocketLifecycle.WAITING);
});

assert.strictEqual(
  isValidTransition(DocketLifecycle.WAITING, DocketLifecycle.WL),
  false,
  'Pending dockets should reopen back into active work, not jump straight to WL.',
);

console.log('docketLifecycle.transition.test.js passed');
