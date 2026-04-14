#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');
const TenantSlaConfig = require('../src/models/TenantSlaConfig.model');
const SlaRule = require('../src/models/SlaRule.model');
const caseSlaService = require('../src/services/caseSla.service');
const slaService = require('../src/services/sla.service');

function testCreationInsideBusinessHours() {
  const config = {
    tatDurationMinutes: 480,
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: [1, 2, 3, 4, 5],
  };
  const start = new Date('2026-03-02T16:00:00.000Z'); // Monday
  const due = caseSlaService.calculateDueDate(start, config.tatDurationMinutes, config);
  assert.strictEqual(due.toISOString(), '2026-03-03T16:00:00.000Z');
}

function testCreationOutsideBusinessHours() {
  const config = {
    tatDurationMinutes: 60,
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: [1, 2, 3, 4, 5],
  };
  const start = new Date('2026-03-02T21:00:00.000Z');
  const due = caseSlaService.calculateDueDate(start, config.tatDurationMinutes, config);
  assert.strictEqual(due.toISOString(), '2026-03-03T11:00:00.000Z');
}

function testWeekendRollover() {
  const config = {
    tatDurationMinutes: 120,
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: [1, 2, 3, 4, 5],
  };
  const start = new Date('2026-03-06T17:00:00.000Z'); // Friday
  const due = caseSlaService.calculateDueDate(start, config.tatDurationMinutes, config);
  assert.strictEqual(due.toISOString(), '2026-03-09T11:00:00.000Z'); // Monday
}

function testTenantTimezoneCalendar() {
  const config = {
    tatDurationMinutes: 120,
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: [1, 2, 3, 4, 5],
    timezone: 'Asia/Kolkata',
  };
  const start = new Date('2026-03-02T11:30:00.000Z'); // 17:00 IST
  const due = caseSlaService.calculateDueDate(start, config.tatDurationMinutes, config);
  assert.strictEqual(due.toISOString(), '2026-03-03T05:30:00.000Z'); // 11:00 IST next day
}

function testMultiPauseScenario() {
  const initialCase = {
    status: 'OPEN',
    tatPaused: false,
    tatLastStartedAt: new Date('2026-03-02T10:00:00.000Z'),
    tatAccumulatedMinutes: 0,
  };

  const pausedOnce = caseSlaService.handleStatusTransition(
    initialCase,
    'PENDING',
    { now: new Date('2026-03-02T11:00:00.000Z'), userId: 'X111111' }
  );
  assert.strictEqual(pausedOnce.patch.tatAccumulatedMinutes, 60);
  assert.strictEqual(pausedOnce.auditEvent.event, 'SLA_PAUSED');

  const resumed = caseSlaService.handleStatusTransition(
    { ...initialCase, ...pausedOnce.patch, status: 'PENDING' },
    'OPEN',
    { now: new Date('2026-03-02T12:00:00.000Z'), userId: 'X111111' }
  );
  assert.strictEqual(resumed.patch.tatPaused, false);
  assert.strictEqual(resumed.auditEvent.event, 'SLA_RESUMED');

  const pausedTwice = caseSlaService.handleStatusTransition(
    { ...initialCase, ...pausedOnce.patch, ...resumed.patch, status: 'OPEN' },
    'PENDING',
    { now: new Date('2026-03-02T12:30:00.000Z'), userId: 'X111111' }
  );
  assert.strictEqual(pausedTwice.patch.tatAccumulatedMinutes, 90);
}

function testSingleSlaFieldContract() {
  assert.strictEqual(Boolean(Case.schema.path('slaDueDate')), false);
  assert.strictEqual(Boolean(Case.schema.path('slaDueAt')), true);
}

function testBreachDetection() {
  const breached = caseSlaService.isBreached({
    status: 'OPEN',
    slaDueAt: new Date('2026-03-02T10:00:00.000Z'),
  }, new Date('2026-03-02T10:01:00.000Z'));
  const notBreached = caseSlaService.isBreached({
    status: 'RESOLVED',
    slaDueAt: new Date('2026-03-02T10:00:00.000Z'),
  }, new Date('2026-03-02T10:30:00.000Z'));
  assert.strictEqual(breached, true);
  assert.strictEqual(notBreached, false);
}

