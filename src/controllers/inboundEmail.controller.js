const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Comment = require('../models/Comment.model');
const EmailCapture = require('../models/EmailCapture.model');
const Attachment = require('../models/Attachment.model');
const ClientRepository = require('../repositories/ClientRepository');
const DocketFileStorageService = require('../services/docketFileStorage.service');
const { reopenDocketFromClientEmail, generateDocketEmailSignature } = require('../services/docketWorkflow.service');
const log = require('../utils/log');
const config = require('../config/config');

const sendError = (res, statusCode, publicCode, debugCode, debugDetails = {}, reqId) => {
  const isDebug = process.env.INBOUND_EMAIL_DEBUG === 'true';
  const response = {
    success: false,
    code: publicCode,
    message: debugDetails.reason || debugCode || publicCode,
    requestId: reqId
  };

  if (isDebug) {
    response.debugCode = debugCode;
    response.details = debugDetails;
  }

  // Logs detail internally to Cloud Run / stdout
  if (statusCode >= 400 && statusCode < 500) {
    log.warn(`[INBOUND_EMAIL] ${statusCode} ${debugCode}: reqId=${reqId} ${JSON.stringify(debugDetails)}`);
  } else {
    log.error(`[INBOUND_EMAIL] ${statusCode} ${debugCode}: reqId=${reqId} ${JSON.stringify(debugDetails)}`);
  }

  return res.status(statusCode).json(response);
};

