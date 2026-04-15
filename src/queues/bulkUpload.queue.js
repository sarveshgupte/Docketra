'use strict';

const { Queue } = require('bullmq');

const BULK_UPLOAD_QUEUE_NAME = 'bulk-upload';
const BULK_UPLOAD_JOB_NAME = 'bulk-upload-job';
const BULK_UPLOAD_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 50,
  removeOnFail: 100,
});

const redisUrl = process.env.REDIS_URL;
const bulkUploadQueue = redisUrl
  ? new Queue(BULK_UPLOAD_QUEUE_NAME, {
    connection: { url: redisUrl },
    defaultJobOptions: BULK_UPLOAD_JOB_OPTIONS,
  })
  : null;

async function enqueueBulkUploadJob(payload, options = {}) {
  if (!bulkUploadQueue) {
    return { queued: false, error: new Error('REDIS_UNAVAILABLE') };
  }

  try {
    const job = await bulkUploadQueue.add(BULK_UPLOAD_JOB_NAME, payload, options);
    return { queued: true, jobId: job.id };
  } catch (error) {
    return { queued: false, error };
  }
}

module.exports = {
  bulkUploadQueue,
  enqueueBulkUploadJob,
  BULK_UPLOAD_QUEUE_NAME,
  BULK_UPLOAD_JOB_NAME,
  BULK_UPLOAD_JOB_OPTIONS,
};