async function testCrossTenantIsolation() {
  const originalFindOne = TenantSlaConfig.findOne;
  const calls = [];

  TenantSlaConfig.findOne = (query) => ({
    lean: async () => {
      calls.push(query);
      if (query.firmId === 'firm-a' && query.caseType === 'Litigation') {
        return {
          firmId: 'firm-a',
          caseType: 'Litigation',
          tatDurationMinutes: 30,
          businessStartTime: '10:00',
          businessEndTime: '18:00',
          workingDays: [1, 2, 3, 4, 5],
          timezone: 'Asia/Kolkata',
        };
      }
      return null;
    },
  });

  try {
    const initialized = await caseSlaService.initializeCaseSla({
      tenantId: 'firm-a',
      caseType: 'Litigation',
      now: new Date('2026-03-02T10:00:00.000Z'),
    });
    assert.strictEqual(initialized.slaDueAt.toISOString(), '2026-03-02T10:30:00.000Z');
    assert.deepStrictEqual(calls[0], { firmId: 'firm-a', caseType: 'Litigation' });
    assert.ok(!calls.some((query) => query.firmId === 'firm-b'));
  } finally {
    TenantSlaConfig.findOne = originalFindOne;
  }
}

async function testResolveSlaRulePriority() {
  const originalFind = SlaRule.find;
  SlaRule.find = () => ({
    lean: async () => ([
      { firmId: 'firm-a', slaHours: 72, updatedAt: '2026-03-01T00:00:00.000Z' },
      { firmId: 'firm-a', category: 'Tax', slaHours: 24, updatedAt: '2026-03-02T00:00:00.000Z' },
      { firmId: 'firm-a', workbasketId: 'wb-1', slaHours: 12, updatedAt: '2026-03-03T00:00:00.000Z' },
      { firmId: 'firm-a', category: 'Tax', subcategory: 'GST Filing', slaHours: 8, updatedAt: '2026-03-04T00:00:00.000Z' },
    ]),
  });

  try {
    const rule = await slaService.resolveSlaRule({
      firmId: 'firm-a',
      category: 'Tax',
      subcategory: 'GST Filing',
      workbasketId: 'wb-1',
    });
    assert.strictEqual(rule.slaHours, 8);

    const categoryRule = await slaService.resolveSlaRule({
      firmId: 'firm-a',
      category: 'Tax',
      subcategory: 'Other',
      workbasketId: 'wb-1',
    });
    assert.strictEqual(categoryRule.slaHours, 24);
  } finally {
    SlaRule.find = originalFind;
  }
}

async function testCalculateDocketSlaDueDate() {
  const due = await slaService.calculateSlaDueDate({
    createdAt: new Date('2026-03-06T17:00:00.000Z'),
  }, { rule: { slaHours: 2 } });
  assert.strictEqual(due.toISOString(), '2026-03-09T11:00:00.000Z');
}

function testSlaStatusTrafficLight() {
  assert.strictEqual(slaService.getSlaStatus({ status: 'OPEN', slaDueAt: new Date(Date.now() + (48 * 60 * 60 * 1000)) }), 'GREEN');
  assert.strictEqual(slaService.getSlaStatus({ status: 'OPEN', slaDueAt: new Date(Date.now() + (2 * 60 * 60 * 1000)) }), 'YELLOW');
  assert.strictEqual(slaService.getSlaStatus({ status: 'OPEN', slaDueAt: new Date(Date.now() - (2 * 60 * 60 * 1000)) }), 'RED');
}

async function testWeeklySlaSummary() {
  const originalCountDocuments = Case.countDocuments;
  const counts = [5, 2, 3, 4, 6, 1];
  Case.countDocuments = async () => counts.shift();

  try {
    const summary = await slaService.getWeeklySlaSummary('firm-a', { now: new Date('2026-03-06T12:00:00.000Z') });
    assert.strictEqual(summary.createdThisWeek, 5);
    assert.strictEqual(summary.currentlyOverdue, 2);
    assert.strictEqual(summary.dueSoon, 3);
    assert.strictEqual(summary.onTrack, 4);
    assert.strictEqual(summary.resolvedWithinSla, 6);
    assert.strictEqual(summary.resolvedAfterBreach, 1);
  } finally {
    Case.countDocuments = originalCountDocuments;
  }
}

async function run() {
  try {
    testCreationInsideBusinessHours();
    testCreationOutsideBusinessHours();
    testWeekendRollover();
    testTenantTimezoneCalendar();
    testMultiPauseScenario();
    testBreachDetection();
    testSingleSlaFieldContract();
    await testCrossTenantIsolation();
    await testResolveSlaRulePriority();
    await testCalculateDocketSlaDueDate();
    testSlaStatusTrafficLight();
    await testWeeklySlaSummary();
    console.log('Case SLA service tests passed.');
  } catch (error) {
    console.error('Case SLA service tests failed:', error);
    process.exit(1);
  }
}

run();
