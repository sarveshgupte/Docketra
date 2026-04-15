'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const logger = require('../utils/log');

const redisUrl = process.env.REDIS_URL;
let notificationWorker = null;

if (!redisUrl) {
  setWorkerStatus('notification', 'disabled');
} else {
  setWorkerStatus('notification', 'starting');
  notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      if (job.name !== 'SEND_NOTIFICATION') {
        throw new UnrecoverableError(`Unknown notification job type: ${job.name}`);
      }
      const payload = job.data || {};
      if (!payload.firmId || !payload.userId || !payload.type || !payload.title || !payload.message) {
        throw new UnrecoverableError('SEND_NOTIFICATION job missing required fields: firmId, userId, type, title, message');
      }

      const { createNotification } = require('../services/notification.service');
      await createNotification(payload);

      logger.info('NOTIFICATION_JOB_COMPLETED', {
        firmId: payload.firmId,
        userId: payload.userId,
        type: payload.type,
      });
    },
    { connection: { url: redisUrl } }
  );

  notificationWorker.on('ready', () => setWorkerStatus('notification', 'running'));
  notificationWorker.on('error', (err) => {
    logger.error('NOTIFICATION_WORKER_ERROR', { error: err.message });
    setWorkerStatus('notification', 'error');
  });
}

module.exports = notificationWorker;
