'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const reportGenerationQueue = redisUrl
  ? new Queue('reportGenerationQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  })
  : null;

async function enqueueReportJob(payload) {
  if (!reportGenerationQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await reportGenerationQueue.add('GENERATE_REPORT', payload);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  reportGenerationQueue,
  enqueueReportJob,
};
