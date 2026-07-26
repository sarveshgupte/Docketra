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
const { ITEM_STATUSES, toClientFacingChecklist, normalizeChecklistItem, getChecklistSummary, computeComplianceStateFromChecklist } = require('../services/clientRequestChecklist.service');

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
    const { requirePin = false, expiry = '24h', sendEmail: shouldSendEmail = false, clientMessage, internalComment, reopenAt, to, customSubject, customBody } = req.body;

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

    const Comment = require('../models/Comment.model');
    if (internalComment && typeof internalComment === 'string' && internalComment.trim()) {
      await Comment.create({
        caseId: caseData.caseId || caseData.caseNumber,
        firmId: String(req.user.firmId),
        text: internalComment.trim(),
        createdBy: req.user.email,
        createdByXID: req.user.xID,
        createdByName: req.user.name,
      });
    }

    const expiryMap = { '24h': 24, '48h': 48, '7d': 168, '14d': 336, '30d': 720 };
    const expiryHours = expiryMap[expiry] || (typeof expiry === 'number' ? expiry : 168);

    const result = await createUploadSession({
      docketId: caseData.caseId,
      firmId: String(req.user.firmId),
      requirePin,
      expiryHours,
      clientMessage: clientMessage ? String(clientMessage).trim() : null,
      senderName: req.user.name || req.user.email,
      senderEmail: req.user.email,
      reopenAt: reopenAt ? new Date(reopenAt) : null,
    });

    const reqHost = req.get('host');
    const reqProtocol = req.protocol || 'http';
    const fallbackBaseUrl = reqHost ? `${reqProtocol}://${reqHost}` : 'http://localhost:5173';
    const baseUrl = (process.env.FRONTEND_URL || process.env.APP_URL || fallbackBaseUrl).replace(/\/+$/, '');
    const uploadLink = `${baseUrl}/upload/${result.token}`;

    const resolvedEmail = await resolveClientEmail(caseData, req.user.firmId);
    const clientEmail = (to && String(to).trim()) ? String(to).trim().toLowerCase() : resolvedEmail;

    if (shouldSendEmail && clientEmail) {
      const firmName = req.user.firmName || req.user.firm?.name || caseData.firmName || 'Our Firm';
      const senderName = req.user.name || firmName;
      const validityText = expiryHours >= 168 ? `${Math.round(expiryHours / 24)} Days` : `${expiryHours} Hours`;

      function getDocketDisplayTitle(caseData) {
        const rawTitle = String(caseData?.title || '').trim();
        if (rawTitle && rawTitle.toLowerCase() !== 'title' && rawTitle.toLowerCase() !== 'untitled docket') {
          return rawTitle;
        }
        const category = caseData?.category || caseData?.caseCategory || caseData?.categoryName;
        const subCategory = caseData?.subCategory || caseData?.caseSubCategory || caseData?.subCategoryName;
        const workType = caseData?.workType || caseData?.serviceType;

        if (category && subCategory) {
          return `${category} - ${subCategory}`;
        }
        if (subCategory) {
          return subCategory;
        }
        if (category) {
          return category;
        }
        if (workType) {
          return workType;
        }
        return '';
      }

      const displayTitle = getDocketDisplayTitle(caseData);
      const emailSubject = customSubject || `Action Required: Documents needed for ${displayTitle || 'your request'}`;

      let htmlContent = '';
      let textContent = '';

      if (customBody && typeof customBody === 'string' && customBody.trim()) {
        const linkBlockHtml = `<div style="margin: 20px 0;"><a href="${uploadLink}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload Documents & Respond &rarr;</a><p style="color: #64748b; font-size: 13px; margin-top: 10px;">Or copy link: <a href="${uploadLink}" style="color: #0284c7;">${uploadLink}</a></p></div>`;
        
        if (customBody.includes('[Upload Link]')) {
          htmlContent = `<div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">${customBody.replace(/\[Upload Link\]/g, linkBlockHtml).replace(/\n/g, '<br>')}</div>`;
          textContent = customBody.replace(/\[Upload Link\]/g, `\n\nUpload Link: ${uploadLink}\n\n`);
        } else {
          htmlContent = `<div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">${customBody.replace(/\n/g, '<br>')}<br><br>${linkBlockHtml}</div>`;
          textContent = `${customBody}\n\nUpload Link: ${uploadLink}`;
        }
      } else {
        const formattedMessage = clientMessage
          ? `<div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 18px; margin: 16px 0; border-radius: 4px;"><p style="margin: 0; color: #475569; font-size: 13px; font-weight: 600; text-transform: uppercase;">Message from ${senderName}:</p><p style="margin: 6px 0 0 0; color: #0f172a; font-size: 15px; line-height: 1.5;">${clientMessage}</p></div>`
          : '';

        htmlContent = `
          <div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
            <h2 style="margin-top: 0; color: #0f172a;">Document Request</h2>
            <p>Dear Client,</p>
            <p>Documents/information have been requested for <strong>${caseData.title || caseData.workType || 'your request'}</strong>.</p>
            ${formattedMessage}
            <p style="margin-top: 24px;">
              <a href="${uploadLink}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upload Documents & Respond &rarr;</a>
            </p>
            <p style="color: #64748b; font-size: 13px; margin-top: 16px;">Link Validity: ${validityText}</p>
            <p style="color: #64748b; font-size: 13px; margin-top: 12px;">Or copy and paste this secure link into your browser:<br/><a href="${uploadLink}" style="color: #0284c7;">${uploadLink}</a></p>
            <p style="margin-top: 24px; color: #0f172a;">Best regards,<br/><strong>${firmName}</strong></p>
          </div>
        `;

        textContent = [
          `Action Required: Documents needed for ${caseData.title || caseData.workType || 'your request'}`,
          clientMessage ? `Message from ${senderName}: ${clientMessage}` : '',
          `Upload Link: ${uploadLink}`,
          `Link Validity: ${validityText}`,
          `Best regards,\n${firmName}`,
        ].filter(Boolean).join('\n\n');
      }

      await sendEmail({
        to: clientEmail,
        subject: emailSubject,
        html: htmlContent,
        text: textContent,
      });

      // Log EmailCapture so message appears in docket's Email Communications log
      const EmailCapture = require('../models/EmailCapture.model');
      await EmailCapture.create({
        firmId: req.user.firmId,
        tenantId: String(req.user.firmId),
        sender: { name: req.user.name || req.user.email, email: req.user.email },
        recipients: [clientEmail],
        subject: emailSubject,
        receivedAt: new Date(),
        bodyExcerpt: textContent.substring(0, 1000),
        linkedClientId: caseData.client?._id || null,
        linkedCaseInternalId: caseData.caseInternalId,
        linkedCaseId: caseData.caseId || caseData.caseNumber,
        classification: 'awaiting_reply',
        ownerXID: req.user.xID || null,
        createdByXID: req.user.xID || 'SYSTEM',
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

    const reqHost = req.get('host');
    const reqProtocol = req.protocol || 'http';
    const fallbackBaseUrl = reqHost ? `${reqProtocol}://${reqHost}` : 'http://localhost:5173';
    const baseUrl = (process.env.FRONTEND_URL || process.env.APP_URL || fallbackBaseUrl).replace(/\/+$/, '');
    const uploadLink = `${baseUrl}/upload/${latestSession.token}`;

    return res.json({
      success: true,
      data: {
        status,
        expiresAt: latestSession.expiresAt,
        link: uploadLink,
        token: latestSession.token,
        requiresPin: !!latestSession.pinHash,
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

    let checklist = [];
    let summary = null;
    let docketDetails = null;

    if (!expired) {
      const caseData = await CaseRepository.findByCaseId(session.firmId, session.docketId, 'admin', { includeClient: true });
      const clientEmail = await resolveClientEmail(caseData, session.firmId);
      
      const normalized = Array.isArray(caseData?.checklist)
        ? caseData.checklist.map((item, idx) => normalizeChecklistItem(item, idx))
        : [];
      checklist = toClientFacingChecklist(normalized);
      summary = getChecklistSummary(normalized);

      docketDetails = {
        docketNumber: caseData?.caseNumber || session.docketId,
        workType: caseData?.workType || 'Compliance',
        clientName: caseData?.client?.businessName || caseData?.client?.contactPersonName || 'Client',
        senderName: session.senderName || 'Docketra Team',
        clientMessage: session.clientMessage || null,
        clientEmail,
      };
    }

    return res.json({
      success: true,
      data: {
        requiresPin: !!session.pinHash,
        expired,
        checklist,
        summary,
        docket: docketDetails,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false });
  }
}

async function uploadDocument(req, res) {
  try {
    const { token } = req.params;
    const { pin, comment, checklistItemId } = req.body;

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

    // Ensure the Case CFS folder structure is fully initialized under BYOS rules
    const isValidStructure = await cfsDriveService.validateCFSMetadata(caseData.drive);
    if (!isValidStructure) {
      const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
      const provider = await StorageProviderFactory.getProvider(session.firmId);
      const folderIds = await cfsDriveService.createCFSFolderStructure(
        String(session.firmId),
        caseData.caseId,
        provider
      );
      caseData.drive = folderIds;
      await CaseRepository.updateByCaseId(session.firmId, caseData.caseId, { $set: { drive: folderIds } });
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
      description: comment || 'Uploaded via client upload link',
      createdBy: 'client-upload@external.local',
      createdByName: 'Client Upload Link',
      source: 'CLIENT_UPLOAD',
    });

    // Write client comment & document upload to Docket Comment Feed
    const Comment = require('../models/Comment.model');
    const commentText = `Received client document: "${req.file.originalname}" via upload portal.` +
      (comment && String(comment).trim() ? `\nClient Comment: "${String(comment).trim()}"` : '');

    await Comment.create({
      caseId: caseData.caseId || caseData.caseNumber,
      firmId: String(caseData.firmId),
      text: commentText,
      createdBy: 'CLIENT',
      createdByXID: 'CLIENT',
      createdByName: 'Client (Upload Portal)',
    });

    if (checklistItemId && Array.isArray(caseData?.checklist)) {
      const normalizedChecklist = caseData.checklist.map((item, idx) => normalizeChecklistItem(item, idx));
      const idx = normalizedChecklist.findIndex((item) => String(item?.id || '') === String(checklistItemId));
      if (idx >= 0) {
        normalizedChecklist[idx] = normalizeChecklistItem({
          ...normalizedChecklist[idx],
          status: ITEM_STATUSES.SUBMITTED,
          uploadedAttachmentId: String(caseFile._id),
          uploadedFileName: req.file.originalname,
          submittedAt: new Date(),
          submittedBy: 'client_upload_link',
        }, idx);
        const nextComplianceState = computeComplianceStateFromChecklist({
          checklist: normalizedChecklist,
          currentState: caseData.compliance_state,
        });
        await CaseRepository.updateByCaseId(session.firmId, caseData.caseId, {
          $set: {
            checklist: normalizedChecklist,
            compliance_state: nextComplianceState,
          },
        });
      }
    }

    await enqueueStorageJob(JOB_TYPES.UPLOAD_FILE, {
      firmId: String(caseData.firmId),
      provider: 'google',
      caseId: caseData.caseId,
      folderId: targetFolderId,
      fileId: caseFile._id,
    });

    // Early auto-unpend: If docket is currently pended, transition PEND -> ASSIGNED
    const { reopenDocketFromClientEmail } = require('../services/docketWorkflow.service');
    await reopenDocketFromClientEmail(caseData.caseId, caseData.firmId, session.senderEmail || 'Client Upload Portal');

    if (caseData?.assignedToXID) {
      await createNotification({
        firmId: String(caseData.firmId),
        userId: caseData.assignedToXID,
        type: NotificationTypes.CLIENT_UPLOAD,
        docketId: caseData.caseId,
        actor: { xID: 'CLIENT', role: 'EXTERNAL' },
      });
    }

    return res.json({ success: true, message: 'File upload processed and queued for storage' });
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
