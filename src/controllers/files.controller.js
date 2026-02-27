const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const File = require('../models/File.model');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');
const { mapProviderErrorToStatus } = require('./storage.controller');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('../storage/errors');

const URL_EXPIRY_SECONDS = 10 * 60;

function normalizePrefix(prefix = '') {
  return String(prefix).replace(/^\/+|\/+$/g, '');
}

function logFileAction({ tenantId, userId, caseId, objectKey, action }) {
  console.info('[FileAudit]', {
    tenantId,
    userId,
    caseId,
    objectKey,
    action,
  });
}

function handleStorageError(error, tenantId, res) {
  if (
    error instanceof StorageConfigMissingError ||
    error instanceof UnsupportedProviderError ||
    error instanceof StorageAccessError
  ) {
    console.error('[StorageError]', {
      tenantId,
      code: error.code,
      message: error.message,
    });
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }

  return null;
}

function shouldUpdateStorageStatus(error) {
  const message = (error?.message || '').toLowerCase();
  if (error?.status === 401 || message.includes('invalid_grant')) return true;
  if (error?.status === 403 && message.includes('quota')) return true;
  if (typeof error?.status === 'number' && error.status >= 500) return true;
  return false;
}

async function getActiveStorageConfig(tenantId) {
  return TenantStorageConfig.findOne({ tenantId, isActive: true }).select('status');
}

async function requestUpload(req, res) {
  const tenantId = req.firmId;
  const userId = req.user?._id?.toString() || req.user?.xID || 'unknown';

  try {
    const { caseId, originalName, mimeType, size } = req.body;
    const storageConfig = await getActiveStorageConfig(tenantId);
    if (!storageConfig || storageConfig.status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        message: 'Storage is not active for this tenant',
      });
    }

    const caseRecord = await Case.findOne({
      firmId: tenantId,
      $or: [{ caseId }, { caseNumber: caseId }],
    }).select('caseId');

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found for tenant',
      });
    }

    const provider = await getProviderForTenant(tenantId);
    const prefix = normalizePrefix(provider.prefix);
    const resolvedCaseId = caseRecord.caseId || caseId;
    const objectKey = `${prefix ? `${prefix}/` : ''}cases/${resolvedCaseId}/${randomUUID()}`;

    const uploadUrl = await provider.generateUploadUrl(objectKey, URL_EXPIRY_SECONDS);

    const file = await File.create({
      tenantId,
      caseId: resolvedCaseId,
      objectKey,
      originalName,
      mimeType,
      size,
      uploadedBy: userId,
      status: 'PENDING',
    });

    logFileAction({ tenantId, userId, caseId: resolvedCaseId, objectKey, action: 'UPLOAD_REQUEST' });

    return res.status(201).json({
      success: true,
      data: {
        fileId: file._id,
        uploadUrl,
        objectKey,
        expiresIn: URL_EXPIRY_SECONDS,
      },
    });
  } catch (error) {
    const handled = handleStorageError(error, tenantId, res);
    if (handled) return handled;

    console.error('[requestUpload] Error', { tenantId, message: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to request upload URL',
    });
  }
}

async function downloadFile(req, res) {
  const tenantId = req.firmId;
  const userId = req.user?._id?.toString() || req.user?.xID || 'unknown';

  try {
    const { fileId } = req.params;
    const file = await File.findOne({ _id: fileId, tenantId });
    const storageConfig = await getActiveStorageConfig(tenantId);
    if (!storageConfig || storageConfig.status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        message: 'Storage is not active for this tenant',
      });
    }

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const provider = await getProviderForTenant(tenantId);
    try {
      await provider.getFileMetadata(tenantId, file.objectKey);
      if (file.status !== 'AVAILABLE') {
        await File.updateOne({ _id: file._id }, { status: 'AVAILABLE' });
      }
    } catch (metadataError) {
      if (metadataError?.status === 404) {
        await File.updateOne({ _id: file._id }, { status: 'MISSING' });
        console.warn('[FileAudit]', { tenantId, fileId, action: 'FILE_DRIFT_MISSING' });
        return res.status(410).json({
          success: false,
          message: 'File is missing from configured storage provider',
          code: 'FILE_MISSING',
        });
      }
      throw metadataError;
    }
    const downloadUrl = await provider.generateDownloadUrl(file.objectKey, URL_EXPIRY_SECONDS);

    logFileAction({ tenantId, userId, caseId: file.caseId, objectKey: file.objectKey, action: 'DOWNLOAD' });

    return res.json({
      success: true,
      data: {
        fileId: file._id,
        downloadUrl,
        expiresIn: URL_EXPIRY_SECONDS,
      },
    });
  } catch (error) {
    if (shouldUpdateStorageStatus(error)) {
      await TenantStorageConfig.updateMany(
        { tenantId, isActive: true },
        { status: mapProviderErrorToStatus(error) }
      ).catch((statusUpdateError) => {
        console.error('[downloadFile] Failed to update storage status', {
          tenantId,
          message: statusUpdateError.message,
        });
      });
    }
    const handled = handleStorageError(error, tenantId, res);
    if (handled) return handled;

    console.error('[downloadFile] Error', { tenantId, message: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate download URL',
    });
  }
}

module.exports = {
  requestUpload,
  downloadFile,
};
