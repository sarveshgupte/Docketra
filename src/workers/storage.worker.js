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
const FirmStorage = require('../models/FirmStorage.model');
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
        await provider.createCaseFolder(firmId, caseId);
        console.info(`[StorageWorker] Case folder created`, { firmId, caseId });
        break;
      }

      case 'UPLOAD_FILE': {
        const { folderId, fileMetadata } = job.data;
        // Note: file buffer is not transmitted via Redis — provider.uploadFile
        // must fetch the file content internally using fileMetadata identifiers.
        await provider.uploadFile(firmId, folderId, null, fileMetadata);
        console.info(`[StorageWorker] File uploaded`, { firmId, folderId });
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
