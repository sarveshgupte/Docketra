'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const emailQueue = redisUrl
  ? new Queue('emailQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  })
  : null;

async function enqueueEmailJob(name, payload) {
  if (!emailQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await emailQueue.add(name, payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  emailQueue,
  enqueueEmailJob,
};
