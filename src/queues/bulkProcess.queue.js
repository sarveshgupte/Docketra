'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const bulkProcessQueue = redisUrl
  ? new Queue('bulkProcessQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  })
  : null;

async function enqueueBulkProcessJob(payload) {
  if (!bulkProcessQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await bulkProcessQueue.add('BULK_PROCESS', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  bulkProcessQueue,
  enqueueBulkProcessJob,
};
