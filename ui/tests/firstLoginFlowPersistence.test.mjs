import assert from 'node:assert/strict';
import { resolveTutorialPersistenceIntent } from '../src/components/onboarding/firstLoginFlowPersistence.js';

const firstLoginSkip = resolveTutorialPersistenceIntent({
  serverShowTutorial: true,
  action: 'skipped',
  role: 'manager',
  stepIndex: 2,
});
assert.deepEqual(firstLoginSkip, { status: 'skipped', role: 'manager', stepIndex: 2 });

const firstLoginComplete = resolveTutorialPersistenceIntent({
  serverShowTutorial: true,
  action: 'completed',
  role: 'admin',
  stepIndex: 99.8,
});
assert.deepEqual(firstLoginComplete, { status: 'completed', role: 'admin', stepIndex: 99 });

const manualReplaySkip = resolveTutorialPersistenceIntent({
  serverShowTutorial: false,
  action: 'skipped',
  role: 'user',
  stepIndex: 3,
});
assert.equal(manualReplaySkip, null);

const manualReplayComplete = resolveTutorialPersistenceIntent({
  serverShowTutorial: false,
  action: 'completed',
  role: 'primary_admin',
  stepIndex: 5,
});
assert.equal(manualReplayComplete, null);

console.log('firstLoginFlowPersistence.test.mjs passed');
