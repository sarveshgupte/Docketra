const path = require('path');
const fs = require('fs/promises');
const { createUploadSession, validateUploadSession } = require('../services/uploadSession.service');
const { CaseRepository } = require('../repositories');
const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const CaseFile = require('../models/CaseFile.model');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const cfsDriveService = require('../services/cfsDrive.service');
const UploadSession = require('../models/UploadSession.model');

async function generateUploadLink(req, res) {
  try {
    const { caseId } = req.params;
    const { requirePin = false, expiry = '24h' } = req.body;

    const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
    const caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const expiryHours = expiry === '7d' ? 168 : 24;

    const result = await createUploadSession({
      docketId: caseData.caseId,
      firmId: String(req.user.firmId),
      requirePin,
      expiryHours,
    });

    return res.json({
      success: true,
      data: {
        link: `${process.env.APP_URL}/upload/${result.token}`,
        pin: result.pin || null,
        expiresAt: result.expiresAt,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}


async function getUploadMeta(req, res) {
  try {
    const { token } = req.params;

    const session = await UploadSession.findOne({ token, isActive: true });

    if (!session) {
      return res.status(404).json({ success: false });
    }

    const expired = new Date() > session.expiresAt;

    return res.json({
      success: true,
      data: {
        requiresPin: !!session.pinHash,
        expired,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false });
  }
}

async function uploadDocument(req, res) {
  try {
    const { token } = req.params;
    const { pin } = req.body;

    if (!req.file) throw new Error('No file uploaded');

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];

    if (!allowedTypes.includes(req.file.mimetype)) {
      throw new Error('Invalid file type. Only PDF, PNG, JPG allowed.');
    }

    if (req.file.size > 10 * 1024 * 1024) {
      throw new Error('File too large. Max size is 10MB.');
    }

    const session = await validateUploadSession({ token, pin });

    const tempDir = path.join(__dirname, '../../uploads/tmp', session.firmId);
    await fs.mkdir(tempDir, { recursive: true });

    const destinationPath = path.join(tempDir, path.basename(req.file.path));
    await fs.rename(req.file.path, destinationPath);

    const caseData = await CaseRepository.findByCaseId(session.firmId, session.docketId, 'admin');
    if (!caseData) {
      throw new Error('Case not found');
    }

    const targetFolderId = cfsDriveService.getFolderIdForFileType(caseData.drive, 'attachment');
    if (!targetFolderId) {
      throw new Error('Case Drive folder structure not initialized');
    }

    const caseFile = await CaseFile.create({
      firmId: caseData.firmId,
      caseId: caseData.caseId,
      localPath: destinationPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadStatus: 'pending',
      description: 'Uploaded via client upload link',
      createdBy: 'client-upload@external.local',
      createdByName: 'Client Upload Link',
      source: 'CLIENT_UPLOAD',
    });

    await enqueueStorageJob(JOB_TYPES.UPLOAD_FILE, {
      firmId: String(caseData.firmId),
      provider: 'google',
      caseId: caseData.caseId,
      folderId: targetFolderId,
      fileId: caseFile._id,
    });

    return res.json({ success: true, message: 'File upload queued for processing' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  generateUploadLink,
  getUploadMeta,
  uploadDocument,
};
