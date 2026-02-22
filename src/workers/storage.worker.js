/**
 * Storage Worker
 *
 * BullMQ worker that processes asynchronous external storage jobs.
 * Tokens are fetched and decrypted here — never included in job payloads.
 *
 * Logging: only non-sensitive metadata (firmId, job type) is ever logged.
 */

'use strict';

const { Worker } = require('bullmq');
const fs = require('fs').promises;
const FirmStorage = require('../models/FirmStorage.model');
const CaseFile = require('../models/CaseFile.model');
const Attachment = require('../models/Attachment.model');
const CaseAudit = require('../models/CaseAudit.model');
const CaseHistory = require('../models/CaseHistory.model');
const { decrypt } = require('../storage/services/TokenEncryption.service');
const { getStorageProvider } = require('../storage/StorageFactory');
const { google } = require('googleapis');

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

const storageWorker = new Worker(
  'storage-jobs',
  async (job) => {
    const { firmId, provider: providerName } = job.data;

    console.info(`[StorageWorker] Processing job`, { type: job.name, firmId });

    // Fetch the FirmStorage record for this firm
    const record = await FirmStorage.findOne({ firmId });
    if (!record) {
      throw new Error(`[StorageWorker] No FirmStorage record found for firmId: ${firmId}`);
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
      throw new Error(`[StorageWorker] Unsupported provider: ${providerName}`);
    }

    // Dispatch to the appropriate provider method
    switch (job.name) {
      case 'CREATE_ROOT_FOLDER': {
        const { folderId } = await provider.createRootFolder(firmId);
        await FirmStorage.findOneAndUpdate(
          { firmId },
          { rootFolderId: folderId, status: 'active' }
        );
        console.info(`[StorageWorker] Root folder created`, { firmId });
        break;
      }

      case 'CREATE_CASE_FOLDER': {
        const { caseId } = job.data;
        if (!record.rootFolderId) {
          throw new Error('Firm rootFolderId missing for case folder creation');
        }
        await provider.createCaseFolder(firmId, caseId, record.rootFolderId);
        console.info(`[StorageWorker] Case folder created`, { firmId, caseId });
        break;
      }

      case 'UPLOAD_FILE': {
        const { fileId, caseId, folderId: jobFolderId } = job.data;

        // Fetch the CaseFile staging record
        const caseFile = await CaseFile.findById(fileId);
        if (!caseFile) {
          throw new Error(`[StorageWorker] CaseFile not found: ${fileId}`);
        }

        // Idempotency: skip if already uploaded or storageFileId already set (partial state protection)
        if (caseFile.uploadStatus === 'uploaded' || caseFile.storageFileId) {
          console.info('[StorageWorker] Skipping already processed file', { fileId });
          return;
        }

        // folderId must always be resolved and passed by the controller
        if (!jobFolderId) {
          throw new Error('[StorageWorker] folderId is required for case uploads');
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
              console.info('[StorageWorker] Attachment already exists, skipping creation', { firmId });
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
            console.error(`[StorageWorker] Failed to create Attachment record`, {
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
            console.error(`[StorageWorker] Failed to create audit records`, {
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
          console.warn(`[StorageWorker] Could not delete local file`, {
            path: caseFile.localPath,
            message: unlinkErr.message,
          });
        }

        console.info(`[StorageWorker] File uploaded`, { firmId, folderId: targetFolderId });
        break;
      }

      case 'DELETE_FILE': {
        const { folderId } = job.data;
        await provider.deleteFile(firmId, folderId);
        console.info(`[StorageWorker] File deleted`, { firmId });
        break;
      }

      default:
        throw new Error(`[StorageWorker] Unknown job type: ${job.name}`);
    }
  },
  { connection: { url: redisUrl } }
);

// On permanent failure (after all retries), mark storage as errored
storageWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    const { firmId } = job.data || {};
    console.error(`[StorageWorker] Job permanently failed`, { type: job.name, firmId, message: err.message });
    if (firmId) {
      try {
        await FirmStorage.findOneAndUpdate({ firmId }, { status: 'error' });
      } catch (updateErr) {
        console.error(`[StorageWorker] Failed to update storage status to error`, { firmId });
      }
    }
  }
});

storageWorker.on('error', (err) => {
  // Prevent unhandled error from crashing the process
  console.error(`[StorageWorker] Worker error:`, { message: err.message });
});

module.exports = storageWorker;
