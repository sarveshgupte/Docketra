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

const redisUrl = String(process.env.REDIS_URL || '').trim();
const isProduction = process.env.NODE_ENV === 'production';

if (!redisUrl && isProduction) {
  throw new Error('REDIS_URL is required in production for storage dead letter queue');
}

const storageDLQ = redisUrl
  ? new Queue('storage-jobs-dlq', {
      connection: { url: redisUrl },
      defaultJobOptions: {
        // DLQ jobs are kept indefinitely for manual inspection
        removeOnComplete: false,
        removeOnFail: false,
      },
    })
  : null;

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
  if (!storageDLQ) {
    return null;
  }
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
  if (!storageDLQ) {
    return 0;
  }
  return storageDLQ.getWaitingCount();
}

module.exports = { storageDLQ, moveToDLQ, getDLQSize };
