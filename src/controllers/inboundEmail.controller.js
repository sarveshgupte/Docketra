const { createHmac, randomUUID, timingSafeEqual } = require('crypto');
const path = require('path');
const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const EmailMetadata = require('../models/EmailMetadata.model');
const User = require('../models/User.model');
const { getMimeType } = require('../utils/fileUtils');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');
const { sendEmail } = require('../services/email.service');
const { enqueueInboundEmailJob } = require('../queues/inboundEmail.queue');
const cfsDriveService = require('../services/cfsDrive.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');

/**
 * Inbound Email Controller
 * Handles webhook from email providers (SendGrid, AWS SES, etc.)
 * 
 * POST /api/inbound/email
 * 
 * Responsibilities:
 * 1. Parse incoming email data
 * 2. Resolve email to case (via unique case email address)
 * 3. Classify sender as internal or external
 * 4. Store email as attachment with proper attribution
 * 5. Store email metadata
 * 6. Trigger email-to-PDF conversion (async, non-blocking)
 */

/**
 * Handle inbound email webhook
 * POST /api/inbound/email
 */
/**
 * Parse case token from recipient format: case-{publicEmailToken}@inbound.docketra.com
 * @param {string} toAddress inbound recipient address
 * @returns {string|null} normalized public email token
 */
const parsePublicEmailTokenFromRecipient = (toAddress) => {
  const recipient = String(toAddress || '').trim().toLowerCase();
  const localPart = recipient.split('@')[0] || '';
  const match = localPart.match(/^case-([a-z0-9-]+)$/i);
  return match ? match[1].toLowerCase() : null;
};

const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.com', '.scr', '.js', '.jar', '.msi', '.sh']);
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const EMAIL_ATTACHMENT_PREFIX = 'email';

const verifyInboundSignature = (req) => {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!secret) return true;

  const providedSignature = String(req.headers['x-inbound-signature'] || '').trim();
  if (!providedSignature) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const decodeAttachmentBuffer = (attachment) => {
  if (Buffer.isBuffer(attachment?.content)) return attachment.content;
  if (attachment?.content?.type === 'Buffer' && Array.isArray(attachment.content.data)) {
    return Buffer.from(attachment.content.data);
  }
  if (typeof attachment?.contentBase64 === 'string') {
    return Buffer.from(attachment.contentBase64, 'base64');
  }
  if (typeof attachment?.content === 'string') {
    return Buffer.from(attachment.content, 'base64');
  }
  return null;
};

const sendInboundFailureEmail = async ({ to, reason }) => {
  if (!to) return;
  const safeReason = String(reason || 'Unknown error')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
  await sendEmail({
    to,
    subject: 'Email could not be attached to your case',
    text: `Your inbound email could not be attached.\nReason: ${safeReason}`,
    html: `<p>Your inbound email could not be attached.</p><p><strong>Reason:</strong> ${safeReason}</p>`,
  });
};

