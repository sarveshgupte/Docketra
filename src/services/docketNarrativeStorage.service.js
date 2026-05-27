const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const DocketraManagedStorageProvider = require('./storage/providers/DocketraManagedStorageProvider');
const { requireWritableBusinessStorage } = require('./strictStoragePolicy.service');
const log = require('../utils/log');

const DOCKET_OBJECT_NAME = 'docket.json';

function sha256(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex'); }
async function streamToString(stream) { const chunks = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8'); }

/**
 * Try to build the managed S3 fallback client (returns null if S3 env vars are not set).
 */
function buildManagedS3FallbackClient() {
  const bucket = process.env.MANAGED_STORAGE_S3_BUCKET;
  const region = process.env.MANAGED_STORAGE_S3_REGION;
  if (!bucket || !region) return null;
  const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
    ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
  } : undefined;
  return {
    type: 'managed_fallback_s3',
    bucket,
    region,
    prefix: (process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').replace(/^\/+|\/+$/g, ''),
    client: new S3Client({ region, credentials }),
  };
}

/**
 * Try to build the managed Google Drive (service-account) fallback provider.
 * Returns null if the required env vars are not set.
 */
function buildManagedDriveFallbackProvider(firmId) {
  try {
    const provider = new DocketraManagedStorageProvider({ firmId });
    return { type: 'managed_fallback_drive', provider };
  } catch (_err) {
    return null;
  }
}

async function resolveStorageBackend(firmId) {
  try { return { type: 'firm_connected', provider: await StorageProviderFactory.getProvider(firmId) }; } catch (_error) {
    // Try S3 managed fallback first
    const s3Fallback = buildManagedS3FallbackClient();
    if (s3Fallback) return s3Fallback;
    // Then try managed Drive service account
    const driveFallback = buildManagedDriveFallbackProvider(firmId);
    if (driveFallback) return driveFallback;
    const err = new Error('No active storage backend available for docket narratives');
    err.code = 'STORAGE_NOT_CONNECTED';
    throw err;
  }
}

/**
 * Returns true if the Drive API error is a token expiry / revocation error.
 */
function isDriveTokenError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const status = error?.status || error?.code || error?.response?.status;
  return (
    msg.includes('invalid_grant') ||
    msg.includes('token has been expired') ||
    msg.includes('revoked') ||
    msg.includes('invalid credentials') ||
    status === 401
  );
}

/**
 * Upload a docket narrative JSON to firm storage.
 * If the firm's connected Drive token is expired/revoked, automatically falls back to
 * managed storage (Google service account or S3) so docket creation still succeeds.
 */
async function uploadNarrative({ firmId, docketId, payload }) {
  await requireWritableBusinessStorage({ firmId, targetPathCategory: 'docket_narrative' });
  const backend = await resolveStorageBackend(firmId);
  const body = JSON.stringify(payload);

  // ── Firm-connected Google Drive path ──────────────────────────────────────
  if (backend.type === 'firm_connected') {
    try {
      const storageRoot = backend.provider.rootFolderId || null;
      const firmsFolder = await backend.provider.getOrCreateFolder(storageRoot, 'firms');
      const firmFolder = await backend.provider.getOrCreateFolder(firmsFolder, String(firmId));
      const docketsFolder = await backend.provider.getOrCreateFolder(firmFolder, 'dockets');
      const docketFolder = await backend.provider.getOrCreateFolder(docketsFolder, String(docketId));
      const uploaded = await backend.provider.uploadFile(docketFolder, DOCKET_OBJECT_NAME, Readable.from(body), 'application/json');
      return {
        provider: backend.provider.providerName || 'google-drive',
        mode: 'firm_connected',
        fileId: uploaded.fileId,
        objectKey: `firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`,
        checksum: sha256(body),
      };
    } catch (driveError) {
      if (isDriveTokenError(driveError)) {
        // Mark storage as disconnected in DB so the UI prompts reconnection
        try {
          const { googleDriveService } = require('./googleDrive.service');
          await googleDriveService.markStorageDisconnected(firmId, driveError.message || 'invalid_grant');
        } catch (markErr) {
          log.warn('[docketNarrativeStorage] Failed to mark storage disconnected', { firmId, error: markErr.message });
        }

        log.warn('[docketNarrativeStorage] Drive token expired — attempting managed fallback', {
          firmId,
          docketId,
          driveError: driveError.message,
        });

        // Try managed Google Drive service account
        const driveFallback = buildManagedDriveFallbackProvider(firmId);
        if (driveFallback) {
          const provider = driveFallback.provider;
          const firmsFolder = await provider.getOrCreateFolder(null, 'firms');
          const firmFolder = await provider.getOrCreateFolder(firmsFolder, String(firmId));
          const docketsFolder = await provider.getOrCreateFolder(firmFolder, 'dockets');
          const docketFolder = await provider.getOrCreateFolder(docketsFolder, String(docketId));
          const uploaded = await provider.uploadFile(docketFolder, DOCKET_OBJECT_NAME, Readable.from(body), 'application/json');
          return {
            provider: 'docketra_managed',
            mode: 'managed_fallback',
            fileId: uploaded.fileId,
            objectKey: `firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`,
            checksum: sha256(body),
          };
        }

        // Try managed S3 fallback
        const s3Fallback = buildManagedS3FallbackClient();
        if (s3Fallback) {
          const objectKey = `${s3Fallback.prefix}/firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`;
          await s3Fallback.client.send(new PutObjectCommand({ Bucket: s3Fallback.bucket, Key: objectKey, Body: body, ContentType: 'application/json' }));
          return { provider: 'docketra_managed', mode: 'managed_fallback', fileId: null, objectKey, checksum: sha256(body) };
        }

        // No fallback available — surface a friendly error instead of raw 'invalid_grant'
        const err = new Error('Cloud storage connection has expired. Please reconnect Google Drive in Storage Settings and try again.');
        err.code = 'STORAGE_TOKEN_EXPIRED';
        err.status = 503;
        throw err;
      }

      // Non-auth Drive error — re-throw as-is
      throw driveError;
    }
  }

  // ── Managed Drive service-account path ────────────────────────────────────
  if (backend.type === 'managed_fallback_drive') {
    const provider = backend.provider;
    const firmsFolder = await provider.getOrCreateFolder(null, 'firms');
    const firmFolder = await provider.getOrCreateFolder(firmsFolder, String(firmId));
    const docketsFolder = await provider.getOrCreateFolder(firmFolder, 'dockets');
    const docketFolder = await provider.getOrCreateFolder(docketsFolder, String(docketId));
    const uploaded = await provider.uploadFile(docketFolder, DOCKET_OBJECT_NAME, Readable.from(body), 'application/json');
    return {
      provider: 'docketra_managed',
      mode: 'managed_fallback',
      fileId: uploaded.fileId,
      objectKey: `firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`,
      checksum: sha256(body),
    };
  }

  // ── Managed S3 path ────────────────────────────────────────────────────────
  const objectKey = `${backend.prefix}/firms/${firmId}/dockets/${docketId}/${DOCKET_OBJECT_NAME}`;
  await backend.client.send(new PutObjectCommand({ Bucket: backend.bucket, Key: objectKey, Body: body, ContentType: 'application/json' }));
  return { provider: 'docketra_managed', mode: 'managed_fallback', fileId: null, objectKey, checksum: sha256(body) };
}

async function readNarrative({ firmId, docketRef }) {
  if (!docketRef?.provider) return null;
  if (docketRef.mode === 'managed_fallback' || docketRef.provider === 'docketra_managed') {
    // Try managed Drive service account if fileId present
    if (docketRef.fileId) {
      const driveFallback = buildManagedDriveFallbackProvider(firmId);
      if (driveFallback) {
        try {
          const stream = await driveFallback.provider.downloadFile(docketRef.fileId);
          return JSON.parse(await streamToString(stream));
        } catch (_err) {
          // fall through to S3
        }
      }
    }
    const s3Fallback = buildManagedS3FallbackClient();
    if (!s3Fallback) throw new Error('Managed fallback unavailable');
    const output = await s3Fallback.client.send(new GetObjectCommand({ Bucket: s3Fallback.bucket, Key: docketRef.objectKey }));
    return JSON.parse(await streamToString(output.Body));
  }
  const backend = await resolveStorageBackend(firmId);
  if (backend.type !== 'firm_connected') throw new Error('Firm storage unavailable');
  const stream = await backend.provider.downloadFile(docketRef.fileId);
  return JSON.parse(await streamToString(stream));
}

module.exports = { uploadNarrative, readNarrative };
