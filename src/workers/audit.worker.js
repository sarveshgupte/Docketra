'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const AuthAudit = require('../models/AuthAudit.model');
const { setWorkerStatus } = require('../services/workerRegistry.service');

const redisUrl = process.env.REDIS_URL;
let auditWorker = null;
if (!redisUrl) {
  setWorkerStatus('audit', 'disabled');
} else {
  setWorkerStatus('audit', 'starting');
  auditWorker = new Worker(
    'auditQueue',
    async (job) => {
      if (job.name !== 'createAuthAudit') {
        throw new UnrecoverableError(`Unknown audit job type: ${job.name}`);
      }
      if (!job.data?.entry) {
        throw new UnrecoverableError('Audit job payload missing entry');
      }
      await AuthAudit.create(job.data.entry);
    },
    { connection: { url: redisUrl } }
  );

  auditWorker.on('ready', () => setWorkerStatus('audit', 'running'));
  auditWorker.on('error', () => setWorkerStatus('audit', 'error'));
}

module.exports = auditWorker;