const handleInboundEmail = async (req, res) => {
  const reqId = req.id || req.requestId || Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const envelope = req.body.envelope || {};
    const headers = req.body.headers || {};
    const body = req.body.body || {};

    const rawFrom = req.body.from || envelope.from || headers.from;
    const rawTo = req.body.to || envelope.to || headers.to;
    const rawSubject = req.body.subject || headers.subject || 'No Subject';
    const rawText = req.body.text || body.plain || req.body.plain || '';
    const rawHtml = req.body.html || body.html || '';
    const attachments = req.body.attachments || [];
    
    if (!rawFrom || !rawTo) {
      return sendError(res, 400, 'INVALID_REQUEST', 'REQUIRED_FIELDS_MISSING', { from: rawFrom || null, to: rawTo || null, reason: 'From and To fields are required.' }, reqId);
    }

    // Extract sender email
    let senderEmail = '';
    let senderName = '';
    if (typeof rawFrom === 'object') {
      senderEmail = rawFrom.email;
      senderName = rawFrom.name;
    } else {
      const fromStr = String(rawFrom).trim();
      const matchFrom = fromStr.match(/^(.+?)\s*<([^>]+)>$/);
      if (matchFrom) {
        senderName = matchFrom[1].trim().replace(/^["']|["']$/g, '');
        senderEmail = matchFrom[2].trim();
      } else {
        senderEmail = fromStr;
      }
    }
    senderEmail = senderEmail.toLowerCase().trim();

    // Extract recipient and parse caseNumber and signature token
    let recipientEmail = '';
    if (typeof rawTo === 'object') {
      recipientEmail = rawTo.email;
    } else if (Array.isArray(rawTo)) {
      const found = rawTo.find(r => String(r?.email || r).toLowerCase().includes('docket-'));
      recipientEmail = typeof found === 'object' ? found.email : String(found || rawTo[0]);
    } else {
      recipientEmail = String(rawTo).trim();
    }
    recipientEmail = recipientEmail.toLowerCase();

    // Match format: docket-<caseNumber>-<signature>@domain
    const recipientMatch = recipientEmail.match(/^(?:docket-)?([a-zA-Z0-9-]+)-([a-f0-9]{6})@/i);
    if (!recipientMatch) {
      return sendError(res, 400, 'INVALID_REQUEST', 'INVALID_RECIPIENT_FORMAT', { recipientEmail, reason: 'Invalid recipient format. Must be docket-<caseNumber>-<signature>@domain.' }, reqId);
    }

    const caseNumber = recipientMatch[1].toUpperCase();
    const providedSignature = recipientMatch[2].toLowerCase();

    // Find Case
    const targetCase = await Case.findOne({
      $or: [
        { caseNumber: caseNumber },
        { caseId: caseNumber }
      ]
    });

    if (!targetCase) {
      return sendError(res, 404, 'NOT_FOUND', 'CASE_NOT_FOUND', { caseNumber, reason: `Docket ${caseNumber} not found.` }, reqId);
    }

    // Webhook Idempotency Check
    const messageId = headers.message_id || headers['message-id'] || headers.messageId || req.body.messageId || null;
    if (messageId) {
      const existingCapture = await EmailCapture.findOne({ messageId, firmId: targetCase.firmId });
      if (existingCapture) {
        const processingTimeMs = Date.now() - startTime;
        log.info(`[INBOUND_EMAIL] Duplicate: reqId=${reqId}, sender=${senderEmail}, recipient=${recipientEmail}, case=${caseNumber}, attachments=0, time=${processingTimeMs}ms`);
        
        return res.status(200).json({
          success: true,
          message: 'Inbound email already processed.',
          data: {
            reopened: false,
            attachmentsUploaded: 0,
            emailCaptureId: existingCapture._id
          }
        });
      }
    }

    // Verify cryptographic signature token
    const expectedSignature = generateDocketEmailSignature(targetCase.caseInternalId);
    if (providedSignature !== expectedSignature) {
      return sendError(res, 403, 'FORBIDDEN', 'INVALID_SIGNATURE', { providedSignature, expectedSignature, caseNumber, reason: 'Invalid secure token signature. Access denied.' }, reqId);
    }

    // Find Client and verify sender email
    if (!targetCase.clientId) {
      return sendError(res, 400, 'INVALID_REQUEST', 'MISSING_LINKED_CLIENT', { caseNumber, reason: 'Docket has no linked client.' }, reqId);
    }

    const client = await Client.findOne({ clientId: targetCase.clientId, firmId: targetCase.firmId });
    if (!client) {
      return sendError(res, 404, 'NOT_FOUND', 'CLIENT_NOT_FOUND', { clientId: targetCase.clientId, caseNumber, reason: 'Linked client not found.' }, reqId);
    }

    // Decrypt client records to retrieve plain businessEmail and compare
    const decryptedClient = await ClientRepository.findById(targetCase.firmId, client._id, 'admin');
    const clientEmails = [
      String(decryptedClient.businessEmail || '').trim().toLowerCase(),
      String(decryptedClient.contactPersonEmailAddress || '').trim().toLowerCase()
    ].filter(Boolean);

    if (!clientEmails.includes(senderEmail)) {
      return sendError(res, 403, 'FORBIDDEN', 'UNAUTHORIZED_SENDER', { senderEmail, allowedEmails: clientEmails, caseNumber, reason: 'Sender email is not authorized for this client docket.' }, reqId);
    }

    // Process attachments & Verify size
    const uploadedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      const maxSizeMB = config?.security?.upload?.maxSizeMB || 5;
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const att of attachments) {
        const filename = att.filename || att.file_name;
        const mimeType = att.mimeType || att.content_type || att.contentType || 'application/octet-stream';
        const content = att.content;
        if (!content || !filename) continue;

        // Size check
        const sizeBytes = att.size || Buffer.byteLength(content, 'base64');
        if (sizeBytes > maxSizeBytes) {
          return sendError(res, 400, 'INVALID_REQUEST', 'ATTACHMENT_TOO_LARGE', { filename, sizeBytes, maxSizeMB, reason: `Attachment "${filename}" exceeds maximum size limit of ${maxSizeMB}MB.` }, reqId);
        }

        const fileBuffer = Buffer.from(content, 'base64');
        try {
          const uploadResult = await DocketFileStorageService.uploadFile({
            file: fileBuffer,
            fileName: filename,
            fileType: mimeType,
            docketId: targetCase.caseNumber,
            firmId: targetCase.firmId,
            uploadedBy: 'CLIENT',
            uploadedByName: decryptedClient.businessName || decryptedClient.contactPersonName || 'Client Email Upload',
            source: 'email',
            description: `Received via inbound email from client (${senderEmail})`,
          });
          uploadedAttachments.push(uploadResult);
        } catch (uploadError) {
          log.error(`[INBOUND_EMAIL] Failed to upload attachment ${filename} for docket ${caseNumber}: ${uploadError.message}`);
        }
      }
    }

    // Trigger auto-reopen if pended
    const reopenResult = await reopenDocketFromClientEmail(targetCase.caseNumber, targetCase.firmId, senderEmail);

    // Create EmailCapture record
    const emailBody = rawText || rawHtml || '';
    const bodyExcerpt = String(emailBody).trim().substring(0, 1000);
    const capture = await EmailCapture.create({
      firmId: targetCase.firmId,
      tenantId: String(targetCase.firmId),
      sender: { name: senderName || decryptedClient.contactPersonName || 'Client', email: senderEmail },
      recipients: [recipientEmail],
      subject: rawSubject || 'No Subject',
      receivedAt: new Date(),
      bodyExcerpt,
      linkedClientId: decryptedClient._id,
      linkedCaseInternalId: targetCase.caseInternalId,
      linkedCaseId: targetCase.caseNumber,
      classification: 'actionable',
      ownerXID: targetCase.assignedToXID || null,
      createdByXID: 'SYSTEM',
      messageId: messageId || null,
    });

    // Create Comment listing attached files
    const attachmentNames = uploadedAttachments.map(a => a.fileName).join(', ');
    const commentText = `Received client email: "${rawSubject || 'No Subject'}" from ${senderEmail}.\n` +
      (uploadedAttachments.length > 0 ? `Attached files: ${attachmentNames}` : 'No attachments received.');

    await Comment.create({
      caseId: targetCase.caseId || targetCase.caseNumber,
      firmId: String(targetCase.firmId),
      text: commentText,
      createdBy: senderEmail,
      createdByXID: 'CLIENT',
      createdByName: decryptedClient.businessName || decryptedClient.contactPersonName || 'Client',
    });

    const processingTimeMs = Date.now() - startTime;
    log.info(`[INBOUND_EMAIL] Processed: reqId=${reqId}, sender=${senderEmail}, recipient=${recipientEmail}, case=${caseNumber}, attachments=${uploadedAttachments.length}, time=${processingTimeMs}ms`);

    return res.status(200).json({
      success: true,
      message: 'Inbound email processed successfully.',
      data: {
        reopened: reopenResult.reopened,
        attachmentsUploaded: uploadedAttachments.length,
        emailCaptureId: capture._id
      }
    });

  } catch (error) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'EXCEPTION_CAUGHT', { message: error.message, stack: error.stack, reason: 'Failed to process inbound email.' }, reqId);
  }
};

module.exports = {
  handleInboundEmail,
};
