/**
 * Storage Worker
 *
 * BullMQ worker that processes asynchronous external storage jobs.
 * Tokens are fetched and decrypted here — never included in job payloads.
 *
 * Logging: only non-sensitive metadata (firmId, job type) is ever logged.
 */

'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const fs = require('fs').promises;
const FirmStorage = require('../models/FirmStorage.model');
const CaseFile = require('../models/CaseFile.model');
const Attachment = require('../models/Attachment.model');
const CaseAudit = require('../models/CaseAudit.model');
const CaseHistory = require('../models/CaseHistory.model');
const Firm = require('../models/Firm.model');
const Case = require('../models/Case.model');
const { decrypt } = require('../storage/services/TokenEncryption.service');
const { getStorageProvider } = require('../storage/StorageFactory');
const { google } = require('googleapis');
const { allow, recordFailure: circuitFailure, recordSuccess: circuitSuccess } = require('../services/circuitBreaker.service');
const {
  recordStorageJobStarted,
  recordStorageJobSuccess,
  recordStorageJobFailure,
  recordStorageJobRetry,
  setDLQSizeProvider,
  setQueueDepthProvider,
} = require('../services/metrics.service');
const { moveToDLQ, getDLQSize } = require('../queues/storage.dlq');
const { getQueueDepth } = require('../queues/storage.queue');

// Wire up dynamic metric providers so getSnapshot() reflects live queue state
setDLQSizeProvider(getDLQSize);
setQueueDepthProvider(getQueueDepth);

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Build an authenticated Google OAuth2 client from decrypted token strings.
 */
function buildGoogleOAuthClient(accessToken, refreshToken, tokenExpiry) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
  const oauthClient = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
  );
  oauthClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    ...(tokenExpiry && { expiry_date: new Date(tokenExpiry).getTime() }),
  });
  return oauthClient;
}

/**
 * Determine if an error is retryable.
 *
 * Only two categories are retryable:
 *   1. Provider 5xx responses — transient server-side failures
 *   2. Network-level errors   — connectivity or DNS issues
 *
 * Everything else (4xx, validation, missing DB records, unsupported provider,
 * bad payloads) is non-retryable and will be wrapped in UnrecoverableError.
 */
const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']);

function isRetryable(err) {
  if (!err) return false;
  // Provider 5xx responses are transient — worth retrying
  if (err.status >= 500) return true;
  // Network-level errors are transient — worth retrying
  if (err.code && RETRYABLE_NETWORK_CODES.has(err.code)) return true;
  // Everything else is non-retryable
  return false;
}

/**
 * Phase 4 — Tenant Safety: Re-fetch authoritative DB state before uploading.
 * Throws UnrecoverableError if any tenant invariant is violated.
 */
async function assertTenantSafety(firmId, caseId, caseFile) {
  // Verify firm exists
  const firm = await Firm.findOne({ firmId });
  if (!firm) {
    throw new UnrecoverableError(`[StorageWorker] Tenant safety: firm not found: ${firmId}`);
  }

  // Verify case belongs to firm (only when a caseId is present)
  if (caseId) {
    const caseDoc = await Case.findOne({ firmId, $or: [{ caseId }, { caseNumber: caseId }] }).lean();
    if (!caseDoc) {
      throw new UnrecoverableError(
        `[StorageWorker] Tenant safety: case ${caseId} does not belong to firm ${firmId}`
      );
    }
  }

  // Verify CaseFile belongs to the same firm as the job
  if (String(caseFile.firmId) !== String(firmId)) {
    throw new UnrecoverableError(
      `[StorageWorker] Tenant safety: CaseFile firmId mismatch (job: ${firmId}, record: ${caseFile.firmId})`
    );
  }

  // Verify CaseFile is not soft-deleted
  if (caseFile.deletedAt || caseFile.isDeleted) {
    throw new UnrecoverableError(
      `[StorageWorker] Tenant safety: CaseFile is soft-deleted, skipping upload`
    );
  }
}

