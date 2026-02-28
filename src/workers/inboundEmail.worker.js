'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { processInboundEmailPayload } = require('../controllers/inboundEmail.controller');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const inboundEmailWorker = new Worker(
  'inbound-email-jobs',
  async (job) => {
    if (job.name !== 'PROCESS_INBOUND_EMAIL') {
      throw new UnrecoverableError(`Unknown inbound job type: ${job.name}`);
    }

    try {
      await processInboundEmailPayload(job.data);
    } catch (error) {
      if (error?.unrecoverable) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  },
  { connection: { url: redisUrl } }
);

inboundEmailWorker.on('failed', (job, err) => {
  console.error('[InboundEmailWorker] Job failed', {
    jobId: job?.id,
    message: err?.message,
  });
});

inboundEmailWorker.on('error', (err) => {
  console.error('[InboundEmailWorker] Worker error', { message: err?.message });
});

module.exports = inboundEmailWorker;
