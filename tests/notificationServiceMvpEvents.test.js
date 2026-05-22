const assert = require('assert');

const NotificationMock = {
  created: [],
  async create(doc) { this.created.push(doc); return { ...doc, _id: 'n1' }; },
  findOne() { return { sort: async () => null }; },
};
const UserMock = {
  findOne(query) {
    if (query?._id === 'u1' && query?.firmId === 'F1') {
      return { select: () => ({ lean: async () => ({ xID: 'X000001' }) }) };
    }
    if (query?.xID === 'X000001' && query?.firmId === 'F1') {
      return { select: () => ({ lean: async () => ({ xID: 'X000001' }) }) };
    }
    return { select: () => ({ lean: async () => null }) };
  }
};

require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
require.cache[require.resolve('../src/models/User.model')] = { exports: UserMock };
require.cache[require.resolve('../src/services/notificationSocket.service')] = { exports: { emitUserNotification: () => {} } };
require.cache[require.resolve('../src/services/notificationPreference.service')] = { exports: { resolveDeliveryChannels: async () => ({ inApp: true, email: false }) } };
require.cache[require.resolve('../src/queues/email.queue')] = { exports: { enqueueEmailJob: async () => {} } };

const { createNotification, NotificationTypes } = require('../src/services/notification.service');

(async () => {
  await createNotification({ firmId: 'F1', recipientXID: 'x000001', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'Docket C1 has been assigned to you.', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 1);

  await createNotification({ firmId: 'F1', recipientUserId: 'u1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 2);

  await createNotification({ firmId: 'F2', recipientUserId: 'u1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 2);

  await createNotification({ firmId: 'F1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 2);

  console.log('notificationServiceMvpEvents.test.js passed');
})();
