/**
 * Storage Dead Letter Queue (DLQ)
 *
 * Receives jobs that have exhausted all retry attempts.
 * Records are retained for manual recovery / operational review.
 *
 * No tokens are ever stored here — only metadata about the failure.
 */

'use strict';

const { Queue } = require('bullmq');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const storageDLQ = new Queue('storage-jobs-dlq', {
  connection: { url: redisUrl },
  defaultJobOptions: {
    // DLQ jobs are kept indefinitely for manual inspection
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Move a permanently-failed storage job to the dead letter queue.
 *
 * @param {object} params
 * @param {string}  params.firmId       - Firm that owns the job
 * @param {string}  [params.caseId]     - Case the job was for (if applicable)
 * @param {string}  params.jobType      - Original job type (e.g. UPLOAD_FILE)
 * @param {string}  params.provider     - Storage provider name
 * @param {string}  [params.errorCode]  - Error code or message
 * @param {number}  params.retryCount   - Number of attempts made
 * @param {string}  [params.idempotencyKey] - Original idempotency key
 * @returns {Promise<import('bullmq').Job>}
 */
async function moveToDLQ({ firmId, caseId, jobType, provider, errorCode, retryCount, idempotencyKey }) {
  return storageDLQ.add('DEAD_LETTER', {
    firmId,
    caseId: caseId || null,
    jobType,
    provider,
    errorCode: errorCode || 'UNKNOWN',
    retryCount,
    idempotencyKey: idempotencyKey || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Return the number of jobs currently waiting in the dead letter queue.
 * Uses the BullMQ waiting count as the authoritative measure — more accurate
 * than a cumulative in-memory counter.
 *
 * @returns {Promise<number>}
 */
async function getDLQSize() {
  return storageDLQ.getWaitingCount();
}

module.exports = { storageDLQ, moveToDLQ, getDLQSize };