const storageWorker = new Worker(
  'storage-jobs',
  async (job) => {
    const { firmId, provider: providerName, idempotencyKey } = job.data;

    // Phase 6 — Observability: track job started
    recordStorageJobStarted();

    console.info('[StorageWorker]', { event: 'job_started', jobType: job.name, firmId, attempt: job.attemptsMade + 1 });

    // Track retries beyond the first attempt
    if (job.attemptsMade > 0) {
      recordStorageJobRetry();
    }

    // Phase 5 — Circuit Breaker: check before attempting any provider operation
    const circuitKey = `storage:${providerName || 'unknown'}`;
    if (!allow(circuitKey)) {
      // Circuit is OPEN — fail fast (don't call the provider) and let BullMQ retry
      // with exponential backoff. We intentionally throw a regular Error (not
      // UnrecoverableError) so that BullMQ will retry the job after its backoff
      // delay, by which time the circuit cooldown may have expired and the
      // HALF_OPEN check will let the probe attempt through.
      throw new Error(`[StorageWorker] Circuit breaker OPEN for provider: ${providerName}. Failing fast.`);
    }

    // Fetch the FirmStorage record for this firm
    const record = await FirmStorage.findOne({ firmId });
    if (!record) {
      // No storage config — not a transient error, no point retrying
      throw new UnrecoverableError(`[StorageWorker] No FirmStorage record found for firmId: ${firmId}`);
    }

    // Decrypt tokens — raw tokens must never leave this scope
    const accessToken = decrypt(record.encryptedAccessToken);
    const refreshToken = decrypt(record.encryptedRefreshToken);

    // Instantiate provider with authenticated client
    let provider;
    if (providerName === 'google') {
      const oauthClient = buildGoogleOAuthClient(accessToken, refreshToken, record.tokenExpiry);
      provider = getStorageProvider('google', oauthClient);
    } else {
      throw new UnrecoverableError(`[StorageWorker] Unsupported provider: ${providerName}`);
    }

    try {
      // Dispatch to the appropriate provider method
      switch (job.name) {
        case 'CREATE_ROOT_FOLDER': {
          const { folderId } = await provider.createRootFolder(firmId);
          await FirmStorage.findOneAndUpdate(
            { firmId },
            { rootFolderId: folderId, status: 'active' }
          );
          console.info('[StorageWorker]', { event: 'root_folder_created', jobType: job.name, firmId });
          break;
        }

        case 'CREATE_CASE_FOLDER': {
          const { caseId } = job.data;
          if (!record.rootFolderId) {
            throw new Error('Firm rootFolderId missing for case folder creation');
          }
          await provider.createCaseFolder(firmId, caseId, record.rootFolderId);
          console.info('[StorageWorker]', { event: 'case_folder_created', jobType: job.name, firmId, caseId });
          break;
        }

        case 'UPLOAD_FILE': {
          const { fileId, caseId, folderId: jobFolderId } = job.data;

          // Fetch the CaseFile staging record
          const caseFile = await CaseFile.findById(fileId);
          if (!caseFile) {
            throw new UnrecoverableError(`[StorageWorker] CaseFile not found: ${fileId}`);
          }

          // Phase 7 — Crash Safety: reconcile partial state.
          // storageFileId is set by this worker ONLY after provider.uploadFile() succeeds
          // and returns a confirmed Drive file ID. If the field is present but uploadStatus
          // is not yet 'uploaded', it means the worker crashed after the Drive upload
          // succeeded but before the status update was committed. Reconcile by updating
          // the status — no re-upload is needed because the file is already in Drive.
          if (caseFile.storageFileId && caseFile.uploadStatus !== 'uploaded') {
            console.info('[StorageWorker]', { event: 'partial_state_reconcile', jobType: job.name, firmId, fileId });
            await CaseFile.findByIdAndUpdate(fileId, { uploadStatus: 'uploaded' });
            console.info('[StorageWorker]', { event: 'reconcile_complete', jobType: job.name, firmId, fileId });
            break;
          }

          // Phase 1 — Idempotency: skip if already uploaded
          if (caseFile.uploadStatus === 'uploaded') {
            console.info('[StorageWorker]', { event: 'idempotent_skip', jobType: job.name, firmId, fileId });
            break;
          }

          // Phase 4 — Tenant Safety: re-fetch authoritative DB state
          await assertTenantSafety(firmId, caseId, caseFile);

          // folderId must always be resolved and passed by the controller
          if (!jobFolderId) {
            throw new UnrecoverableError('[StorageWorker] folderId is required for case uploads');
          }
          const targetFolderId = jobFolderId;

          // Read file buffer from local disk — buffer never passed via Redis
          let fileBuffer;
          try {
            fileBuffer = await fs.readFile(caseFile.localPath);
          } catch (readErr) {
            await CaseFile.findByIdAndUpdate(fileId, {
              uploadStatus: 'error',
              errorMessage: `Failed to read local file: ${readErr.message}`,
            });
            throw readErr;
          }

          // Upload to Google Drive
          let driveFileId;
          try {
            const { fileId: uploadedFileId } = await provider.uploadFile(
              firmId,
              targetFolderId,
              fileBuffer,
              { name: caseFile.originalName, mimeType: caseFile.mimeType }
            );
            driveFileId = uploadedFileId;
          } catch (uploadErr) {
            await CaseFile.findByIdAndUpdate(fileId, {
              uploadStatus: 'error',
              errorMessage: uploadErr.message,
            });
            throw uploadErr;
          }

          // Mark CaseFile as uploaded
          await CaseFile.findByIdAndUpdate(fileId, {
            storageFileId: driveFileId,
            uploadStatus: 'uploaded',
          });

          // Create the immutable Attachment record now that we have a Drive file ID
          if (caseFile.caseId || caseFile.clientId) {
            try {
              const existing = await Attachment.findOne({
                firmId: caseFile.firmId,
                checksum: caseFile.checksum,
                caseId: caseFile.caseId || undefined,
                clientId: caseFile.clientId || undefined,
              });
              if (existing) {
                console.info('[StorageWorker]', { event: 'attachment_exists_skip', jobType: job.name, firmId });
              } else {
                await Attachment.create({
                  firmId: caseFile.firmId,
                  caseId: caseFile.caseId || undefined,
                  clientId: caseFile.clientId || undefined,
                  fileName: caseFile.originalName,
                  driveFileId,
                  size: caseFile.size,
                  mimeType: caseFile.mimeType,
                  description: caseFile.description,
                  checksum: caseFile.checksum,
                  createdBy: caseFile.createdBy,
                  createdByXID: caseFile.createdByXID,
                  createdByName: caseFile.createdByName,
                  note: caseFile.note,
                  source: caseFile.source || 'upload',
                });
              }
            } catch (attachErr) {
              // Attachment creation failure is non-fatal for the upload itself
              console.error('[StorageWorker]', {
                event: 'attachment_create_failed',
                jobType: job.name,
                firmId,
                message: attachErr.message,
              });
            }
          }

          // Create audit records for case-level uploads
          if (caseFile.caseId && caseFile.createdByXID) {
            try {
              await CaseAudit.create({
                caseId: caseFile.caseId,
                actionType: 'CASE_FILE_ATTACHED',
                description: `File attached by ${caseFile.createdByXID}: ${caseFile.originalName}`,
                performedByXID: caseFile.createdByXID,
                metadata: {
                  fileName: caseFile.originalName,
                  fileSize: caseFile.size,
                  mimeType: caseFile.mimeType,
                  description: caseFile.description,
                },
              });
              await CaseHistory.create({
                caseId: caseFile.caseId,
                actionType: 'CASE_ATTACHMENT_ADDED',
                description: `Attachment uploaded by ${caseFile.createdBy}: ${caseFile.originalName}`,
                performedBy: caseFile.createdBy,
                performedByXID: caseFile.createdByXID?.toUpperCase(),
              });
            } catch (auditErr) {
              // Audit failure is non-fatal
              console.error('[StorageWorker]', {
                event: 'audit_create_failed',
                jobType: job.name,
                firmId,
                message: auditErr.message,
              });
            }
          }

          // Remove the local temp file
          try {
            await fs.unlink(caseFile.localPath);
          } catch (unlinkErr) {
            // Non-fatal: log and continue
            console.warn('[StorageWorker]', {
              event: 'local_file_delete_failed',
              jobType: job.name,
              path: caseFile.localPath,
              message: unlinkErr.message,
            });
          }

          console.info('[StorageWorker]', { event: 'file_uploaded', jobType: job.name, firmId, folderId: targetFolderId });
          break;
        }

        case 'DELETE_FILE': {
          const { folderId } = job.data;
          await provider.deleteFile(firmId, folderId);
          console.info('[StorageWorker]', { event: 'file_deleted', jobType: job.name, firmId });
          break;
        }

        default:
          throw new UnrecoverableError(`[StorageWorker] Unknown job type: ${job.name}`);
      }

      // Circuit Breaker: record success
      circuitSuccess(circuitKey);
      // Observability: track success
      recordStorageJobSuccess();

    } catch (err) {
      // Circuit Breaker: record failure only for retryable (provider/network) errors.
      // `isRetryable` already identifies these — reuse the same classification.
      if (isRetryable(err)) {
        circuitFailure(circuitKey);
      }
      // Reclassify non-retryable errors so BullMQ stops retrying immediately
      if (!isRetryable(err) && !(err instanceof UnrecoverableError)) {
        throw new UnrecoverableError(err.message);
      }
      throw err;
    }
  },
  { connection: { url: redisUrl } }
);

