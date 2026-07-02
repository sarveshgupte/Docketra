const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Comment = require('../models/Comment.model');
const EmailCapture = require('../models/EmailCapture.model');
const Attachment = require('../models/Attachment.model');
const ClientRepository = require('../repositories/ClientRepository');
const DocketFileStorageService = require('../services/docketFileStorage.service');
const { reopenDocketFromClientEmail, generateDocketEmailSignature } = require('../services/docketWorkflow.service');
const log = require('../utils/log');

const handleInboundEmail = async (req, res) => {
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
      // TODO: REMOVE AFTER CLOUDMAILIN DEBUGGING
      return res.status(400).json({
        success: false,
        error: "REQUIRED_FIELDS_MISSING",
        details: {
          from: rawFrom || null,
          to: rawTo || null,
          resolvedRecipient: null,
          caseNumber: null,
          signature: null,
          reason: "From and To fields are required."
        }
      });
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
      log.warn(`[INBOUND_EMAIL] Invalid recipient format: ${recipientEmail}`);
      // TODO: REMOVE AFTER CLOUDMAILIN DEBUGGING
      return res.status(400).json({
        success: false,
        error: "INVALID_RECIPIENT_FORMAT",
        details: {
          from: senderEmail,
          to: rawTo,
          resolvedRecipient: recipientEmail,
          caseNumber: null,
          signature: null,
          reason: "Invalid recipient format. Must be docket-<caseNumber>-<signature>@domain."
        }
      });
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
      log.warn(`[INBOUND_EMAIL] Docket ${caseNumber} not found.`);
      return res.status(404).json({ success: false, message: `Docket ${caseNumber} not found.` });
    }

    // Verify cryptographic signature token
    const expectedSignature = generateDocketEmailSignature(targetCase.caseInternalId);
    if (providedSignature !== expectedSignature) {
      log.warn(`[INBOUND_EMAIL] Invalid signature token for docket ${caseNumber}. Provided: ${providedSignature}, Expected: ${expectedSignature}`);
      return res.status(403).json({ success: false, message: 'Invalid secure token signature. Access denied.' });
    }

    // Find Client and verify sender email
    if (!targetCase.clientId) {
      log.warn(`[INBOUND_EMAIL] Docket ${caseNumber} has no linked client.`);
      // TODO: REMOVE AFTER CLOUDMAILIN DEBUGGING
      return res.status(400).json({
        success: false,
        error: "MISSING_LINKED_CLIENT",
        details: {
          from: senderEmail,
          to: rawTo,
          resolvedRecipient: recipientEmail,
          caseNumber: caseNumber,
          signature: providedSignature,
          reason: "Docket has no linked client."
        }
      });
    }

    const client = await Client.findOne({ clientId: targetCase.clientId, firmId: targetCase.firmId });
    if (!client) {
      log.warn(`[INBOUND_EMAIL] Linked client ${targetCase.clientId} not found for docket ${caseNumber}.`);
      return res.status(404).json({ success: false, message: 'Linked client not found.' });
    }

    // Decrypt client records to retrieve plain businessEmail and compare
    const decryptedClient = await ClientRepository.findById(targetCase.firmId, client._id, 'admin');
    const clientEmails = [
      String(decryptedClient.businessEmail || '').trim().toLowerCase(),
      String(decryptedClient.contactPersonEmailAddress || '').trim().toLowerCase()
    ].filter(Boolean);

    if (!clientEmails.includes(senderEmail)) {
      log.warn(`[INBOUND_EMAIL] Sender email ${senderEmail} is not authorized for client ${decryptedClient.clientId} of docket ${caseNumber}.`);
      return res.status(403).json({ success: false, message: 'Sender email is not authorized for this client docket.' });
    }

    // Process attachments
    const uploadedAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        const filename = att.filename || att.file_name;
        const mimeType = att.mimeType || att.content_type || att.contentType || 'application/octet-stream';
        const content = att.content;
        if (!content || !filename) continue;
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
    log.error(`[INBOUND_EMAIL_ERROR] ${error.stack || error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to process inbound email.' });
  }
};

module.exports = {
  handleInboundEmail,
};
