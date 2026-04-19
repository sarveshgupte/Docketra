#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const createdEvents = [];
let telemetryDoc = {
  onboardingTelemetry: {
    lastProgressRole: 'ADMIN',
    lastCompletedStepIds: [],
    lastIncompleteStepIds: ['active-client'],
    lastProgressCompleted: 0,
    lastProgressTotal: 1,
  },
};

const mockUserModel = {
  findById() {
    return {
      select() {
        return {
          lean: async () => telemetryDoc,
        };
      },
    };
  },
  async updateOne() {
    return { acknowledged: true };
  },
  async aggregate() {
    return [
      { _id: 'ADMIN', completedUsers: 3, incompleteUsers: 2, noProgressYet: 1, totalUsers: 6 },
    ];
  },
  find(query) {
    const records = query.role === 'MANAGER'
      ? [{ _id: 'm1' }, { _id: 'm2' }]
      : [{ xID: 'X100001' }, { xID: 'X100002' }];
    return {
      select() {
        return {
          lean: async () => records,
        };
      },
    };
  },
  async countDocuments() {
    return 1;
  },
};

const mockOnboardingEventModel = {
  async create(payload) {
    createdEvents.push(payload);
    return payload;
  },
  async aggregate(pipeline) {
    const firstMatch = pipeline?.[0]?.$match || {};
    if (firstMatch?.eventName?.$in?.includes('welcome_tutorial_completed')) {
      return [{ _id: 'welcome_tutorial_completed', count: 4 }, { _id: 'welcome_tutorial_skipped', count: 2 }];
    }
    if (firstMatch?.eventName?.$in?.includes('onboarding_step_completed_detected')) {
      return [{ _id: { role: 'ADMIN', stepId: 'active-client', eventName: 'onboarding_step_completed_detected' }, count: 5 }];
    }
    return [{ role: 'ADMIN', stepId: 'active-client', users: 2, firms: 1 }];
  },
  find() {
    return {
      sort() {
        return {
          limit() {
            return {
              select() {
                return {
                  lean: async () => [{ eventName: 'onboarding_progress_refreshed' }],
                };
              },
            };
          },
        };
      },
    };
  },
};

Module._load = function (request, parent, isMain) {
  if (request === '../models/User.model') return mockUserModel;
  if (request === '../models/Firm.model') return { countDocuments: async () => 5 };
  if (request === '../models/Client.model') return { distinct: async () => ['f1', 'f2'] };
  if (request === '../models/Category.model') return { distinct: async () => ['f1'] };
  if (request === '../models/Team.model') return { distinct: async (field) => (field === 'firmId' ? ['f1', 'f2'] : ['m1']) };
  if (request === '../models/Case.model') return { distinct: async () => ['X100001'] };
  if (request === '../models/OnboardingEvent.model') {
    return {
      OnboardingEvent: mockOnboardingEventModel,
      ONBOARDING_EVENT_NAMES: [
        'welcome_tutorial_shown',
        'welcome_tutorial_completed',
        'welcome_tutorial_skipped',
        'product_tour_started',
        'product_tour_completed',
        'onboarding_progress_refreshed',
        'onboarding_step_completed_detected',
        'onboarding_step_completed_manual',
        'onboarding_step_cta_opened',
        'onboarding_checklist_dismissed',
      ],
    };
  }
  if (request === '../utils/role.utils') return { normalizeRole: (role) => String(role || '').toUpperCase() || 'USER' };
  if (request === 'mongoose') return { Types: { ObjectId: function ObjectId() {} } };
  return originalLoad.apply(this, arguments);
};

async function run() {
  const service = require('../src/services/onboardingAnalytics.service');

  await service.createEvent({
    user: { _id: 'u1', xID: 'x123', role: 'ADMIN' },
    firmId: 'f1',
    eventName: 'product_tour_started',
  });
  assert.equal(createdEvents.length, 1, 'should persist onboarding event');

  const progressPayload = {
    user: { _id: 'u1', xID: 'x123', role: 'ADMIN' },
    firmId: 'f1',
    role: 'ADMIN',
    steps: [{ id: 'active-client', completed: true }],
  };

  const first = await service.recordProgressIfChanged(progressPayload);
  assert.equal(first.changed, true, 'first changed progress should be recorded');

  telemetryDoc = {
    onboardingTelemetry: {
      lastProgressRole: 'ADMIN',
      lastCompletedStepIds: ['active-client'],
      lastIncompleteStepIds: [],
      lastProgressCompleted: 1,
      lastProgressTotal: 1,
    },
  };
  const second = await service.recordProgressIfChanged(progressPayload);
  assert.equal(second.changed, false, 'unchanged progress should not emit duplicate events');

  const summary = await service.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 3, recentLimit: 5 });
  assert.equal(summary.firmOverview.totalFirms, 5);
  assert.equal(summary.tutorialFunnel.completed, 4);
  assert.equal(summary.blockers.managersWithoutAssignedQueues, 1);
  assert.equal(summary.blockers.usersWithoutAssignedDockets, 1);

  console.log('onboardingAnalytics.service.test.js passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
