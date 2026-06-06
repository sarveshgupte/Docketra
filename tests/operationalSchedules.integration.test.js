#!/usr/bin/env node
const assert = require('assert');

const savedFirmSettings = {
  slaDefaultDays: 2,
  slaWorkingDays: [1, 2, 3, 4, 5],
  slaHolidayDates: ['2026-03-03'],
  slaWorkingDateOverrides: ['2026-03-07'],
  calendarReminderLeadDays: 5,
  escalationInactivityThresholdHours: 24,
  workloadThreshold: 15,
  enablePerformanceView: true,
  enableEscalationView: true,
  enableBulkActions: true,
  brandLogoUrl: '',
};

let taskRows = [];
const notifications = [];

const chain = (value) => ({
  select: () => chain(value),
  lean: async () => value,
});

require.cache[require.resolve('../src/models/Firm.model')] = {
  exports: {
    findById: () => ({
      select: () => ({
        lean: async () => ({
          _id: 'firm-a',
          settings: { firm: savedFirmSettings },
        }),
      }),
    }),
  },
};

require.cache[require.resolve('../src/models/Task')] = {
  exports: {
    find: () => ({
      select: () => ({
        lean: async () => taskRows,
      }),
    }),
  },
};

require.cache[require.resolve('../src/models/User.model')] = {
  exports: {
    find: () => ({
      select: () => ({
        lean: async () => ([
          { xID: 'X001' },
        ]),
      }),
    }),
  },
};

require.cache[require.resolve('../src/models/Notification.model')] = {
  exports: {
    findOne: () => chain(null),
  },
};

require.cache[require.resolve('../src/services/notification.service')] = {
  exports: {
    NotificationTypes: {
      FIRM_CALENDAR_REMINDER: 'FIRM_CALENDAR_REMINDER',
      DOCKET_DUE_SOON: 'DOCKET_DUE_SOON',
      DOCKET_OVERDUE: 'DOCKET_OVERDUE',
    },
    createNotification: async (payload) => {
      notifications.push(payload);
      return { _id: `n${notifications.length}` };
    },
  },
};

require.cache[require.resolve('../src/models/Case.model')] = {
  exports: {
    find: () => ({
      select: () => ({
        lean: async () => [],
      }),
    }),
  },
};

const { getFirmSlaCalendarConfig } = require('../src/services/firmCalendar.service');
const caseSlaService = require('../src/services/caseSla.service');
const { processFirmCalendarReminders } = require('../src/services/docketDueNotification.service');

async function testSavedOperationalScheduleFeedsSlaDueDate() {
  const config = await getFirmSlaCalendarConfig('firm-a');
  assert.strictEqual(config.tatDurationMinutes, 16 * 60);
  assert.deepStrictEqual(config.workingDays, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(config.holidayDates, ['2026-03-03']);
  assert.deepStrictEqual(config.workingDateOverrides, ['2026-03-07']);

  const initialized = await caseSlaService.initializeCaseSla({
    tenantId: 'firm-a',
    caseType: 'Litigation',
    now: new Date('2026-03-02T04:30:00.000Z'),
    calendarConfig: config,
  });

  assert.strictEqual(initialized.slaDueAt.toISOString(), '2026-03-04T12:30:00.000Z');
  assert.strictEqual(initialized.tatPaused, false);
}

function testPendAndUnpendResumeSlaState() {
  const start = new Date('2026-03-02T04:30:00.000Z');
  const pending = caseSlaService.handleStatusTransition(
    {
      status: 'OPEN',
      tatPaused: false,
      tatLastStartedAt: start,
      tatAccumulatedMinutes: 0,
    },
    'PENDING',
    { now: new Date('2026-03-02T08:30:00.000Z'), userId: 'X001' },
  );

  assert.strictEqual(pending.patch.tatPaused, true);
  assert.strictEqual(pending.patch.tatAccumulatedMinutes, 240);
  assert.strictEqual(pending.auditEvent.event, 'SLA_PAUSED');

  const resumed = caseSlaService.handleStatusTransition(
    {
      status: 'PENDING',
      tatPaused: true,
      tatLastStartedAt: null,
      tatAccumulatedMinutes: pending.patch.tatAccumulatedMinutes,
    },
    'OPEN',
    { now: new Date('2026-03-04T04:30:00.000Z'), userId: 'X001' },
  );

  assert.strictEqual(resumed.patch.tatPaused, false);
  assert.strictEqual(resumed.patch.tatLastStartedAt.toISOString(), '2026-03-04T04:30:00.000Z');
  assert.strictEqual(resumed.auditEvent.event, 'SLA_RESUMED');
}

async function testCalendarRemindersUseSavedLeadDays() {
  taskRows = [{
    _id: 'task-1',
    firmId: 'firm-a',
    title: 'GST filing',
    description: 'Quarterly filing reminder',
    dueDate: new Date('2026-03-10T00:00:00.000Z'),
    calendarEntryType: 'important_date',
    reminderDaysBefore: undefined,
  }];
  notifications.length = 0;

  const result = await processFirmCalendarReminders({ now: new Date('2026-03-05T00:00:00.000Z') });
  assert.strictEqual(result.scanned, 1);
  assert.strictEqual(result.created, 1);
  assert.strictEqual(notifications.length, 1);
  assert.strictEqual(notifications[0].recipientXID, 'X001');
  assert.strictEqual(notifications[0].metadata.reminderDaysBefore, 5);
  assert.strictEqual(notifications[0].metadata.calendarEntryId, 'task-1');
  assert.strictEqual(notifications[0].title, 'Important date reminder');
}

async function run() {
  try {
    await testSavedOperationalScheduleFeedsSlaDueDate();
    testPendAndUnpendResumeSlaState();
    await testCalendarRemindersUseSavedLeadDays();
    console.log('Operational schedules integration tests passed.');
  } catch (error) {
    console.error('Operational schedules integration tests failed:', error);
    process.exit(1);
  }
}

run();
