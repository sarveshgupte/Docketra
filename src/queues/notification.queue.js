'use strict';

const { Queue } = require('bullmq');

const NOTIFICATION_QUEUE_NAME = 'notification-jobs';
const NOTIFICATION_JOB_NAME = 'notification-job';
const NOTIFICATION_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 50,
  removeOnFail: 100,
});

const redisUrl = process.env.REDIS_URL;
const notificationQueue = redisUrl
  ? new Queue(NOTIFICATION_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
  })
  : null;

async function enqueueNotificationJob(payload, options = {}) {
  if (!notificationQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }

  try {
    const job = await notificationQueue.add(
      NOTIFICATION_JOB_NAME,
      payload,
      options,
    );
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  notificationQueue,
  enqueueNotificationJob,
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_JOB_NAME,
  NOTIFICATION_JOB_OPTIONS,
};
