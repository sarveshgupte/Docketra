const assert = require('assert');

const now = Date.now();
const docs = [
  { _id: 'a', isRead: true, createdAt: new Date(now - 120 * 24 * 60 * 60 * 1000), firmId: 'F1', userId: 'U1' },
  { _id: 'b', isRead: false, createdAt: new Date(now - 120 * 24 * 60 * 60 * 1000), firmId: 'F1', userId: 'U1' },
  { _id: 'c', isRead: true, createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000), firmId: 'F1', userId: 'U1' },
];

const NotificationMock = {
  async deleteMany(query) {
    const before = docs.length;
    for (let i = docs.length - 1; i >= 0; i -= 1) {
      const d = docs[i];
      const matches = d.isRead === true
        && d.createdAt < query.createdAt.$lt
        && (!query.firmId || d.firmId === query.firmId)
        && (!query.userId || d.userId === query.userId);
      if (matches) docs.splice(i, 1);
    }
    return { deletedCount: before - docs.length };
  },
};

require.cache[require.resolve('../src/models/Notification.model')] = { exports: NotificationMock };
const { cleanupReadNotifications, normalizeRetentionDays, MIN_RETENTION_DAYS } = require('../src/services/notificationCleanup.service');

(async () => {
  const result = await cleanupReadNotifications({ retentionDays: 90, firmId: 'F1', userId: 'u1' });
  assert.equal(result.deletedCount, 1);
  assert.equal(docs.some((d) => d._id === 'b'), true);

  assert.equal(normalizeRetentionDays(5), MIN_RETENTION_DAYS);
  console.log('notificationCleanup.test.js passed');
})();
