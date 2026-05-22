const assert = require('assert');

const notifications = [];
const existingKeys = new Set();

const CaseMock = { find: async () => [] };
const TeamMock = { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'T1' }) }) }) };

const userFixtures = [
  { xID: 'XTEAMIDS', firmId: 'F1', status: 'active', isActive: true, teamIds: ['T1'] },
  { xID: 'XTEAMID', firmId: 'F1', status: 'active', isActive: true, teamId: 'T1' },
  { xID: 'XDELETED', firmId: 'F1', status: 'deleted', isActive: true, teamIds: ['T1'] },
  { xID: 'XINACTIVE', firmId: 'F1', status: 'active', isActive: false, teamIds: ['T1'] },
  { xID: 'XOTHERFIRM', firmId: 'F2', status: 'active', isActive: true, teamIds: ['T1'] },
];

const UserMock = {
  find(query) {
    const wb = String(query?.$or?.[0]?.teamIds || query?.$or?.[1]?.teamId || '');
    const rows = userFixtures.filter((u) => {
      const inTeamIds = Array.isArray(u.teamIds) && u.teamIds.map(String).includes(wb);
      const inTeamId = String(u.teamId || '') === wb;
      const matchesTeam = inTeamIds || inTeamId;
      return matchesTeam
        && String(u.firmId) === String(query.firmId)
        && u.status !== 'deleted'
        && u.isActive === true;
    }).map((u) => ({ xID: u.xID }));
    return { select: () => ({ lean: async () => rows }) };
  }
};

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
  createNotification: async (payload) => {
    notifications.push(payload);
    if (payload.recipientXID === 'XNULL') return null;
    existingKeys.add(`${payload.firmId}|${payload.recipientXID}|${payload.docketId}|${payload.type}|${payload.metadata?.dueDateKey}`);
    return { _id: `n${notifications.length}` };
  },
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
  const firstRun = await processDocketDueNotifications({ now });

  assert.equal(notifications.some((n) => n.docketId === 'D1' && n.type === 'DOCKET_DUE_SOON' && n.recipientXID === 'X000001'), true);
  assert.equal(notifications.some((n) => n.docketId === 'D2'), false);
  assert.equal(notifications.some((n) => n.docketId === 'D3' && n.type === 'DOCKET_OVERDUE'), true);
  assert.equal(notifications.some((n) => n.docketId === 'D4'), false);
  assert.equal(notifications.some((n) => n.docketId === 'D5'), false);
  assert.equal(notifications.some((n) => n.docketId === 'D6' && n.recipientXID === 'XTEAMIDS'), true);
  assert.equal(notifications.some((n) => n.docketId === 'D6' && n.recipientXID === 'XTEAMID'), true);
  assert.equal(notifications.some((n) => n.recipientXID === 'XDELETED' || n.recipientXID === 'XINACTIVE' || n.recipientXID === 'XOTHERFIRM'), false);
  assert.equal(firstRun.created, notifications.length);

  const firstCount = notifications.length;
  await processDocketDueNotifications({ now });
  assert.equal(notifications.length, firstCount);

  CaseMock.find = async () => ([
    { caseId: 'D1', firmId: 'F1', dueDate: new Date('2026-05-23T09:30:00.000Z'), status: 'IN_PROGRESS', assignedToXID: 'X000001' },
  ]);
  await processDocketDueNotifications({ now });
  assert.equal(notifications.length, firstCount + 1);

  CaseMock.find = async () => ([
    { caseId: 'D7', firmId: 'F1', dueDate: new Date('2026-05-23T09:30:00.000Z'), status: 'IN_PROGRESS', assignedToXID: 'XNULL' },
  ]);
  const nullRun = await processDocketDueNotifications({ now });
  assert.equal(nullRun.created, 0);

  console.log('docketDueNotifications.test.js passed');
})();
