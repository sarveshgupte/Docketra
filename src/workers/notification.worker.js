'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const { processNotificationJob } = require('../jobs/notification.job');
const { NOTIFICATION_QUEUE_NAME, NOTIFICATION_JOB_NAME } = require('../queues/notification.queue');

const redisUrl = process.env.REDIS_URL;
let notificationWorker = null;
if (!redisUrl) {
  setWorkerStatus('notification', 'disabled');
} else {
  setWorkerStatus('notification', 'starting');
  notificationWorker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      if (job.name !== NOTIFICATION_JOB_NAME) {
        throw new UnrecoverableError(`Unknown notification job type: ${job.name}`);
      }
      await processNotificationJob(job.data);
    },
    { connection: { url: redisUrl } }
  );

  notificationWorker.on('ready', () => setWorkerStatus('notification', 'running'));
  notificationWorker.on('error', () => setWorkerStatus('notification', 'error'));
}

module.exports = notificationWorker;
