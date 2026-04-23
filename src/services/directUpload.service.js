const { randomUUID } = require('crypto');
const CaseFile = require('../models/CaseFile.model');
const Attachment = require('../models/Attachment.model');
const { CaseRepository, ClientRepository } = require('../repositories');
const cfsDriveService = require('./cfsDrive.service');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const { S3Provider } = require('./storage/providers/S3Provider');

const DIRECT_UPLOAD_TTL_MS = Number(process.env.DIRECT_UPLOAD_TTL_MS || 15 * 60 * 1000);
const DIRECT_UPLOAD_RETENTION_MS = Number(process.env.DIRECT_UPLOAD_RETENTION_MS || 30 * 24 * 60 * 60 * 1000);
const ALLOWED_MIME_TYPES = (process.env.ALLOWED_UPLOAD_MIME_TYPES || 'application/pdf,image/png,image/jpeg')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 25 * 1024 * 1024);

const isDirectUploadsEnabled = () => process.env.DIRECT_UPLOADS_ENABLED !== 'false';

const ensureDirectUploadsEnabled = () => {
  if (!isDirectUploadsEnabled()) {
    const error = new Error('Direct uploads are disabled');
    error.status = 503;
    error.code = 'DIRECT_UPLOADS_DISABLED';
    throw error;
  }
};

const assertMimeAndSize = ({ mimeType, size }) => {
  const normalizedMime = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    const error = new Error('Invalid file MIME type');
    error.status = 400;
    error.code = 'INVALID_FILE_TYPE';
    throw error;
  }

  const parsedSize = Number(size || 0);
  if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize > MAX_UPLOAD_SIZE_BYTES) {
    const error = new Error('Invalid file size');
    error.status = 400;
    error.code = 'INVALID_FILE_SIZE';
    throw error;
  }
};

const resolveActor = (user = {}) => ({
  createdBy: String(user?.email || 'unknown@docketra.internal').toLowerCase(),
  createdByXID: user?.xID || 'SYSTEM',
  createdByName: user?.name || user?.email || user?.xID || 'System',
});

const buildManagedFallbackProvider = (firmId) => {
  const bucket = process.env.MANAGED_STORAGE_S3_BUCKET;
  const region = process.env.MANAGED_STORAGE_S3_REGION;
  if (!bucket || !region) return null;

  const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
        ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
      }
    : undefined;

  const prefix = `${(process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').replace(/^\/+|\/+$/g, '')}/firms/${String(firmId)}`;
  const provider = new S3Provider({
    tenantId: String(firmId),
    bucket,
    region,
    prefix,
    credentials,
  });
  return {
    mode: 'managed_fallback',
    provider,
    providerName: 'docketra_managed',
  };
};

const resolveUploadBackend = async (firmId) => {
  try {
    const provider = await StorageProviderFactory.getProvider(firmId);
    return {
      mode: 'firm_connected',
      provider,
      providerName: provider.providerName || 'firm_connected',
    };
  } catch (error) {
    const fallback = buildManagedFallbackProvider(firmId);
    if (fallback) return fallback;

    const noBackendError = new Error('No active storage backend available');
    noBackendError.status = 503;
    noBackendError.code = 'STORAGE_NOT_AVAILABLE';
    throw noBackendError;
  }
};

const resolveUploadBackendForSession = async (firmId, uploadRecord) => {
  if (uploadRecord?.providerMode === 'managed_fallback') {
    const fallback = buildManagedFallbackProvider(firmId);
    if (!fallback) {
      const err = new Error('Original managed fallback backend is unavailable for this upload session');
      err.status = 503;
      err.code = 'UPLOAD_SESSION_BACKEND_UNAVAILABLE';
      throw err;
    }
    return fallback;
  }
  if (uploadRecord?.providerMode === 'firm_connected') {
    try {
      const provider = await StorageProviderFactory.getProvider(firmId);
      return { mode: 'firm_connected', provider, providerName: provider.providerName || 'firm_connected' };
    } catch (_error) {
      const err = new Error('Original firm-connected backend is unavailable for this upload session');
      err.status = 503;
      err.code = 'UPLOAD_SESSION_BACKEND_UNAVAILABLE';
      throw err;
    }
  }
  return resolveUploadBackend(firmId);
};

