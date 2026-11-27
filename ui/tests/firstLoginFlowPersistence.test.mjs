import assert from 'node:assert/strict';
import {
  canShowFirstLoginTour,
  isFirmWorkspaceRoute,
  resolveTutorialPersistenceIntent,
} from '../src/components/onboarding/firstLoginFlowPersistence.js';

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

assert.equal(isFirmWorkspaceRoute('/app/firm/gupte-opc/setup'), false);
assert.equal(isFirmWorkspaceRoute('/gupte-opc/setup'), false);
assert.equal(isFirmWorkspaceRoute('/app/superadmin'), false);
assert.equal(isFirmWorkspaceRoute('/signup'), false);
assert.equal(isFirmWorkspaceRoute('/app/firm/gupte-opc/worklist'), true);

const primaryAdminPendingSetup = {
  role: 'PRIMARY_ADMIN',
  firmSlug: 'gupte-opc',
  isSetupComplete: false,
  firm: { isSetupComplete: false },
  welcomeTutorial: { show: true },
};
assert.equal(
  canShowFirstLoginTour({ pathname: '/app/firm/gupte-opc/setup', user: primaryAdminPendingSetup }),
  false,
  'Product tour must stay hidden while on workspace setup route',
);
assert.equal(
  canShowFirstLoginTour({ pathname: '/app/firm/gupte-opc/worklist', user: primaryAdminPendingSetup }),
  false,
  'Product tour must wait until workspace setup is complete',
);

const primaryAdminCompletedSetup = {
  ...primaryAdminPendingSetup,
  isSetupComplete: true,
  firm: { isSetupComplete: true },
};
assert.equal(
  canShowFirstLoginTour({ pathname: '/app/firm/gupte-opc/worklist', user: primaryAdminCompletedSetup }),
  true,
  'Product tour must open automatically once Primary Admin enters workspace after setup',
);
assert.equal(
  canShowFirstLoginTour({
    pathname: '/app/superadmin',
    user: { role: 'SUPER_ADMIN', welcomeTutorial: { show: true } },
  }),
  false,
  'Product tour must stay hidden for superadmin routes',
);

console.log('firstLoginFlowPersistence.test.mjs passed');
