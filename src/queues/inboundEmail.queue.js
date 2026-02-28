'use strict';

const { Queue } = require('bullmq');
const { createHash } = require('crypto');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const inboundEmailQueue = new Queue('inbound-email-jobs', {
  connection: { url: redisUrl },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

function buildIdempotencyKey(payload = {}) {
  const parts = [
    String(payload.messageId || ''),
    String(payload.to || ''),
    String(payload.from || ''),
    String(payload.receivedAt || ''),
  ];
  return createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 32);
}

async function enqueueInboundEmailJob(payload) {
  const jobId = buildIdempotencyKey(payload);
  return inboundEmailQueue.add('PROCESS_INBOUND_EMAIL', payload, { jobId });
}

module.exports = {
  inboundEmailQueue,
  enqueueInboundEmailJob,
};
