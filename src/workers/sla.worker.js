'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const { processSlaBreachCheckJob } = require('../jobs/slaBreachCheck.job');
const { SLA_QUEUE_NAME, SLA_BREACH_JOB_NAME } = require('../queues/sla.queue');

const redisUrl = process.env.REDIS_URL;
let slaWorker = null;
if (!redisUrl) {
  setWorkerStatus('sla', 'disabled');
} else {
  setWorkerStatus('sla', 'starting');
  slaWorker = new Worker(
    SLA_QUEUE_NAME,
    async (job) => {
      if (job.name !== SLA_BREACH_JOB_NAME) {
        throw new UnrecoverableError(`Unknown SLA job type: ${job.name}`);
      }
      await processSlaBreachCheckJob(job.data);
    },
    { connection: { url: redisUrl } }
  );

  slaWorker.on('ready', () => setWorkerStatus('sla', 'running'));
  slaWorker.on('error', () => setWorkerStatus('sla', 'error'));
}

module.exports = slaWorker;
