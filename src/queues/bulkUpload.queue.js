'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL;
const bulkUploadQueue = redisUrl
  ? new Queue('bulk-upload', {
    connection: { url: redisUrl },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  })
  : null;

module.exports = {
  bulkUploadQueue,
};
