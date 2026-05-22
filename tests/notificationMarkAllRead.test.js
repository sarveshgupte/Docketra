const assert = require('assert');

const docs = [
  { _id: '1', userId: 'U1', firmId: 'F1', isRead: false },
  { _id: '2', userId: 'U1', firmId: 'F1', isRead: false },
  { _id: '3', userId: 'U1', firmId: 'F1', isRead: true },
  { _id: '4', userId: 'U2', firmId: 'F1', isRead: false },
  { _id: '5', userId: 'U1', firmId: 'F2', isRead: false },
];

const NotificationMock = {
  async updateMany(query, update) {
    let modifiedCount = 0;
    for (const d of docs) {
      if (d.userId === query.userId && d.firmId === query.firmId && d.isRead === query.isRead) {
        d.isRead = update.$set.isRead;
        modifiedCount += 1;
      }
    }
    return { modifiedCount };
  },
};

require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
const { markAllAsRead } = require('../src/services/notification.service');

(async () => {
  const updated = await markAllAsRead('u1', 'F1');
  assert.equal(updated, 2);
  assert.equal(docs.find((d) => d._id === '1').isRead, true);
  assert.equal(docs.find((d) => d._id === '2').isRead, true);
  assert.equal(docs.find((d) => d._id === '4').isRead, false);
  assert.equal(docs.find((d) => d._id === '5').isRead, false);

  const noOp = await markAllAsRead('u1', 'F1');
  assert.equal(noOp, 0);

  console.log('notificationMarkAllRead.test.js passed');
})();
