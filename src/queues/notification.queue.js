'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const notificationQueue = redisUrl
  ? new Queue('notificationQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 50,
    },
  })
  : null;

async function enqueueNotificationJob(payload) {
  if (!notificationQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await notificationQueue.add('SEND_NOTIFICATION', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  notificationQueue,
  enqueueNotificationJob,
};