const processInboundEmailPayload = async (payload) => {
  const {
    to,
    from,
    fromName,
    subject,
    messageId,
    headers,
    bodyText,
    bodyHtml,
    attachments,
    receivedAt,
  } = payload;

  try {
    if (!to || !from) {
      throw new Error('Missing required fields: to, from');
    }

    const publicEmailToken = parsePublicEmailTokenFromRecipient(to);
    if (!publicEmailToken) {
      await sendInboundFailureEmail({ to: from, reason: 'Case not found' });
      throw new Error('Unable to resolve case token from recipient address');
    }

    const caseData = await Case.findOne({
      publicEmailToken,
    }).lean();

    if (!caseData) {
      await sendInboundFailureEmail({ to: from, reason: 'Case not found' });
      throw new Error('Case not found');
    }

    if (['FILED', 'Filed', 'Archived'].includes(caseData.status)) {
      await sendInboundFailureEmail({ to: from, reason: 'Case archived' });
      throw new Error('Case archived');
    }

    const normalizedFromEmail = from.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedFromEmail,
      firmId: caseData.firmId,
      isActive: true,
    });

    const isInternal = !!user;
    const visibility = isInternal ? 'internal' : 'external';
    let createdByEmail = normalizedFromEmail;
    let createdByXID = null;
    let createdByName = fromName || null;
    if (isInternal) {
      createdByXID = user.xID;
      createdByName = user.name;
    }

    const resolvedCaseId = caseData.caseId || caseData.caseNumber;
    const shouldCreateAttachment = Array.isArray(attachments) && attachments.length > 0;

    let metadataAttachmentId = null;

    if (!shouldCreateAttachment) {
      await Comment.create({
        caseId: resolvedCaseId,
        text: bodyText || subject || '(empty email body)',
        createdBy: createdByEmail,
        createdByXID,
        createdByName,
        note: `Inbound email received at ${receivedAt || new Date().toISOString()}`,
      });
    } else {
      if (!caseData.drive?.attachmentsFolderId) {
        await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
        throw new Error('Case Drive folder structure not initialized');
      }

      const provider = await getProviderForTenant(caseData.firmId);
      const targetFolderId = cfsDriveService.getFolderIdForFileType(caseData.drive, 'attachment');

      if (!targetFolderId) {
        await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
        throw new Error('Storage folder not found for inbound attachment');
      }

      for (const attachmentInput of attachments) {
        const rawName = attachmentInput?.filename || attachmentInput?.name || 'attachment.bin';
        const safeName = path.basename(rawName);
        const ext = path.extname(safeName).toLowerCase();
        const buffer = decodeAttachmentBuffer(attachmentInput);
        const size = Number(attachmentInput?.size) || (buffer ? buffer.length : 0);

        if (BLOCKED_EXTENSIONS.has(ext)) {
          console.warn('[InboundEmail] Suspicious attachment blocked', { filename: safeName, from: normalizedFromEmail });
          await sendInboundFailureEmail({ to: from, reason: 'Unsupported file type' });
          throw new Error(`Blocked executable attachment: ${safeName}`);
        }

        if (!buffer || !size) {
          console.warn('[InboundEmail] Skipping attachment with missing content', { filename: safeName, from: normalizedFromEmail });
          continue;
        }

        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
          await sendInboundFailureEmail({ to: from, reason: 'Attachment too large' });
          throw new Error(`Attachment too large: ${safeName}`);
        }

        const storedName = `${randomUUID()}-${safeName}`;
        const mimeType = getMimeType(safeName);
        const uploadResult = await provider.uploadFile(
          caseData.firmId,
          targetFolderId,
          buffer,
          { name: `${EMAIL_ATTACHMENT_PREFIX}/${storedName}`, mimeType }
        );

        const attachmentRecord = await Attachment.create({
          caseId: resolvedCaseId,
          firmId: caseData.firmId,
          fileName: safeName,
          driveFileId: uploadResult.fileId || uploadResult.id,
          size,
          mimeType,
          description: 'Inbound email attachment',
          createdBy: createdByEmail,
          createdByXID,
          createdByName,
          type: 'email_native',
          source: 'email',
          visibility,
          note: `Email attachment received at ${receivedAt || new Date().toISOString()}`,
        });
        if (!metadataAttachmentId) {
          metadataAttachmentId = attachmentRecord._id;
        }
      }
    }

    if (metadataAttachmentId) {
      await EmailMetadata.create({
        attachmentId: metadataAttachmentId,
        fromEmail: normalizedFromEmail,
        fromName: fromName || null,
        subject: subject || null,
        messageId: messageId || null,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        headers: headers || null,
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
      });
    }

    await sendEmail({
      to: normalizedFromEmail,
      subject: `Email successfully attached to Case ${caseData.caseNumber || caseData.caseId}`,
      text: `Your email and attachments were successfully added to:\nCase: ${caseData.title}\nReference: ${caseData.caseNumber || caseData.caseId}\nTime: ${new Date().toISOString()}`,
      html: `<p>Your email and attachments were successfully added to:</p><p><strong>Case:</strong> ${caseData.title}<br /><strong>Reference:</strong> ${caseData.caseNumber || caseData.caseId}<br /><strong>Time:</strong> ${new Date().toISOString()}</p>`,
    });

    return {
      success: true,
      caseId: resolvedCaseId,
      classification: visibility,
    };
  } catch (error) {
    console.error('[processInboundEmailPayload] Error:', error);
    throw error;
  }
};

const handleInboundEmail = async (req, res) => {
  if (!verifyInboundSignature(req)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid inbound signature',
    });
  }

  if (!req.body?.to || !req.body?.from) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: to, from',
    });
  }

  await enqueueInboundEmailJob(req.body);
  return res.status(200).json({
    success: true,
    message: 'Inbound email accepted for processing',
  });
};

module.exports = {
  parsePublicEmailTokenFromRecipient,
  processInboundEmailPayload,
  handleInboundEmail: wrapWriteHandler(handleInboundEmail),
};
