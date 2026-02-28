'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const storageIntegrityQueue = new Queue('storage-integrity-jobs', {
  connection: { url: redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  },
});

async function enqueueDailyStorageIntegrityJob() {
  return storageIntegrityQueue.add('VERIFY_ALL_TENANTS', { scheduledAt: new Date().toISOString() });
}

module.exports = {
  storageIntegrityQueue,
  enqueueDailyStorageIntegrityJob,
};