// On permanent failure (after all retries OR UnrecoverableError), mark storage as errored and route to DLQ.
// Phase 5: recordStorageJobFailure is called ONLY here (permanent failure), never on transient retries.
storageWorker.on('failed', async (job, err) => {
  const isUnrecoverable = err instanceof UnrecoverableError;
  const isExhausted = job && job.attemptsMade >= (job.opts.attempts || 5);

  if (!isUnrecoverable && !isExhausted) {
    // Transient failure that will be retried — do not count as permanent failure
    return;
  }

  // Permanent failure — record and route to DLQ
  recordStorageJobFailure();

  const { firmId, caseId, provider: providerName, idempotencyKey } = job.data || {};
  console.error('[StorageWorker]', {
    event: 'job_permanently_failed',
    jobType: job.name,
    firmId,
    attempt: job.attemptsMade,
    message: err.message,
  });

  if (firmId) {
    try {
      await FirmStorage.findOneAndUpdate({ firmId }, { status: 'error' });
    } catch (updateErr) {
      console.error('[StorageWorker]', { event: 'status_update_failed', firmId });
    }
  }

  // Dead Letter Queue: move to DLQ for manual recovery
  try {
    await moveToDLQ({
      firmId,
      caseId,
      jobType: job.name,
      provider: providerName,
      errorCode: err.message,
      retryCount: job.attemptsMade,
      idempotencyKey,
    });
    console.info('[StorageWorker]', { event: 'job_moved_to_dlq', jobType: job.name, firmId });
  } catch (dlqErr) {
    console.error('[StorageWorker]', { event: 'dlq_move_failed', firmId, message: dlqErr.message });
  }
});

storageWorker.on('error', (err) => {
  // Prevent unhandled error from crashing the process
  console.error('[StorageWorker]', { event: 'worker_error', message: err.message });
});

module.exports = storageWorker;
// Export for testing only — allows unit tests to verify retry classification
// without duplicating the logic.
module.exports.isRetryable = isRetryable;
