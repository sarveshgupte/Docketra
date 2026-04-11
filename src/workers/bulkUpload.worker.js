'use strict';

require('dotenv').config();

const { Worker } = require('bullmq');
const connectDB = require('../config/database');
const BulkUploadJob = require('../models/BulkUploadJob.model');
const { processBulkRows } = require('../controllers/bulkUpload.controller');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('[bulkUploadWorker] REDIS_URL is not configured; worker is disabled.');
  process.exit(0);
}

const startWorker = async () => {
  await connectDB();

  const worker = new Worker(
    'bulk-upload',
    async (job) => {
      const { type, rows, user, duplicateMode, jobId } = job.data;

      const existingJob = await BulkUploadJob.findById(jobId).lean();
      if (!existingJob) {
        return;
      }

      if (existingJob.status === 'completed') {
        return;
      }

      await processBulkRows({
        type,
        rows,
        user,
        duplicateMode,
        jobId,
      });
    },
    {
      connection: { url: redisUrl },
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log('Bulk job completed:', job.id);
  });

  worker.on('failed', async (job, err) => {
    console.error('Bulk job failed:', job?.id, err.message);

    const jobId = job?.data?.jobId;
    if (!jobId) return;

    await BulkUploadJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      errorMessage: err.message,
    });
  });

  worker.on('error', (err) => {
    console.error('[bulkUploadWorker] Worker error:', err.message);
  });

  console.log('[bulkUploadWorker] Worker started with concurrency=3');
};

startWorker().catch((error) => {
  console.error('[bulkUploadWorker] Failed to start:', error);
  process.exit(1);
});
