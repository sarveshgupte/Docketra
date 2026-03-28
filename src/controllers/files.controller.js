const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const File = require('../models/File.model');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { getProviderForTenant } = require('../services/storage/StorageProviderFactory');
const { mapProviderErrorToStatus } = require('./storage.controller');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('../services/storage/errors');
const { safeLogForensicAudit, getRequestIp, getRequestUserAgent } = require('../services/forensicAudit.service');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../services/securityAudit.service');
const { noteFileDownload } = require('../services/securityTelemetry.service');

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

    // SECURITY: keep the controller-level tenant lookup as defense-in-depth.
    // The route middleware should populate req.caseRecord, but direct controller
    // callers/tests must still fail closed on the same tenant-scoped query.
    const caseRecord = req.caseRecord || await Case.findOne({
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

    const storagePayload = {
      firmId: tenantId,
      tenantId,
      fileId: file._id.toString(),
      caseId: resolvedCaseId,
      objectKey,
      provider: storageConfig.provider || 'unknown',
    };
    let queueWarning = null;
    try {
      await Promise.all([
        enqueueStorageJob(JOB_TYPES.FILE_SCAN, storagePayload),
        enqueueStorageJob(JOB_TYPES.THUMBNAIL_GENERATE, storagePayload),
        enqueueStorageJob(JOB_TYPES.FILE_METADATA, storagePayload),
      ]);
    } catch (queueError) {
      queueWarning = 'Background processing delayed';
      console.error('[STORAGE]', {
        event: 'upload_queue_failed',
        tenantId,
        fileId: file._id.toString(),
        message: queueError.message,
      });
      try {
        await Promise.all([
          enqueueStorageJob(JOB_TYPES.FILE_SCAN, storagePayload),
          enqueueStorageJob(JOB_TYPES.THUMBNAIL_GENERATE, storagePayload),
          enqueueStorageJob(JOB_TYPES.FILE_METADATA, storagePayload),
        ]);
      } catch (retryError) {
        console.error('[STORAGE]', {
          event: 'upload_queue_retry_failed',
          tenantId,
          fileId: file._id.toString(),
          message: retryError.message,
        });
      }
    }

    await safeLogForensicAudit({
      tenantId,
      entityType: 'FILE',
      entityId: file._id.toString(),
      action: 'FILE_UPLOAD',
      performedBy: userId,
      performedByRole: req.user?.role || null,
      impersonatedBy: req.context?.isSuperAdmin ? req.user?.xID || null : null,
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      metadata: {
        caseId: resolvedCaseId,
        objectKey,
        originalName,
        mimeType,
        size,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        fileId: file._id,
        uploadUrl,
        objectKey,
        expiresIn: URL_EXPIRY_SECONDS,
        warnings: queueWarning ? [queueWarning] : [],
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

    await safeLogForensicAudit({
      tenantId,
      entityType: 'FILE',
      entityId: file._id.toString(),
      action: 'FILE_DOWNLOAD',
      performedBy: userId,
      performedByRole: req.user?.role || null,
      impersonatedBy: req.context?.isSuperAdmin ? req.user?.xID || null : null,
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      metadata: {
        caseId: file.caseId,
        objectKey: file.objectKey,
      },
    });
    await logSecurityAuditEvent({
      req,
      action: SECURITY_AUDIT_ACTIONS.FILE_DOWNLOADED,
      resource: `files/${file._id.toString()}/download`,
      userId: req.user?._id || null,
      firmId: tenantId,
      xID: req.user?.xID || null,
      performedBy: req.user?.xID || req.user?._id?.toString?.() || 'SYSTEM',
      metadata: {
        fileId: file._id.toString(),
        caseId: file.caseId,
        objectKey: file.objectKey,
      },
      description: 'File download URL generated for tenant-scoped file',
    }).catch(() => null);
    await noteFileDownload({
      req,
      userId: req.user?._id?.toString?.() || null,
      firmId: tenantId,
      fileId: file._id.toString(),
    });

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
