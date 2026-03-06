'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { sendEmailNow } = require('../services/email.service');
const { setWorkerStatus } = require('../services/workerRegistry.service');

const redisUrl = process.env.REDIS_URL;
let emailWorker = null;
if (!redisUrl) {
  setWorkerStatus('email', 'disabled');
} else {
  setWorkerStatus('email', 'starting');
  emailWorker = new Worker(
    'emailQueue',
    async (job) => {
      if (job.name !== 'sendEmail') {
        throw new UnrecoverableError(`Unknown email job type: ${job.name}`);
      }
      await sendEmailNow(job.data?.mailOptions || {});
    },
    { connection: { url: redisUrl } }
  );

  emailWorker.on('ready', () => setWorkerStatus('email', 'running'));
  emailWorker.on('error', () => setWorkerStatus('email', 'error'));
}

module.exports = emailWorker;
