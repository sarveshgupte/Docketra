const assert = require('assert');
const { getTutorialStatus, shouldShowWelcomeTutorial } = require('../src/utils/tutorialState.utils');

(() => {
  const pendingUser = {};
  assert.strictEqual(getTutorialStatus(pendingUser), 'pending');
  assert.strictEqual(shouldShowWelcomeTutorial(pendingUser), true);

  const skippedUser = { tutorialState: { skippedAt: new Date('2026-01-01T00:00:00.000Z') } };
  assert.strictEqual(getTutorialStatus(skippedUser), 'skipped');
  assert.strictEqual(shouldShowWelcomeTutorial(skippedUser), false);

  const completedLegacyUser = { tutorialCompletedAt: new Date('2025-01-01T00:00:00.000Z') };
  assert.strictEqual(getTutorialStatus(completedLegacyUser), 'completed');
  assert.strictEqual(shouldShowWelcomeTutorial(completedLegacyUser), false);

  const completedStateUser = { tutorialState: { completedAt: new Date('2026-02-01T00:00:00.000Z') } };
  assert.strictEqual(getTutorialStatus(completedStateUser), 'completed');
  assert.strictEqual(shouldShowWelcomeTutorial(completedStateUser), false);

  const completedDominatesSkipped = {
    tutorialCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
    tutorialState: { skippedAt: new Date('2026-01-02T00:00:00.000Z') },
  };
  assert.strictEqual(getTutorialStatus(completedDominatesSkipped), 'completed');
  assert.strictEqual(shouldShowWelcomeTutorial(completedDominatesSkipped), false);
})();

console.log('tutorialState.utils.test.js passed');
