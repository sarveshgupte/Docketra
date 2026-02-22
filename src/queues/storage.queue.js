/**
 * Storage Queue
 *
 * BullMQ queue for asynchronous external storage operations (BYOS).
 * Tokens must NEVER be included in job payloads — they are fetched
 * inside the worker at execution time.
 */

'use strict';

const { Queue } = require('bullmq');
const { createHash } = require('crypto');

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
    // Phase 2: max 5 attempts with exponential backoff (5s, 10s, 20s, 40s)
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

/**
 * Build a deterministic idempotency key for a storage job.
 * Prevents duplicate enqueue and enables safe re-runs of the same job.
 *
 * Includes folderId and provider so that a folder structure change or a
 * provider switch produces a distinct key rather than aliasing an existing one.
 *
 * @param {string} type    - Job type constant
 * @param {object} payload - Job payload
 * @returns {string}       - SHA-256 hex digest (first 32 chars)
 */
function buildIdempotencyKey(type, payload) {
  const parts = [
    type,
    String(payload.firmId || ''),
    String(payload.caseId || ''),
    String(payload.fileId || payload.attachmentId || ''),
    String(payload.folderId || ''),
    String(payload.provider || ''),
  ];
  return createHash('sha256').update(parts.join('::')).digest('hex').slice(0, 32);
}

/**
 * Enqueue a storage job.
 *
 * Uses a deterministic jobId (idempotencyKey) so that re-enqueuing an
 * identical job is a no-op when the original is still pending.
 *
 * @param {string} type    - One of the JOB_TYPES constants
 * @param {object} payload - Job payload (must NOT include tokens)
 *   @param {string}  payload.firmId
 *   @param {string}  payload.provider        - e.g. 'google'
 *   @param {string}  [payload.caseId]
 *   @param {string}  [payload.fileId]
 *   @param {string}  [payload.folderId]
 *   @param {object}  [payload.fileMetadata]
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueStorageJob(type, payload) {
  const idempotencyKey = buildIdempotencyKey(type, payload);
  return storageQueue.add(type, { ...payload, idempotencyKey }, { jobId: idempotencyKey });
}

/**
 * Return the current number of jobs waiting + active in the storage queue.
 * This reflects live load and can be used for backpressure / capacity planning.
 *
 * @returns {Promise<number>}
 */
async function getQueueDepth() {
  const [waiting, active] = await Promise.all([
    storageQueue.getWaitingCount(),
    storageQueue.getActiveCount(),
  ]);
  return waiting + active;
}

module.exports = { storageQueue, enqueueStorageJob, JOB_TYPES, buildIdempotencyKey, getQueueDepth };
