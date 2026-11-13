'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const mcaSyncQueue = redisUrl
  ? new Queue('mcaSyncQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  })
  : null;

async function enqueueClientMcaSyncJob(payload) {
  if (!mcaSyncQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await mcaSyncQueue.add('SYNC_CLIENT_MCA', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

async function enqueueNightlyMcaSweepJob(payload = {}) {
  if (!mcaSyncQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await mcaSyncQueue.add('NIGHTLY_MCA_SWEEP', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  mcaSyncQueue,
  enqueueClientMcaSyncJob,
  enqueueNightlyMcaSweepJob,
};
