#!/usr/bin/env node
const assert = require('assert');
const { DateTime } = require('luxon');

// Unit test mocks for services
const CaseStatus = require('../src/domain/case/caseStatus');
const {
  isWorkingDay,
  alignToBusinessTime,
  handleStatusTransition,
  DEFAULT_SLA_CONFIG,
  normalizeConfig,
  computeElapsedMinutes,
  getEffectiveTatMinutes,
} = require('../src/services/caseSla.service');
const { toFirmSlaCalendarConfig } = require('../src/services/firmCalendar.service');

async function runTests() {
  console.log('--- Running Docket Pend / Unpend SLA Calendar & Workflow Tests ---');

  const firmCalendar = normalizeConfig({
    businessStartTime: '10:00',
    businessEndTime: '18:00',
    workingDays: [1, 2, 3, 4, 5], // Monday - Friday
    holidayDates: ['2026-03-04'], // Wednesday is a firm holiday
    timezone: 'UTC',
    tatDurationMinutes: 480, // 8 hours = 480 mins
  });

  // 1. isWorkingDay validations
  // 2026-03-01 is Sunday (weekday 7)
  const sunday = new Date('2026-03-01T12:00:00Z');
  assert.strictEqual(isWorkingDay(sunday, firmCalendar), false, 'Sunday should not be a working day');

  // 2026-03-02 is Monday (weekday 1)
  const monday = new Date('2026-03-02T12:00:00Z');
  assert.strictEqual(isWorkingDay(monday, firmCalendar), true, 'Monday should be a working day');

  // 2026-03-04 is Wednesday, but in holidayDates
  const wednesdayHoliday = new Date('2026-03-04T12:00:00Z');
  assert.strictEqual(isWorkingDay(wednesdayHoliday, firmCalendar), false, 'Wednesday firm holiday should not be a working day');

  // 2026-03-07 is Saturday (weekday 6)
  const saturday = new Date('2026-03-07T12:00:00Z');
  assert.strictEqual(isWorkingDay(saturday, firmCalendar), false, 'Saturday should not be a working day');

  console.log('✓ isWorkingDay accurately checks weekdays and holiday lists');

  // 2. alignToBusinessTime tests
  // Sunday 14:00 UTC -> should advance to Monday 10:00 UTC
  const alignedFromSunday = alignToBusinessTime(sunday, firmCalendar);
  assert.strictEqual(alignedFromSunday.toISODate(), '2026-03-02');
  assert.strictEqual(alignedFromSunday.hour, 10);
  assert.strictEqual(alignedFromSunday.minute, 0);

  // Tuesday evening 19:30 UTC -> should advance to next working day: Wednesday is holiday, so Thursday 10:00 UTC
  const tuesdayEvening = new Date('2026-03-03T19:30:00Z');
  const alignedFromTuesdayEve = alignToBusinessTime(tuesdayEvening, firmCalendar);
  assert.strictEqual(alignedFromTuesdayEve.toISODate(), '2026-03-05'); // Skipped Wednesday holiday!
  assert.strictEqual(alignedFromTuesdayEve.hour, 10);
  assert.strictEqual(alignedFromTuesdayEve.minute, 0);

  console.log('✓ alignToBusinessTime correctly advances past weekends and firm holidays to next 10:00 AM');

  // 3. handleStatusTransition tests: Pend and Unpend SLA invariants
  const baseDocket = {
    caseId: 'DOCK-001',
    firmId: 'F1',
    status: 'IN_PROGRESS',
    statusBeforePended: null,
    tatAccumulatedMinutes: 60, // 1 hour already spent
    tatLastStartedAt: new Date('2026-03-02T10:00:00Z'),
    tatPaused: false,
    slaDueAt: new Date('2026-03-02T18:00:00Z'),
    slaConfigSnapshot: firmCalendar,
  };

  // Step A: Pend the docket at 11:30 Monday (90 elapsed minutes)
  const pendTime = new Date('2026-03-02T11:30:00Z');
  const pendedTransition = handleStatusTransition(baseDocket, 'PENDING', {
    now: pendTime,
    userId: 'USER1',
    config: firmCalendar,
  });

  assert.strictEqual(pendedTransition.patch.tatPaused, true);
  assert.strictEqual(pendedTransition.patch.tatLastStartedAt, null);
  // 60 previous + 90 elapsed = 150 total minutes
  assert.strictEqual(pendedTransition.patch.tatAccumulatedMinutes, 150);
  assert.strictEqual(pendedTransition.auditEvent.event, 'SLA_PAUSED');

  console.log('✓ Status transition to PENDING pauses TAT and freezes accumulated minutes');

  // Step B: Unpend the docket on a Sunday (non-working day)
  // Docket is manually unpended on Sunday 2026-03-08 at 15:00 UTC
  const sundayUnpendTime = new Date('2026-03-08T15:00:00Z');
  const pendedDocket = {
    ...baseDocket,
    ...pendedTransition.patch,
    status: 'PENDING',
    statusBeforePended: 'IN_PROGRESS',
  };

  const unpendTransition = handleStatusTransition(pendedDocket, 'IN_PROGRESS', {
    now: sundayUnpendTime,
    userId: 'USER1',
    config: firmCalendar,
  });

  assert.strictEqual(unpendTransition.patch.tatPaused, false);
  // Invariant: tatLastStartedAt must be aligned to next working day: Monday 2026-03-09 at 10:00 AM!
  const alignedStart = new Date(unpendTransition.patch.tatLastStartedAt);
  const alignedDateTime = DateTime.fromJSDate(alignedStart, { zone: 'UTC' });
  assert.strictEqual(alignedDateTime.toISODate(), '2026-03-09');
  assert.strictEqual(alignedDateTime.hour, 10);
  assert.strictEqual(alignedDateTime.minute, 0);

  // Invariant: Sunday effective TAT must NOT tick!
  // If we check effective TAT on Sunday evening (2026-03-08 20:00 UTC):
  const sundayEvening = new Date('2026-03-08T20:00:00Z');
  const unpendedDocketOnSunday = {
    ...pendedDocket,
    ...unpendTransition.patch,
    status: 'IN_PROGRESS',
  };
  const effectiveTatOnSunday = getEffectiveTatMinutes(unpendedDocketOnSunday, sundayEvening);
  assert.strictEqual(effectiveTatOnSunday, 150, 'TAT must not increase over the weekend!');

  // Check effective TAT on Monday at 10:30 AM (30 mins after aligned business start):
  const mondayMorning = new Date('2026-03-09T10:30:00Z');
  const effectiveTatOnMonday = getEffectiveTatMinutes(unpendedDocketOnSunday, mondayMorning);
  assert.strictEqual(effectiveTatOnMonday, 180, 'TAT should only increase after Monday 10:00 AM (150 + 30 = 180)');

  // Invariant: slaDueAt was recalculated forward based on remaining 330 minutes (480 - 150) from Monday 10:00 AM!
  assert.ok(unpendTransition.patch.slaDueAt, 'slaDueAt must be recalculated on unpend');
  const dueDateTime = DateTime.fromJSDate(new Date(unpendTransition.patch.slaDueAt), { zone: 'UTC' });
  // 330 minutes = 5 hours 30 mins from 10:00 AM -> 15:30 on Monday 2026-03-09!
  assert.strictEqual(dueDateTime.toISODate(), '2026-03-09');
  assert.strictEqual(dueDateTime.hour, 15);
  assert.strictEqual(dueDateTime.minute, 30);

  console.log('✓ Manual unpend on non-working day aligns TAT start to Monday 10:00 AM and shifts SLA due date cleanly');

  // 4. Test docketWorkflow.service reopenDuePending calendar skipping
  // Mock Case.model and services
  const reopenDockets = [
    {
      _id: 'd1',
      caseId: 'DOCK-SUNDAY',
      firmId: 'FIRM-A',
      status: 'PENDING',
      assignedToXID: 'AGENT1',
      pendingUntil: new Date('2026-03-01T08:00:00Z'), // Past
    },
    {
      _id: 'd2',
      caseId: 'DOCK-MONDAY',
      firmId: 'FIRM-A',
      status: 'PENDING',
      assignedToXID: null,
      pendingUntil: new Date('2026-03-02T08:00:00Z'), // Past
    },
  ];

  let updateCalls = [];
  const CaseMock = {
    find: (filter) => {
      const p = Promise.resolve(reopenDockets);
      p.lean = async () => reopenDockets;
      return p;
    },
    updateOne: async (query, update) => {
      updateCalls.push({ query, update });
      return { modifiedCount: 1 };
    },
    updateMany: async () => ({ modifiedCount: 0 }),
    findOne: async () => null,
  };

  require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
  require.cache[require.resolve('../src/services/docketAudit.service')] = { exports: { logDocketEvent: async () => {}, createLog: async () => {} } };
  require.cache[require.resolve('../src/services/auditLog.service')] = { exports: { logCaseHistory: async () => {} } };
  require.cache[require.resolve('../src/services/docketActivity.service')] = { exports: { logActivitySafe: () => {} } };
  require.cache[require.resolve('../src/services/docketEvents.service')] = {
    exports: {
      EVENT_NAMES: { PENDING_REOPEN: 'PENDING_REOPEN' },
      emitDocketEvent: () => {},
    },
  };
  require.cache[require.resolve('../src/domain/notifications')] = { exports: { NotificationTypes: {}, createNotification: async () => {} } };

  // Mock getFirmSlaCalendarConfig to return Sunday non-working config
  require.cache[require.resolve('../src/services/firmCalendar.service')] = {
    exports: {
      BUSINESS_DAY_MINUTES: 480,
      getFirmSlaCalendarConfig: async () => firmCalendar,
      toFirmSlaCalendarConfig: () => firmCalendar,
    },
  };

  delete require.cache[require.resolve('../src/services/docketWorkflow.service')];
  const workflowSvc = require('../src/services/docketWorkflow.service');

  // Case A: Running reopenDuePending on Sunday
  // (We simulate Sunday by temporarily replacing Date or verifying logic)
  const sundayResult = await workflowSvc.reopenDuePending({ now: sunday });
  assert.strictEqual(sundayResult.count, 0, 'reopenDuePending on Sunday MUST reopen 0 dockets');
  assert.strictEqual(updateCalls.length, 0, 'No DB update calls made on Sunday');

  console.log('✓ reopenDuePending skips unpending on non-working days (Sunday)');

  // Case B: Running reopenDuePending on Wednesday (Holiday)
  const holidayResult = await workflowSvc.reopenDuePending({ now: wednesdayHoliday });
  assert.strictEqual(holidayResult.count, 0, 'reopenDuePending on firm holiday MUST reopen 0 dockets');
  assert.strictEqual(updateCalls.length, 0, 'No DB update calls made on firm holiday');

  console.log('✓ reopenDuePending skips unpending on firm holidays');

  // Case C: Running reopenDuePending on Monday (Working day)
  const mondayResult = await workflowSvc.reopenDuePending({ now: monday });
  assert.strictEqual(mondayResult.count, 2, 'reopenDuePending on Monday should unpend both due dockets');
  assert.strictEqual(updateCalls.length, 2, 'DB update executed for each docket');
  assert.strictEqual(updateCalls[0].update.$set.status, 'IN_PROGRESS');
  assert.strictEqual(updateCalls[0].update.$set.pendingUntil, null);
  assert.strictEqual(updateCalls[0].update.$set.pendedReason, null);
  assert.strictEqual(updateCalls[1].update.$set.status, 'UNASSIGNED');

  console.log('✓ reopenDuePending cleanly unpends due dockets on working business days');

  // 5. Test caseAction.service auto-reopen methods with calendar check
  delete require.cache[require.resolve('../src/services/caseAction.service')];
  let caseActionService = require('../src/services/caseAction.service');

  // Directly call performAutoReopen on a Sunday
  const docketToReopen = {
    caseId: 'DOCK-WEEKEND-SKIP',
    firmId: 'FIRM-A',
    status: 'PENDING',
    pendingUntil: new Date('2026-03-01T07:00:00Z'),
  };

  // We test the performAutoReopen internal guard by passing firmCalendar
  // Let's test autoReopenPendedCases when now is a non-working day
  // Mock Case.find
  CaseMock.find = () => [docketToReopen];

  // We can test autoReopenExpiredPendingCases
  // If invoked with firmCalendar where isWorkingDay is false for now:
  // Let's verify by overriding getFirmSlaCalendarConfig to return a calendar where today is non-working
  const allDaysOffCalendar = normalizeConfig({
    workingDays: [1, 2, 3, 4, 5],
    holidayDates: [DateTime.now().toISODate(), DateTime.now().setZone('UTC').toISODate()],
  });
  require.cache[require.resolve('../src/services/firmCalendar.service')].exports.getFirmSlaCalendarConfig = async () => allDaysOffCalendar;
  delete require.cache[require.resolve('../src/services/caseAction.service')];
  caseActionService = require('../src/services/caseAction.service');

  const expiredRes = await caseActionService.autoReopenExpiredPendingCases('AGENT1', 'FIRM-A');
  assert.strictEqual(expiredRes.count, 0, 'autoReopenExpiredPendingCases must not reopen when calendar indicates non-working day');

  const pendedRes = await caseActionService.autoReopenPendedCases('FIRM-A');
  assert.strictEqual(pendedRes.count, 0, 'autoReopenPendedCases must not reopen when calendar indicates non-working day');

  console.log('✓ autoReopenExpiredPendingCases and autoReopenPendedCases respect firm calendar and skip non-working days');

  console.log('--- ALL DOCKET PEND/UNPEND SLA CALENDAR TESTS PASSED ---');
}

runTests().catch((err) => {
  console.error('Docket Pend/Unpend SLA Calendar test failed:', err);
  process.exit(1);
});
