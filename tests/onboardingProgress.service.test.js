#!/usr/bin/env node
const assert = require('assert');

const MODEL_KEYS = [
  '../src/models/Firm.model',
  '../src/models/Client.model',
  '../src/models/Category.model',
  '../src/models/Team.model',
  '../src/models/User.model',
  '../src/models/Case.model',
  '../src/models/DocketActivity.model',
  '../src/services/onboardingProgress.service.js',
];

const state = {
  role: 'PRIMARY_ADMIN',
  counts: {
    activeClients: 0,
    categories: 0,
    categoriesWithSub: 0,
    primaryTeams: 0,
    dockets: 0,
    invitedUsers: 0,
    unassignedDockets: 0,
    userTeams: 0,
    managedTeams: 0,
    qcMappings: 0,
    visibleQueue: 0,
    userAssignedDockets: 0,
    activity: 0,
  },
  firm: {
    isSetupComplete: false,
    storage: { mode: 'docketra_managed' },
    storageConfig: { provider: null },
  },
};

function clearMocks() {
  MODEL_KEYS.forEach((key) => {
    try { delete require.cache[require.resolve(key)]; } catch (_error) { /* noop */ }
  });
}

function setupMocks() {
  require.cache[require.resolve('../src/models/Firm.model')] = {
    exports: {
      findById: () => ({ select: () => ({ lean: async () => state.firm }) }),
    },
  };
  require.cache[require.resolve('../src/models/Client.model')] = {
    exports: { exists: async () => state.counts.activeClients > 0 ? { _id: 'mock_id' } : null },
  };

  let categoryCall = 0;
  require.cache[require.resolve('../src/models/Category.model')] = {
    exports: {
      exists: async () => {
        categoryCall += 1;
        const val = categoryCall === 1 ? state.counts.categories : state.counts.categoriesWithSub;
        return val > 0 ? { _id: 'mock_id' } : null;
      },
    },
  };

  let teamCall = 0;
  require.cache[require.resolve('../src/models/Team.model')] = {
    exports: {
      exists: async () => {
        teamCall += 1;
        let val;
        if (teamCall === 1) val = state.counts.primaryTeams;
        else if (teamCall === 2) val = state.counts.userTeams;
        else if (teamCall === 3) val = state.counts.managedTeams;
        else val = state.counts.qcMappings;
        return val > 0 ? { _id: 'mock_id' } : null;
      },
    },
  };

  require.cache[require.resolve('../src/models/User.model')] = {
    exports: { exists: async () => state.counts.invitedUsers > 0 ? { _id: 'mock_id' } : null },
  };

  let caseCall = 0;
  require.cache[require.resolve('../src/models/Case.model')] = {
    exports: {
      exists: async () => {
        caseCall += 1;
        let val;
        if (caseCall === 1) val = state.counts.dockets;
        else if (caseCall === 2) val = state.counts.unassignedDockets;
        else if (caseCall === 3) val = state.counts.visibleQueue;
        else val = state.counts.userAssignedDockets;
        return val > 0 ? { _id: 'mock_id' } : null;
      },
    },
  };

  require.cache[require.resolve('../src/models/DocketActivity.model')] = {
    exports: {
      DocketActivity: { exists: async () => state.counts.activity > 0 ? { _id: 'mock_id' } : null },
    },
  };
}

async function run() {
  console.log('Running onboardingProgress.service.test.js...');

  clearMocks();
  setupMocks();
  let service = require('../src/services/onboardingProgress.service');
  let progress = await service.getOnboardingProgress({
    firmId: '507f1f77bcf86cd799439011',
    user: { role: 'PRIMARY_ADMIN', _id: '507f1f77bcf86cd799439022', xID: 'X000001', teamIds: [] },
  });
  assert.strictEqual(progress.steps.find((s) => s.id === 'create-docket').completed, false);
  assert.strictEqual(progress.steps.find((s) => s.id === 'firm-profile').completed, false);
  assert.strictEqual(progress.steps.find((s) => s.id === 'firm-profile').completionMode, 'detected');
  assert.ok(progress.blockers.some((b) => b.code === 'setup_incomplete'));
  assert.ok(progress.blockers.some((b) => b.code === 'missing_routing'));
  console.log('✅ primary admin conservative defaults passed');

  clearMocks();
  state.counts.dockets = 4;
  state.counts.unassignedDockets = 0;
  state.counts.primaryTeams = 2;
  state.counts.activeClients = 1;
  state.counts.categories = 2;
  state.firm.isSetupComplete = true;
  state.firm.storage = { mode: 'firm_connected' };
  state.firm.storageConfig = { provider: 's3' };
  setupMocks();
  service = require('../src/services/onboardingProgress.service');
  progress = await service.getOnboardingProgress({
    firmId: '507f1f77bcf86cd799439011',
    user: { role: 'ADMIN', _id: '507f1f77bcf86cd799439022', xID: 'X000002', teamIds: [] },
  });
  assert.strictEqual(progress.steps.find((s) => s.id === 'create-docket').completed, true);
  assert.strictEqual(progress.steps.find((s) => s.id === 'unassigned-reviewed').completed, true);
  assert.strictEqual(progress.blockers.some((b) => b.code === 'setup_incomplete'), false);
  console.log('✅ admin detected signals passed');

  clearMocks();
  state.counts.managedTeams = 0;
  state.counts.userTeams = 0;
  state.counts.visibleQueue = 0;
  state.counts.qcMappings = 0;
  setupMocks();
  service = require('../src/services/onboardingProgress.service');
  progress = await service.getOnboardingProgress({
    firmId: '507f1f77bcf86cd799439011',
    user: { role: 'MANAGER', _id: '507f1f77bcf86cd799439022', xID: 'X000003', teamIds: [] },
  });
  assert.strictEqual(progress.steps.every((step) => step.completed === false), true);
  console.log('✅ manager fallback behavior passed');

  clearMocks();
  state.counts.userTeams = 1;
  state.counts.userAssignedDockets = 1;
  state.counts.activity = 1;
  setupMocks();
  service = require('../src/services/onboardingProgress.service');
  progress = await service.getOnboardingProgress({
    firmId: '507f1f77bcf86cd799439011',
    user: { role: 'USER', _id: '507f1f77bcf86cd799439022', xID: 'X000004', teamIds: [] },
  });
  assert.strictEqual(progress.completed, progress.total);
  console.log('✅ user workflow detection passed');
}

run().catch((error) => {
  console.error('❌ onboardingProgress.service.test.js failed');
  console.error(error);
  process.exit(1);
});
