const assert = require('assert');

const NotificationMock = {
  created: [],
  async create(doc) { this.created.push(doc); return { ...doc, _id: 'n1' }; },
  findOne() { return { sort: async () => null }; },
};
const UserMock = { findOne() { return { select: () => ({ lean: async () => ({ xID: 'X000001' }) }) }; } };

require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
require.cache[require.resolve('../src/models/User.model')] = { exports: UserMock };
require.cache[require.resolve('../src/services/notificationSocket.service')] = { exports: { emitUserNotification: () => {} } };
require.cache[require.resolve('../src/services/notificationPreference.service')] = { exports: { resolveDeliveryChannels: async () => ({ inApp: true, email: false }) } };
require.cache[require.resolve('../src/queues/email.queue')] = { exports: { enqueueEmailJob: async () => {} } };

const { createNotification, NotificationTypes } = require('../src/services/notification.service');

(async () => {
  await createNotification({ firmId: 'F1', recipientXID: 'x000001', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'Docket C1 has been assigned to you.', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 1);

  UserMock.findOne = () => ({ select: () => ({ lean: async () => null }) });
  await createNotification({ firmId: 'F1', recipientXID: 'x999999', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 1);

  await createNotification({ firmId: 'F1', type: NotificationTypes.DOCKET_ASSIGNED, title: 'Assigned', message: 'x', docketId: 'C1' });
  assert.equal(NotificationMock.created.length, 1);

  console.log('notificationServiceMvpEvents.test.js passed');
})();
