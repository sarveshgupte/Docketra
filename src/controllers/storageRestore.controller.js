const { storageRestoreService } = require('../services/storageRestore.service');
const { ensureStorageOtpVerification } = require('./storage.controller');
const { requireAdmin } = require('../middleware/permission.middleware');
const log = require('../utils/log');

const initiateStorageRestore = async (req, res) => {
  try {
    // Step-up verification
    if (!ensureStorageOtpVerification(req, res)) return;

    const exportId = req.body?.exportId;
    const file = req.file;

    if (!exportId && !file) {
      return res.status(400).json({
        success: false,
        message: 'Either a past exportId or an uploaded backup ZIP archive is required.',
      });
    }

    const performedBy = req.user?.xID || req.user?.email || 'SYSTEM';
    const performedByRole = req.user?.role || 'SYSTEM';
    
    let jobId;
    if (file) {
      log.info('[RESTORE] Uploaded file restore initiated', { firmId: req.firmId, tempPath: file.path });
      jobId = await storageRestoreService.runRestoreForFirm(req.firmId, {
        uploadedZipPath: file.path,
        performedBy,
        performedByRole,
      });
    } else {
      log.info('[RESTORE] Past exportId restore initiated', { firmId: req.firmId, exportId });
      jobId = await storageRestoreService.runRestoreForFirm(req.firmId, {
        exportId,
        performedBy,
        performedByRole,
      });
    }

    return res.json({
      success: true,
      jobId,
      message: 'Restore job initiated successfully. Progress is being tracked.',
    });
  } catch (error) {
    log.error('[RESTORE] Restore initiation failed', { firmId: req.firmId, message: error.message });
    return res.status(500).json({
      success: false,
      message: 'Unable to initiate restore job.',
      error: error.message,
    });
  }
};

const getRestoreStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobState = storageRestoreService.getActiveRestore(jobId);

    if (!jobState) {
      return res.status(404).json({
        success: false,
        message: 'Active restore job not found.',
      });
    }

    if (String(jobState.firmId) !== String(req.firmId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: unauthorized restore context.',
      });
    }

    return res.json({
      success: true,
      data: {
        jobId: jobState.jobId,
        progress: jobState.progress,
        status: jobState.status,
        error: jobState.error,
        startedAt: jobState.startedAt,
      },
    });
  } catch (error) {
    log.error('[RESTORE] Progress fetch failed', { jobId: req.params.jobId, message: error.message });
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch restore progress.',
    });
  }
};

module.exports = {
  initiateStorageRestore,
  getRestoreStatus,
};
