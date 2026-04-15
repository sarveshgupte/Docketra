'use strict';

require('dotenv').config();

const { Worker, UnrecoverableError } = require('bullmq');
const connectDB = require('../config/database');
const BulkUploadJob = require('../models/BulkUploadJob.model');
const { processBulkUploadJob } = require('../jobs/bulkUpload.job');
const { BULK_UPLOAD_QUEUE_NAME, BULK_UPLOAD_JOB_NAME } = require('../queues/bulkUpload.queue');
const { setWorkerStatus } = require('../services/workerRegistry.service');

const redisUrl = process.env.REDIS_URL;
let bulkUploadWorker = null;

const startWorker = async () => {
  if (!redisUrl) {
    setWorkerStatus('bulkUpload', 'disabled');
    return null;
  }

  setWorkerStatus('bulkUpload', 'starting');
  await connectDB();

  bulkUploadWorker = new Worker(
    BULK_UPLOAD_QUEUE_NAME,
    async (job) => {
      if (job.name !== BULK_UPLOAD_JOB_NAME) {
        throw new UnrecoverableError(`Unknown bulk upload job type: ${job.name}`);
      }
      await processBulkUploadJob(job.data);
    },
    {
      connection: { url: redisUrl },
      concurrency: 3,
    }
  );

  bulkUploadWorker.on('ready', () => {
    setWorkerStatus('bulkUpload', 'running');
  });

  bulkUploadWorker.on('completed', (job) => {
    console.log('Bulk job completed:', job.id);
  });

  bulkUploadWorker.on('failed', async (job, err) => {
    console.error('Bulk job failed:', job?.id, err.message);

    const jobId = job?.data?.jobId;
    if (!jobId) return;

    await BulkUploadJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      errorMessage: err.message,
    });
  });

  bulkUploadWorker.on('error', (err) => {
    setWorkerStatus('bulkUpload', 'error');
    console.error('[bulkUploadWorker] Worker error:', err.message);
  });

  console.log('[bulkUploadWorker] Worker started with concurrency=3');
  return bulkUploadWorker;
};

startWorker().catch((error) => {
  setWorkerStatus('bulkUpload', 'error');
  console.error('[bulkUploadWorker] Failed to start:', error);
});

module.exports = bulkUploadWorker;
