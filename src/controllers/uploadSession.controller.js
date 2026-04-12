const path = require('path');
const fs = require('fs/promises');
const { createUploadSession, validateUploadSession, rotateUploadSessionPin } = require('../services/uploadSession.service');
const { CaseRepository } = require('../repositories');
const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const CaseFile = require('../models/CaseFile.model');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const cfsDriveService = require('../services/cfsDrive.service');
const UploadSession = require('../models/UploadSession.model');
const { sendEmail } = require('../services/email.service');
const { createNotification, NotificationTypes } = require('../domain/notifications');
const Client = require('../models/Client.model');

async function resolveClientEmail(caseData, firmId) {
  const candidates = [
    caseData?.clientEmail,
    caseData?.client?.email,
    caseData?.client?.businessEmail,
    caseData?.clientData?.email,
    caseData?.clientData?.businessEmail,
  ];

  let clientEmail = candidates.find((value) => typeof value === 'string' && value.trim());

  if (!clientEmail && caseData?.clientId) {
    const clientRecord = await Client.findOne({
      firmId,
      clientId: caseData.clientId,
      status: { $ne: 'deleted' },
    }).select('businessEmail contactPersonEmailAddress');

    clientEmail = clientRecord?.businessEmail || clientRecord?.contactPersonEmailAddress || '';
  }

  return String(clientEmail || '').trim().toLowerCase();
}

async function generateUploadLink(req, res) {
  try {
    const { caseId } = req.params;
    const { requirePin = false, expiry = '24h', sendEmail: shouldSendEmail = false } = req.body;

    const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
    const caseData = await CaseRepository.findByInternalId(
      req.user.firmId,
      internalId,
      req.user.role,
      { includeClient: true }
    );

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

    const uploadLink = `${process.env.APP_URL}/upload/${result.token}`;
    const clientEmail = await resolveClientEmail(caseData, req.user.firmId);

    if (shouldSendEmail && clientEmail) {
      const expiresInLabel = expiry === '7d' ? '7 days' : '24 hours';
      await sendEmail({
        to: clientEmail,
        subject: 'Documents required',
        html: `
          <p>Please upload documents:</p>
          <p><a href="${uploadLink}">${uploadLink}</a></p>
          <p>Expires in ${expiresInLabel}</p>
        `,
        text: [
          'Please upload documents:',
          uploadLink,
          `Expires in ${expiresInLabel}`,
        ].filter(Boolean).join('\n\n'),
      });
    }

    return res.json({
      success: true,
      data: {
        link: uploadLink,
        pin: result.pin || null,
        expiresAt: result.expiresAt,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function requestUploadPin(req, res) {
  try {
    const { token } = req.params;
    const session = await UploadSession.findOne({ token, isActive: true });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Invalid upload link.' });
    }

    if (new Date() > session.expiresAt) {
      await UploadSession.updateOne({ _id: session._id }, { $set: { isActive: false } });
      return res.status(400).json({ success: false, message: 'This upload link has expired.' });
    }

    if (!session.pinHash) {
      return res.status(400).json({ success: false, message: 'PIN is not required for this upload link.' });
    }

    const caseData = await CaseRepository.findByCaseId(session.firmId, session.docketId, 'admin', { includeClient: true });
    const clientEmail = await resolveClientEmail(caseData, session.firmId);
    if (!clientEmail) {
      return res.status(400).json({ success: false, message: 'No client email is configured for this docket.' });
    }

    const rotatedPin = await rotateUploadSessionPin(session);

    await sendEmail({
      to: clientEmail,
      subject: 'Your secure upload PIN',
      html: `
        <p>Your one-time upload PIN is:</p>
        <p><strong>${rotatedPin}</strong></p>
        <p>This PIN works only with your current secure upload link.</p>
      `,
      text: [
        'Your one-time upload PIN is:',
        rotatedPin,
        'This PIN works only with your current secure upload link.',
      ].join('\n\n'),
    });

    return res.json({
      success: true,
      message: 'PIN has been sent to the client email.',
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function getUploadLinkStatus(req, res) {
  try {
    const { caseId } = req.params;
    const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
    const caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const latestSession = await UploadSession.findOne({
      docketId: caseData.caseId,
      firmId: String(req.user.firmId),
    }).sort({ createdAt: -1 }).lean();

    if (!latestSession) {
      return res.json({ success: true, data: null });
    }

    const now = new Date();
    let status = 'ACTIVE';
    if (!latestSession.isActive) status = 'REVOKED';
    else if (now > new Date(latestSession.expiresAt)) status = 'EXPIRED';

    return res.json({
      success: true,
      data: {
        status,
        expiresAt: latestSession.expiresAt,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function revokeUploadLink(req, res) {
  try {
    const { caseId } = req.params;
    const internalId = await resolveCaseIdentifier(req.user.firmId, caseId, req.user.role);
    const caseData = await CaseRepository.findByInternalId(req.user.firmId, internalId, req.user.role);

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    await UploadSession.updateMany(
      { docketId: caseData.caseId, firmId: String(req.user.firmId), isActive: true },
      { $set: { isActive: false } },
    );

    return res.json({ success: true });
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

    if (caseData?.assignedToXID) {
      await createNotification({
        firmId: String(caseData.firmId),
        userId: caseData.assignedToXID,
        type: NotificationTypes.CLIENT_UPLOAD,
        docketId: caseData.caseId,
        actor: { xID: 'CLIENT', role: 'EXTERNAL' },
      });
    }

    return res.json({ success: true, message: 'File upload queued for processing' });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  generateUploadLink,
  getUploadLinkStatus,
  revokeUploadLink,
  getUploadMeta,
  uploadDocument,
  requestUploadPin,
};
