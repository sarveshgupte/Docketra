const assert = require('assert');

const NotificationMock = {
  created: [],
  async create(doc) { this.created.push(doc); return { ...doc, _id: `n${this.created.length}` }; },
  findOne() { return { sort: async () => null }; },
};

const usersById = {
  u1: { _id: 'u1', xID: 'X000001', firmId: 'F1', status: 'active', isActive: true },
  u2: { _id: 'u2', xID: 'X000002', firmId: 'F1', status: 'inactive', isActive: false },
  u3: { _id: 'u3', xID: 'X000003', firmId: 'F1', status: 'deleted', isActive: false },
  u4: { _id: 'u4', xID: 'X000004', firmId: 'F2', status: 'active', isActive: true },
};
const usersByXid = Object.fromEntries(Object.values(usersById).map((u) => [u.xID, u]));

const UserMock = {
  findOne(query) {
    let user = null;
    if (query?._id) user = usersById[query._id] || null;
    if (query?.xID) user = usersByXid[query.xID] || null;

    const matchesFirm = !query?.firmId || String(user?.firmId) === String(query.firmId);
    const notDeleted = !query?.status || query.status?.$ne !== 'deleted' || user?.status !== 'deleted';

    const result = user && matchesFirm && notDeleted ? { xID: user.xID } : null;
    return { select: () => ({ lean: async () => result }) };
  },
};

require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
require.cache[require.resolve('../src/models/User.model')] = { exports: UserMock };
require.cache[require.resolve('../src/services/notificationSocket.service')] = { exports: { emitUserNotification: () => {} } };
require.cache[require.resolve('../src/services/notificationPreference.service')] = { exports: { resolveDeliveryChannels: async () => ({ inApp: true, email: false }) } };
require.cache[require.resolve('../src/queues/email.queue')] = { exports: { enqueueEmailJob: async () => {} } };

const { createNotification, NotificationTypes } = require('../src/services/notification.service');

(async () => {
  // direct xID
  await createNotification({ firmId: 'F1', recipientXID: 'x000001', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'Docket C1 has been assigned to you.', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 1);

  // recipientUserId active user
  await createNotification({ firmId: 'F1', recipientUserId: 'u1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 2);

  // recipientUserId inactive/deactivated user should still receive
  await createNotification({ firmId: 'F1', recipientUserId: 'u2', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C2' });
  assert.equal(NotificationMock.created.length, 3);

  // deleted recipient skipped
  await createNotification({ firmId: 'F1', recipientUserId: 'u3', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C3' });
  assert.equal(NotificationMock.created.length, 3);

  // out-of-firm recipient skipped
  await createNotification({ firmId: 'F1', recipientUserId: 'u4', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C4' });
  assert.equal(NotificationMock.created.length, 3);

  // missing recipient noop
  await createNotification({ firmId: 'F1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 3);

  console.log('notificationServiceMvpEvents.test.js passed');
})();