const resolveCaseContext = async ({ firmId, caseId, role, requireFolder = true }) => {
  const caseData = await CaseRepository.findByCaseId(firmId, caseId, role, { includeClient: true })
    || await CaseRepository.findByCaseId(firmId, caseId, role);

  if (!caseData) {
    const error = new Error('Docket not found');
    error.status = 404;
    throw error;
  }

  if (!requireFolder) {
    return { folderId: null };
  }

  const folderId = cfsDriveService.getFolderIdForFileType(caseData.drive, 'attachment');
  if (!folderId) {
    const error = new Error('Case storage folder not initialized');
    error.status = 400;
    throw error;
  }

  return { folderId };
};

const resolveClientContext = async ({ firmId, clientId, role, fileType = 'documents', provider, requireFolder = true }) => {
  const client = await ClientRepository.findByClientId(firmId, clientId, role);
  if (!client) {
    const error = new Error('Client not found or access denied');
    error.status = 404;
    throw error;
  }

  if (!requireFolder) {
    return { folderId: null };
  }

  const isValidStructure = await cfsDriveService.validateClientCFSMetadata(client.drive);
  if (!isValidStructure) {
    const folderIds = await cfsDriveService.createClientCFSFolderStructure(String(firmId), clientId, provider);
    client.drive = folderIds;
    await client.save();
  }

  const folderId = cfsDriveService.getClientFolderIdForFileType(client.drive, fileType);
  return { folderId };
};

const buildObjectKey = ({ source, caseId, clientId, fileName, uploadId }) => {
  const safeFileName = String(fileName || 'upload.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (source === 'client_cfs') {
    return `client-cfs/${clientId}/${uploadId}/${safeFileName}`;
  }
  return `dockets/${caseId}/${uploadId}/${safeFileName}`;
};

const normalizeChecksum = (checksum) => {
  if (!checksum) return null;
  const raw = String(checksum).trim().toLowerCase();
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      raw,
      algorithm: parts[0],
      value: parts[1],
    };
  }
  return {
    raw,
    algorithm: null,
    value: raw,
  };
};

const areChecksumsComparable = (left, right) => {
  if (!left || !right) return false;
  if (!left.algorithm || !right.algorithm) return true;
  return left.algorithm === right.algorithm;
};

const computeCleanupAtForStatus = (status, fromDate = new Date()) => {
  if (!['verified', 'failed', 'abandoned'].includes(status)) return null;
  return new Date(fromDate.getTime() + DIRECT_UPLOAD_RETENTION_MS);
};

const markUploadSessionStatus = async (uploadRecord, status, extras = {}) => {
  uploadRecord.uploadStatus = status;
  uploadRecord.cleanupAt = computeCleanupAtForStatus(status);
  Object.assign(uploadRecord, extras);
  await uploadRecord.save();
};

const throwChecksumMismatchError = async (uploadRecord, message) => {
  await markUploadSessionStatus(uploadRecord, 'failed', {
    errorMessage: 'UPLOAD_CHECKSUM_MISMATCH',
  });
  const error = new Error(message);
  error.status = 400;
  error.code = 'UPLOAD_CHECKSUM_MISMATCH';
  throw error;
};

const createIntent = async ({
  firmId,
  caseId,
  clientId,
  source,
  fileName,
  mimeType,
  size,
  description,
  note,
  role,
  user,
  fileType,
  checksum,
}) => {
  ensureDirectUploadsEnabled();
  assertMimeAndSize({ mimeType, size });

  const backend = await resolveUploadBackend(firmId);
  const provider = backend.provider;

  let folderId = null;
  const requireFolder = backend.mode === 'firm_connected';
  if (source === 'upload') {
    ({ folderId } = await resolveCaseContext({ firmId, caseId, role, requireFolder }));
  } else if (source === 'client_cfs') {
    ({ folderId } = await resolveClientContext({ firmId, clientId, role, fileType, provider, requireFolder }));
  } else {
    const err = new Error('Unsupported upload source');
    err.status = 400;
    throw err;
  }

  const uploadId = randomUUID();
  const expiresAt = new Date(Date.now() + DIRECT_UPLOAD_TTL_MS);
  const directSession = await provider.createDirectUploadSession({
    fileName,
    mimeType,
    size,
    folderId,
    firmId: String(firmId),
    source,
    contextId: caseId || clientId,
    uploadId,
    objectKey: buildObjectKey({ source, caseId, clientId, fileName, uploadId }),
    expiresAt,
  });

  const actor = resolveActor(user);
  const normalizedChecksum = normalizeChecksum(checksum);
  const uploadRecord = await CaseFile.create({
    firmId,
    caseId,
    clientId,
    originalName: fileName,
    mimeType,
    size,
    uploadStatus: 'initiated',
    description: String(description || 'Attachment upload').trim(),
    note,
    source,
    targetFolderId: folderId,
    provider: directSession.provider,
    providerMode: backend.mode,
    providerObjectKey: directSession.objectKey || null,
    providerFileId: directSession.providerFileId || null,
    expiresAt,
    cleanupAt: computeCleanupAtForStatus('initiated'),
    checksum: normalizedChecksum?.raw || null,
    ...actor,
  });

  return {
    uploadId: String(uploadRecord._id),
    expiresAt,
    provider: directSession.provider,
    providerMode: backend.mode,
    uploadUrl: directSession.uploadUrl,
    uploadMethod: directSession.method || 'PUT',
    uploadHeaders: directSession.headers || {},
    providerFileId: directSession.providerFileId || null,
    objectKey: directSession.objectKey || null,
    constraints: {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    },
  };
};

