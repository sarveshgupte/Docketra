'use strict';

const BulkUploadJob = require('../models/BulkUploadJob.model');
const { processBulkRows } = require('../controllers/bulkUpload.controller');

async function processBulkUploadJob(payload = {}) {
  const {
    type,
    rows,
    user,
    duplicateMode,
    jobId,
  } = payload;

  const existingJob = await BulkUploadJob.findById(jobId).lean();
  if (!existingJob || existingJob.status === 'completed') {
    return null;
  }

  await processBulkRows({
    type,
    rows,
    user,
    duplicateMode,
    jobId,
  });

  return { jobId };
}

module.exports = {
  processBulkUploadJob,
};
