'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const documentAnalysisQueue = redisUrl
  ? new Queue('documentAnalysisQueue', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  })
  : null;

async function analyzeDocument(attachmentId, firmId) {
  if (!documentAnalysisQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }
  try {
    const job = await documentAnalysisQueue.add('ANALYZE_DOCUMENT', { attachmentId, firmId });
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  documentAnalysisQueue,
  analyzeDocument,
};
