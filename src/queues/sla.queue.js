'use strict';

const { Queue } = require('bullmq');

const SLA_QUEUE_NAME = 'sla-breach-jobs';
const SLA_BREACH_JOB_NAME = 'sla-breach-check';
const SLA_BREACH_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 3000,
  },
  removeOnComplete: 50,
  removeOnFail: 100,
});

const redisUrl = process.env.REDIS_URL;
const slaQueue = redisUrl
  ? new Queue(SLA_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: SLA_BREACH_JOB_OPTIONS,
  })
  : null;

async function enqueueSlaBreachCheckJob(payload, options = {}) {
  if (!slaQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }

  try {
    const job = await slaQueue.add(
      SLA_BREACH_JOB_NAME,
      payload,
      options,
    );
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  slaQueue,
  enqueueSlaBreachCheckJob,
  SLA_QUEUE_NAME,
  SLA_BREACH_JOB_NAME,
  SLA_BREACH_JOB_OPTIONS,
};
