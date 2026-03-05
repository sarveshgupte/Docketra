'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const auditQueue = redisUrl
  ? new Queue('auditQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  })
  : null;

async function enqueueAuditJob(name, payload) {
  if (!auditQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await auditQueue.add(name, payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  auditQueue,
  enqueueAuditJob,
};
