const { createHash, createHmac, randomUUID, timingSafeEqual } = require('crypto');
const path = require('path');
const { getRedisClient } = require('../config/redis');
const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const Attachment = require('../models/Attachment.model');
const EmailThread = require('../models/EmailThread.model');
const User = require('../models/User.model');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { getMimeType } = require('../utils/fileUtils');
const { getProviderForTenant } = require('../storage/StorageProviderFactory');
const { sendEmail } = require('../services/email.service');
const { enqueueInboundEmailJob } = require('../queues/inboundEmail.queue');
const cfsDriveService = require('../services/cfsDrive.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { compressBuffer } = require('../utils/compressBuffer');
const { updateTenantStorageUsage } = require('../utils/updateTenantStorageUsage');

/**
 * Inbound Email Controller
 * Handles webhook from email providers (SendGrid, AWS SES, etc.)
 *
 * POST /api/inbound/email
 */

/**
 * Parse case token from recipient format: case-{publicEmailToken}@inbound.docketra.com
 * @param {string} toAddress inbound recipient address
 * @returns {string|null} normalized public email token
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const parsePublicEmailTokenFromRecipient = (toAddress) => {
  const recipient = String(toAddress || '').trim().toLowerCase();
  const localPart = recipient.split('@')[0] || '';
  const match = localPart.match(/^case-([a-z0-9-]+)$/i);
  if (!match) return null;
  const token = match[1].toLowerCase();
  return UUID_V4_REGEX.test(token) ? token : null;
};

const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.com', '.scr', '.js', '.jar', '.msi', '.sh']);
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const EMAIL_ATTACHMENT_PREFIX = 'email';
const INBOUND_SIGNATURE_TOLERANCE_SECONDS = Number(process.env.INBOUND_EMAIL_WEBHOOK_MAX_SKEW_SECONDS || 300);
const replayCache = new Map();
const MAX_INBOUND_REPLAY_CACHE_ENTRIES = Number(process.env.INBOUND_EMAIL_REPLAY_CACHE_MAX || 10000);
let insecureWebhookWarningLogged = false;
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function createInboundError(message, { unrecoverable = false, reason = null } = {}) {
  const error = new Error(message);
  error.unrecoverable = unrecoverable;
  error.failureReason = reason || message;
  return error;
}

const toInboundTimestamp = (headerValue) => {
  const parsed = Number(String(headerValue || '').trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
};

const hasValidInboundTimestamp = (reqHeaders = {}) => {
  const inboundTimestamp = toInboundTimestamp(
    reqHeaders['x-inbound-timestamp'] || reqHeaders['x-inbound-request-timestamp']
  );
  if (!inboundTimestamp) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - inboundTimestamp) <= INBOUND_SIGNATURE_TOLERANCE_SECONDS;
};

const createReplayCacheKey = (reqHeaders = {}) => {
  const timestamp = String(reqHeaders['x-inbound-timestamp'] || reqHeaders['x-inbound-request-timestamp'] || '').trim();
  const signature = String(reqHeaders['x-inbound-signature'] || '').trim().toLowerCase();
  if (!timestamp || !signature) return null;
  return createHash('sha256').update(`${timestamp}:${signature}`).digest('hex');
};

const rememberInboundReplay = async (reqHeaders = {}) => {
  const replayKey = createReplayCacheKey(reqHeaders);
  if (!replayKey) return false;

  const ttlSeconds = Math.max(INBOUND_SIGNATURE_TOLERANCE_SECONDS, 60);
  const redis = getRedisClient();
  if (redis) {
    const redisKey = `security:inbound:replay:${replayKey}`;
    const result = await redis.set(redisKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  const expiresAt = Date.now() + ttlSeconds * 1000;
  const current = replayCache.get(replayKey);
  if (current && current > Date.now()) {
    return false;
  }
  replayCache.set(replayKey, expiresAt);
  for (const [key, value] of replayCache.entries()) {
    if (value <= Date.now()) replayCache.delete(key);
  }
  while (replayCache.size > MAX_INBOUND_REPLAY_CACHE_ENTRIES) {
    const [oldestKey] = replayCache.keys();
    if (!oldestKey) break;
    replayCache.delete(oldestKey);
  }
  return true;
};

const verifyInboundSignature = (rawBody, reqHeaders = {}) => {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== 'production' && !insecureWebhookWarningLogged) {
      console.warn('[inboundEmail] INBOUND_EMAIL_WEBHOOK_SECRET is not configured; signature verification is disabled');
      insecureWebhookWarningLogged = true;
    }
    return process.env.NODE_ENV !== 'production';
  }

  const providedSignature = String(reqHeaders['x-inbound-signature'] || '').trim().replace(/^sha256=/i, '');
  if (!providedSignature) return false;
  if (!hasValidInboundTimestamp(reqHeaders)) return false;

  const timestamp = String(reqHeaders['x-inbound-timestamp'] || reqHeaders['x-inbound-request-timestamp']).trim();
  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
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

  let caseData = null;
  let emailThread = null;
  const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;
  const sender = String(from || '').trim().toLowerCase();

  try {
    if (!to || !from) {
      throw createInboundError('Missing required fields: to, from', { unrecoverable: true, reason: 'Invalid payload' });
    }

    const publicEmailToken = parsePublicEmailTokenFromRecipient(to);
    if (!publicEmailToken) {
      await sendInboundFailureEmail({ to: from, reason: 'Invalid token' });
      throw createInboundError('Invalid public email token', { unrecoverable: true, reason: 'Invalid token' });
    }

    caseData = await Case.findOne({
      publicEmailToken,
    }).lean();

    if (!caseData) {
      await sendInboundFailureEmail({ to: from, reason: 'Case not found' });
      throw createInboundError('Case not found', { unrecoverable: true, reason: 'Case not found' });
    }

    if (['FILED', 'Filed', 'Archived'].includes(caseData.status)) {
      await sendInboundFailureEmail({ to: from, reason: 'Case archived' });
      throw createInboundError('Case archived', { unrecoverable: true, reason: 'Case archived' });
    }

    const normalizedFromEmail = from.toLowerCase().trim();
    const user = await User.findOne({
      email: normalizedFromEmail,
      firmId: caseData.firmId,
      isActive: true,
    });

    const isInternal = !!user;
    const visibility = isInternal ? 'internal' : 'external';
    const createdByEmail = normalizedFromEmail;
    let createdByXID = null;
    let createdByName = fromName || null;
    if (isInternal) {
      createdByXID = user.xID;
      createdByName = user.name;
    }

    const resolvedCaseId = caseData.caseId || caseData.caseNumber;
    const shouldCreateAttachment = Array.isArray(attachments) && attachments.length > 0;
    const skippedFiles = [];
    let processedAttachments = 0;

    emailThread = await EmailThread.create({
      tenantId: caseData.firmId,
      caseId: resolvedCaseId,
      fromEmail: normalizedFromEmail,
      fromName: fromName || null,
      subject: subject || null,
      messageId: messageId || null,
      bodyText: bodyText || null,
      bodyHtml: bodyHtml || null,
      headers: headers || null,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    });

    const tenantConfig = await TenantStorageConfig.findOne({
      tenantId: caseData.firmId,
      isActive: true,
      status: 'ACTIVE',
    }).lean();

    if (!tenantConfig) {
      await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
      throw createInboundError('Storage configuration missing', {
        unrecoverable: true,
        reason: 'Storage misconfiguration',
      });
    }

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
        throw createInboundError('Case Drive folder structure not initialized', {
          unrecoverable: true,
          reason: 'Storage misconfiguration',
        });
      }

      let provider;
      try {
        provider = await getProviderForTenant(caseData.firmId);
      } catch (error) {
        if (error?.code === 'STORAGE_CONFIG_MISSING') {
          await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
          throw createInboundError(error.message, { unrecoverable: true, reason: 'Storage misconfiguration' });
        }
        throw error;
      }

      if (!provider || typeof provider.uploadFile !== 'function') {
        await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
        throw createInboundError('Invalid storage provider configuration', {
          unrecoverable: true,
          reason: 'Storage misconfiguration',
        });
      }

      const targetFolderId = cfsDriveService.getFolderIdForFileType(caseData.drive, 'attachment');

      if (!targetFolderId) {
        await sendInboundFailureEmail({ to: from, reason: 'Storage misconfiguration' });
        throw createInboundError('Storage folder not found for inbound attachment', {
          unrecoverable: true,
          reason: 'Storage misconfiguration',
        });
      }

      for (const attachmentInput of attachments) {
        const rawName = attachmentInput?.filename || attachmentInput?.name || 'attachment.bin';
        const safeName = path.basename(rawName);
        const ext = path.extname(safeName).toLowerCase();
        const buffer = decodeAttachmentBuffer(attachmentInput);
        const size = Number(attachmentInput?.size) || (buffer ? buffer.length : 0);

        if (BLOCKED_EXTENSIONS.has(ext)) {
          await sendInboundFailureEmail({ to: from, reason: 'Unsupported file type' });
          throw createInboundError(`Blocked executable attachment: ${safeName}`, {
            unrecoverable: true,
            reason: 'Unsupported file type',
          });
        }

        if (!buffer || !size) {
          skippedFiles.push(safeName);
          continue;
        }

        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
          await sendInboundFailureEmail({ to: from, reason: 'Attachment too large' });
          throw createInboundError(`Attachment too large: ${safeName}`, {
            unrecoverable: true,
            reason: 'Attachment too large',
          });
        }

        const storedName = `${randomUUID()}-${safeName}`;
        const mimeType = getMimeType(safeName);
        let uploadBuffer = buffer;
        let compressed = false;
        let originalSize = size;
        let finalSize = size;

        if (tenantConfig.compressionEnabled !== false) {
          const compressionResult = await compressBuffer(buffer, mimeType, tenantConfig.compressionLevel);
          uploadBuffer = compressionResult.buffer;
          compressed = compressionResult.wasCompressed;
          originalSize = compressionResult.originalSize;
          finalSize = compressionResult.compressedSize;
        }
        const contentHash = createHash('sha256').update(uploadBuffer).digest('hex');
        let uploadFileId = null;
        let isDuplicate = false;
        const existing = await Attachment.findOne({
          firmId: caseData.firmId,
          contentHash,
          isDuplicate: false,
        }).lean();

        if (existing?.driveFileId) {
          uploadFileId = existing.driveFileId;
          isDuplicate = true;
          compressed = false;
          originalSize = finalSize;
        } else {
          const uploadResult = await provider.uploadFile(
            caseData.firmId,
            targetFolderId,
            uploadBuffer,
            { name: `${EMAIL_ATTACHMENT_PREFIX}/${storedName}`, mimeType }
          );
          uploadFileId = uploadResult.fileId || uploadResult.id;
          await updateTenantStorageUsage(caseData.firmId, finalSize);
        }

        console.info('[AttachmentDedup]', {
          firmId: caseData.firmId,
          caseId: resolvedCaseId,
          contentHash,
          isDuplicate,
        });
        // TODO: In future, support reference counting if deleting duplicate attachments.

        await Attachment.create({
          caseId: resolvedCaseId,
          firmId: caseData.firmId,
          fileName: safeName,
          driveFileId: uploadFileId,
          storageProvider: 'google-drive',
          storageFileId: uploadFileId,
          size: finalSize,
          mimeType,
          description: 'Inbound email attachment',
          createdBy: createdByEmail,
          createdByXID,
          createdByName,
          type: 'email_native',
          source: 'email',
          visibility,
          emailThreadId: emailThread._id,
          checksum: contentHash,
          contentHash,
          isDuplicate,
          compressed,
          originalSize,
          finalSize,
          note: `Email attachment received at ${receivedAt || new Date().toISOString()}`,
        });
        processedAttachments += 1;
      }
    }

    console.info('[InboundEmail] Processed email context', {
      caseId: resolvedCaseId,
      firmId: caseData.firmId,
      emailThreadId: emailThread?._id?.toString(),
      attachmentCount,
      sender: normalizedFromEmail,
    });

    const timestamp = new Date().toISOString();
    const caseTitle = String(caseData.title || '').replace(/[\r\n]/g, ' ').trim();
    const safeCaseTitleHtml = escapeHtml(caseTitle);
    await sendEmail({
      to: normalizedFromEmail,
      subject: `Email successfully attached to Case ${caseData.caseNumber || caseData.caseId}`,
      text: `Your email was successfully processed.\nCase: ${caseTitle}\nReference: ${caseData.caseNumber || caseData.caseId}\nAttachments processed: ${processedAttachments}\nSkipped files: ${skippedFiles.length ? skippedFiles.join(', ') : 'None'}\nTime: ${timestamp}`,
      html: `<p>Your email was successfully processed.</p><p><strong>Case:</strong> ${safeCaseTitleHtml}<br /><strong>Reference:</strong> ${caseData.caseNumber || caseData.caseId}<br /><strong>Attachments processed:</strong> ${processedAttachments}<br /><strong>Skipped files:</strong> ${skippedFiles.length ? skippedFiles.join(', ') : 'None'}<br /><strong>Time:</strong> ${timestamp}</p>`,
    });

    return {
      success: true,
      caseId: resolvedCaseId,
      classification: visibility,
      emailThreadId: emailThread?._id,
      attachmentCount: processedAttachments,
    };
  } catch (error) {
    console.error('[processInboundEmailPayload] Error', {
      caseId: caseData?.caseId || caseData?.caseNumber || null,
      firmId: caseData?.firmId || null,
      emailThreadId: emailThread?._id?.toString() || null,
      attachmentCount,
      sender,
      message: error.message,
    });
    throw error;
  }
};

const parseInboundBody = (body) => {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  return Buffer.from(JSON.stringify(body || {}));
};

const handleInboundEmail = async (req, res) => {
  const rawBody = parseInboundBody(req.body);

  if (!verifyInboundSignature(rawBody, req.headers || {})) {
    return res.status(401).json({
      success: false,
      message: 'Invalid inbound signature',
    });
  }
  if (process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    const replayAccepted = await rememberInboundReplay(req.headers || {});
    if (!replayAccepted) {
      return res.status(401).json({
        success: false,
        message: 'Invalid inbound signature',
      });
    }
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(rawBody.toString('utf8'));
  } catch (_) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
    });
  }

  if (!parsedBody?.to || !parsedBody?.from) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: to, from',
    });
  }

  await enqueueInboundEmailJob(parsedBody);
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
