const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const File = require('../models/File.model');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');
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

async function requestUpload(req, res) {
  const tenantId = req.firmId;
  const userId = req.user?._id?.toString() || req.user?.xID || 'unknown';

  try {
    const { caseId, originalName, mimeType, size } = req.body;

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

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const provider = await getProviderForTenant(tenantId);
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
