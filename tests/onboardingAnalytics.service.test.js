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
    let records;
    if (query.role === 'MANAGER') {
      records = [{ _id: 'm1' }, { _id: 'm2' }];
    } else if (query.role === 'USER') {
      records = [{ xID: 'X100001' }, { xID: 'X100002' }];
    } else {
      const isFirmScoped = Boolean(query && Object.prototype.hasOwnProperty.call(query, 'firmId'));
      records = isFirmScoped
        ? []
        : [
        {
          _id: 'u1',
          firmId: 'f1',
          role: 'MANAGER',
          xID: 'X100001',
          onboardingTelemetry: {
            lastProgressCompleted: 1,
            lastProgressTotal: 3,
            lastIncompleteStepIds: ['queue-assignment'],
            lastProgressRefreshedAt: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)),
          },
          tutorialState: {
            skippedAt: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)),
          },
        },
      ];
    }
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
  if (request === '../models/Firm.model') {
    return {
      countDocuments: async () => 5,
      find() {
        return {
          select() {
            return {
              lean: async () => [{ _id: 'f1', name: 'Firm One', firmId: 'FIRM001', firmSlug: 'firm-one', status: 'active' }],
            };
          },
        };
      },
    };
  }
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

  const details = await service.getOnboardingInsightDetails({ sinceDays: 30, staleAfterDays: 3, completionState: 'all' });
  assert.ok(Array.isArray(details.firms), 'details should include firm rows');
  assert.ok(Array.isArray(details.users), 'details should include user rows');
  assert.ok(Array.isArray(details.topBlockers), 'details should include top blockers');
  assert.ok(details.firms.length >= 1, 'should return at least one firm');


  const filtered = await service.getOnboardingInsightDetails({
    sinceDays: 30,
    staleAfterDays: 3,
    completionState: 'all',
    firmId: '507f1f77bcf86cd799439011',
  });
  assert.ok(filtered.filtersApplied.firmId, 'firm filter should be reflected in response metadata');
  assert.ok(filtered.firms.length <= 1, 'firm filter should limit firm rows to one tenant');
  if (filtered.firms[0]) {
    assert.ok(typeof filtered.firms[0].nextAction === 'string' && filtered.firms[0].nextAction.length > 0, 'firm guidance should provide actionable next-step text');
  }

  const alerts = await service.getOnboardingAlerts({
    sinceDays: 30,
    staleAfterDays: 3,
    status: 'open',
    limit: 20,
  });
  assert.ok(Array.isArray(alerts.alerts), 'alerts payload should include alert rows');
  assert.ok(alerts.alerts.length >= 1, 'open blockers should produce at least one alert');
  const firstAlert = alerts.alerts[0];
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(firstAlert.severity), 'alert severity should be classified');
  assert.ok(firstAlert.links?.onboardingDetail?.includes('/app/superadmin/onboarding-insights/'), 'alert should include onboarding detail deep link');
  assert.equal(new Set(alerts.alerts.map((entry) => entry.id)).size, alerts.alerts.length, 'alerts should be deduped to one open alert per firm/blocker');

  const highOnly = await service.getOnboardingAlerts({
    sinceDays: 30,
    staleAfterDays: 3,
    severity: 'HIGH',
  });
  assert.ok(highOnly.alerts.every((entry) => entry.severity === 'HIGH'), 'severity filter should only return requested severity');

  const resolved = await service.getOnboardingAlerts({
    sinceDays: 30,
    staleAfterDays: 3,
    status: 'resolved',
  });
  assert.equal(resolved.alerts.length, 0, 'resolved alerts are derived and should disappear when no longer open');

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
