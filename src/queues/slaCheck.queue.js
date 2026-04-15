'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const slaCheckQueue = redisUrl
  ? new Queue('slaCheckQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  })
  : null;

async function enqueueSlaCheckJob(payload) {
  if (!slaCheckQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await slaCheckQueue.add('SLA_CHECK', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  slaCheckQueue,
  enqueueSlaCheckJob,
};
