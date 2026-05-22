const assert = require('assert');

const notifications = [];
const existingKeys = new Set();

const CaseMock = { find: async () => [] };
const TeamMock = { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'T1' }) }) }) };
const UserMock = { find: () => ({ select: () => ({ lean: async () => ([{ xID: 'X000002' }, { xID: 'X000003' }]) }) }) };
const NotificationMock = {
  findOne(query) {
    const key = `${query.firmId}|${query.userId}|${query.docketId}|${query.type}|${query['metadata.dueDateKey']}`;
    const exists = existingKeys.has(key);
    return { select: () => ({ lean: async () => (exists ? { _id: 'n1' } : null) }) };
  }
};

require.cache[require.resolve('../src/models/Case.model')] = { exports: CaseMock };
require.cache[require.resolve('../src/models/Team.model')] = { exports: TeamMock };
require.cache[require.resolve('../src/models/User.model')] = { exports: UserMock };
require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
require.cache[require.resolve('../src/services/notification.service')] = { exports: {
  NotificationTypes: { DOCKET_DUE_SOON: 'DOCKET_DUE_SOON', DOCKET_OVERDUE: 'DOCKET_OVERDUE' },
  createNotification: async (payload) => { notifications.push(payload); if (payload.type !== 'FAIL') existingKeys.add(`${payload.firmId}|${payload.recipientXID}|${payload.docketId}|${payload.type}|${payload.metadata?.dueDateKey}`); },
}};

const { processDocketDueNotifications } = require('../src/services/docketDueNotification.service');

(async () => {
  const now = new Date('2026-05-22T10:00:00.000Z');
  CaseMock.find = async () => ([
    { caseId: 'D1', firmId: 'F1', dueDate: new Date('2026-05-23T09:00:00.000Z'), status: 'IN_PROGRESS', assignedToXID: 'x000001' },
    { caseId: 'D2', firmId: 'F1', dueDate: new Date('2026-05-24T10:00:00.000Z'), status: 'IN_PROGRESS', assignedToXID: 'X000001' },
    { caseId: 'D3', firmId: 'F1', dueDate: new Date('2026-05-21T10:00:00.000Z'), status: 'OPEN', assignedToXID: 'X000001' },
    { caseId: 'D4', firmId: 'F1', dueDate: new Date('2026-05-23T09:00:00.000Z'), status: 'FILED', assignedToXID: 'X000001' },
    { caseId: 'D5', firmId: 'F1', dueDate: null, status: 'OPEN', assignedToXID: 'X000001' },
    { caseId: 'D6', firmId: 'F1', dueDate: new Date('2026-05-23T08:00:00.000Z'), status: 'OPEN', assignedToXID: null, workbasketId: 'T1' },
  ]);

  notifications.length = 0;
  existingKeys.clear();
  await processDocketDueNotifications({ now });

  assert.equal(notifications.some((n) => n.docketId === 'D1' && n.type === 'DOCKET_DUE_SOON' && n.recipientXID === 'X000001'), true);
  assert.equal(notifications.some((n) => n.docketId === 'D2'), false);
  assert.equal(notifications.some((n) => n.docketId === 'D3' && n.type === 'DOCKET_OVERDUE'), true);
  assert.equal(notifications.some((n) => n.docketId === 'D4'), false);
  assert.equal(notifications.some((n) => n.docketId === 'D5'), false);
  assert.equal(notifications.filter((n) => n.docketId === 'D6').length, 2);

  const firstCount = notifications.length;
  await processDocketDueNotifications({ now });
  assert.equal(notifications.length, firstCount);

  CaseMock.find = async () => ([
    { caseId: 'D1', firmId: 'F1', dueDate: new Date('2026-05-23T09:30:00.000Z'), status: 'IN_PROGRESS', assignedToXID: 'X000001' },
  ]);
  await processDocketDueNotifications({ now });
  assert.equal(notifications.length, firstCount + 1);

  console.log('docketDueNotifications.test.js passed');
})();
