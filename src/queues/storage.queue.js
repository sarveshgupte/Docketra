/**
 * Storage Queue
 *
 * BullMQ queue for asynchronous external storage operations (BYOS).
 * Tokens must NEVER be included in job payloads — they are fetched
 * inside the worker at execution time.
 */

'use strict';

const { Queue } = require('bullmq');

// Job type constants
const JOB_TYPES = {
  CREATE_ROOT_FOLDER: 'CREATE_ROOT_FOLDER',
  CREATE_CASE_FOLDER: 'CREATE_CASE_FOLDER',
  UPLOAD_FILE: 'UPLOAD_FILE',
  DELETE_FILE: 'DELETE_FILE',
};

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const storageQueue = new Queue('storage-jobs', {
  connection: { url: redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

/**
 * Enqueue a storage job.
 *
 * @param {string} type    - One of the JOB_TYPES constants
 * @param {object} payload - Job payload (must NOT include tokens)
 *   @param {string}  payload.firmId
 *   @param {string}  payload.provider        - e.g. 'google'
 *   @param {string}  [payload.caseId]
 *   @param {string}  [payload.folderId]
 *   @param {object}  [payload.fileMetadata]
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueStorageJob(type, payload) {
  return storageQueue.add(type, payload);
}

module.exports = { storageQueue, enqueueStorageJob, JOB_TYPES };
