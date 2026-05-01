'use strict';

const { Queue } = require('bullmq');

const redisUrl = String(process.env.REDIS_URL || '').trim();
const isProduction = process.env.NODE_ENV === 'production';

if (!redisUrl && isProduction) {
  throw new Error('REDIS_URL is required in production for storage integrity queue');
}

const storageIntegrityQueue = redisUrl
  ? new Queue('storage-integrity-jobs', {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
    })
  : null;

async function enqueueDailyStorageIntegrityJob() {
  if (!storageIntegrityQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  return storageIntegrityQueue.add(
    'VERIFY_ALL_TENANTS',
    { scheduledAt: new Date().toISOString() },
    {
      jobId: 'storage-integrity-daily',
      repeat: { pattern: '0 2 * * *' },
    }
  );
}

module.exports = {
  storageIntegrityQueue,
  enqueueDailyStorageIntegrityJob,
};