const assertClientCompletionMatchesSession = ({ uploadRecord, completion = {} }) => {
  const providedProviderFileId = completion.providerFileId;
  const providedObjectKey = completion.objectKey;

  if (providedProviderFileId && uploadRecord.providerFileId && String(providedProviderFileId) !== String(uploadRecord.providerFileId)) {
    const error = new Error('Provider file identifier mismatch');
    error.status = 400;
    error.code = 'UPLOAD_IDENTIFIER_MISMATCH';
    throw error;
  }

  if (providedObjectKey && uploadRecord.providerObjectKey && String(providedObjectKey) !== String(uploadRecord.providerObjectKey)) {
    const error = new Error('Provider object key mismatch');
    error.status = 400;
    error.code = 'UPLOAD_IDENTIFIER_MISMATCH';
    throw error;
  }
};

const finalizeIntent = async ({ uploadId, firmId, user, completion = {}, checksum }) => {
  ensureDirectUploadsEnabled();

  const uploadRecord = await CaseFile.findOne({ _id: uploadId, firmId: String(firmId) });
  if (!uploadRecord) {
    const error = new Error('Upload session not found');
    error.status = 404;
    error.code = 'UPLOAD_SESSION_NOT_FOUND';
    throw error;
  }

  if (uploadRecord.uploadStatus === 'verified') {
    if (!uploadRecord.attachmentId) {
      const error = new Error('Upload session is verified but missing attachment linkage');
      error.status = 409;
      error.code = 'UPLOAD_SESSION_CORRUPT';
      throw error;
    }
    const existingAttachment = await Attachment.findOne({
      _id: uploadRecord.attachmentId,
      firmId: String(firmId),
    });
    if (!existingAttachment) {
      const error = new Error('Upload session attachment linkage not found');
      error.status = 409;
      error.code = 'UPLOAD_SESSION_CORRUPT';
      throw error;
    }
    return existingAttachment;
  }

  if (uploadRecord.uploadStatus === 'failed' || uploadRecord.uploadStatus === 'abandoned') {
    const error = new Error('Upload session is not in initiated state');
    error.status = 409;
    error.code = 'UPLOAD_SESSION_TERMINAL';
    throw error;
  }

  if (uploadRecord.expiresAt && new Date() > uploadRecord.expiresAt) {
    await markUploadSessionStatus(uploadRecord, 'abandoned');
    const error = new Error('Upload session expired');
    error.status = 410;
    error.code = 'UPLOAD_SESSION_EXPIRED';
    throw error;
  }

  if (uploadRecord.uploadStatus !== 'initiated' && uploadRecord.uploadStatus !== 'uploaded') {
    const error = new Error('Upload session is not in an actionable state');
    error.status = 409;
    error.code = 'UPLOAD_SESSION_INVALID_STATE';
    throw error;
  }

  assertClientCompletionMatchesSession({ uploadRecord, completion });

  const sessionChecksum = normalizeChecksum(uploadRecord.checksum);
  const providedChecksum = normalizeChecksum(checksum);
  if (sessionChecksum && providedChecksum && sessionChecksum.raw !== providedChecksum.raw) {
    await throwChecksumMismatchError(uploadRecord, 'Upload checksum mismatch');
  }

  const lockRecord = await CaseFile.findOneAndUpdate(
    { _id: uploadRecord._id, firmId: String(firmId), uploadStatus: 'initiated' },
    { $set: { uploadStatus: 'uploaded' } },
    { new: true }
  );

  if (lockRecord) {
    uploadRecord.uploadStatus = lockRecord.uploadStatus;
  } else {
    const latestRecord = await CaseFile.findOne({ _id: uploadRecord._id, firmId: String(firmId) });
    if (latestRecord?.uploadStatus === 'verified' && latestRecord.attachmentId) {
      const existingAttachment = await Attachment.findOne({ _id: latestRecord.attachmentId, firmId: String(firmId) });
      if (existingAttachment) return existingAttachment;
    }
    if (latestRecord?.uploadStatus === 'uploaded') {
      const error = new Error('Upload session is already being finalized');
      error.status = 409;
      error.code = 'UPLOAD_SESSION_IN_PROGRESS';
      throw error;
    }
    const error = new Error('Upload session is already being finalized');
    error.status = 409;
    error.code = 'UPLOAD_SESSION_IN_PROGRESS';
    throw error;
  }

  const backend = await resolveUploadBackendForSession(firmId, uploadRecord);
  const provider = backend.provider;
  const verifyFileId = uploadRecord.providerFileId || completion.providerFileId || null;
  const verifyObjectKey = uploadRecord.providerObjectKey || completion.objectKey || null;

  const verified = await provider.verifyUploadedObject({
    fileId: verifyFileId,
    objectKey: verifyObjectKey,
    folderId: uploadRecord.targetFolderId,
    expectedSize: uploadRecord.size,
    expectedMimeType: uploadRecord.mimeType,
  });

  if (!verified?.ok) {
    await markUploadSessionStatus(uploadRecord, 'failed', {
      errorMessage: verified?.reason || 'UPLOAD_VERIFICATION_FAILED',
    });
    const error = new Error('Uploaded object verification failed');
    error.status = 400;
    error.code = 'UPLOAD_VERIFICATION_FAILED';
    throw error;
  }

  const providerChecksum = normalizeChecksum(verified?.checksum?.raw || verified?.checksum?.value || verified?.checksum);
  const clientChecksum = providedChecksum || sessionChecksum;
  if (providerChecksum && clientChecksum && areChecksumsComparable(providerChecksum, clientChecksum) && providerChecksum.value !== clientChecksum.value) {
    await throwChecksumMismatchError(uploadRecord, 'Upload checksum mismatch');
  }

  const latest = await Attachment.findOne({
    caseId: uploadRecord.caseId,
    firmId: String(firmId),
    fileName: uploadRecord.originalName,
  }).sort({ version: -1, createdAt: -1 }).select('version').lean();

  const version = Number(latest?.version || 0) + 1;
  const createdAt = new Date();
  const actor = resolveActor(user);
  const canonicalStorageId = verified.fileId || verifyFileId || verifyObjectKey;

  const attachment = await Attachment.create({
    caseId: uploadRecord.caseId,
    clientId: uploadRecord.clientId,
    firmId: String(firmId),
    fileName: uploadRecord.originalName,
    mimeType: uploadRecord.mimeType,
    size: uploadRecord.size,
    storageFileId: canonicalStorageId,
    storageProvider: verified.provider || uploadRecord.provider,
    driveFileId: (verified.provider || uploadRecord.provider) === 'google-drive' ? canonicalStorageId : null,
    uploadedBy: actor.createdByXID,
    uploadedByName: actor.createdByName,
    createdBy: actor.createdBy,
    createdByXID: actor.createdByXID,
    createdByName: actor.createdByName,
    description: uploadRecord.description || 'Attachment upload',
    uploadedAtReadable: createdAt.toISOString(),
    webViewLink: verified.webViewLink || null,
    version,
    source: uploadRecord.source,
    checksum: clientChecksum?.raw || null,
  });

  await markUploadSessionStatus(uploadRecord, 'verified', {
    storageFileId: canonicalStorageId,
    providerFileId: verified.fileId || uploadRecord.providerFileId || null,
    providerObjectKey: verifyObjectKey || uploadRecord.providerObjectKey || null,
    checksum: clientChecksum?.raw || uploadRecord.checksum || null,
    finalizedAt: new Date(),
    attachmentId: attachment._id,
    errorMessage: null,
  });

  return attachment;
};

module.exports = {
  createIntent,
  finalizeIntent,
  ensureDirectUploadsEnabled,
  isDirectUploadsEnabled,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  resolveUploadBackend,
  resolveUploadBackendForSession,
  computeCleanupAtForStatus,
};
