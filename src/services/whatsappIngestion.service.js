const crypto = require('crypto');
const log = require('../utils/log');

/**
 * Normalizes any Indian/international phone number into standard comparison formats:
 * - 12-digit format with country code: '919820012345'
 * - 10-digit local format: '9820012345'
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return { full: '', local: '' };
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return { full: '', local: '' };

  let full = digits;
  let local = digits;

  if (digits.length === 10) {
    full = `91${digits}`;
    local = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    full = `91${digits.slice(1)}`;
    local = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    full = digits;
    local = digits.slice(2);
  } else if (digits.length > 10) {
    local = digits.slice(-10);
  }

  return { full, local };
}

/**
 * Verifies Meta's GET verification handshake:
 * hub.mode === 'subscribe'
 * hub.verify_token === WHATSAPP_VERIFY_TOKEN
 */
function verifyWebhookHandshake({ mode, token, challenge, expectedToken }) {
  const secretToken = expectedToken || process.env.WHATSAPP_VERIFY_TOKEN;
  if (!secretToken) {
    log.warn('WHATSAPP_HANDSHAKE_FAILED_NO_SECRET_TOKEN');
    return { valid: false, challenge: null };
  }
  if (mode === 'subscribe' && token === secretToken) {
    return { valid: true, challenge };
  }
  return { valid: false, challenge: null };
}

/**
 * Verifies Meta's HMAC-SHA256 signature on POST webhooks (X-Hub-Signature-256).
 */
function verifySignature({ rawBody, signatureHeader, appSecret }) {
  const secret = appSecret || process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    log.warn('WHATSAPP_SIGNATURE_VERIFY_FAILED_NO_SECRET');
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7);
  const hmac = crypto.createHmac('sha256', secret);
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');
  hmac.update(bodyBuffer);
  const calculatedSignature = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Parses and extracts incoming media messages (documents, images, audio) from Meta Cloud API payload.
 */
function extractIncomingMedia(payload) {
  const items = [];
  if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
    return items;
  }

  for (const entry of payload.entry) {
    if (!entry.changes || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      const value = change.value;
      if (!value || !value.messages || !Array.isArray(value.messages)) continue;

      const contactName = value.contacts?.[0]?.profile?.name || null;
      const businessPhoneNumberId = value.metadata?.phone_number_id || null;

      for (const msg of value.messages) {
        const senderPhone = msg.from;
        const msgId = msg.id;
        const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();
        const type = msg.type;

        let mediaData = null;
        let caption = '';

        if (type === 'document' && msg.document) {
          mediaData = {
            id: msg.document.id,
            filename: msg.document.filename || `Document_${msg.document.id}.pdf`,
            mimeType: msg.document.mime_type || 'application/pdf',
            sha256: msg.document.sha256 || null,
          };
          caption = msg.document.caption || '';
        } else if (type === 'image' && msg.image) {
          mediaData = {
            id: msg.image.id,
            filename: `Image_${msg.image.id}.jpg`,
            mimeType: msg.image.mime_type || 'image/jpeg',
            sha256: msg.image.sha256 || null,
          };
          caption = msg.image.caption || '';
        } else if (type === 'text' && msg.text) {
          caption = msg.text.body || '';
        }

        items.push({
          msgId,
          senderPhone,
          contactName,
          businessPhoneNumberId,
          timestamp,
          type,
          mediaData,
          caption,
        });
      }
    }
  }

  return items;
}

/**
 * Formats a clean, polite WhatsApp confirmation message for the client.
 */
function buildConfirmationMessage({ clientName, docketTitle, fileName, firmName }) {
  const greeting = clientName ? `Namaste ${clientName},` : 'Namaste,';
  const fileText = fileName ? `*${fileName}*` : 'your document';
  const matterText = docketTitle ? `*${docketTitle}*` : 'your active compliance matter';
  const firmSignoff = firmName ? `\n\nRegards,\n*${firmName}*` : '';

  return `${greeting}\n\n✓ Received ${fileText}.\nIt has been securely uploaded and filed under ${matterText} in the firm's Google Drive archive.${firmSignoff}`;
}

/**
 * Dispatches an outbound WhatsApp notification using Meta Cloud API.
 */
async function sendWhatsAppMessage({ to, text, phoneNumberId, accessToken }) {
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    log.info('WHATSAPP_OUTBOUND_SKIPPED_NO_CREDENTIALS', { to, textSnippet: text.slice(0, 50) });
    return { success: false, reason: 'MISSING_WHATSAPP_CREDENTIALS' };
  }

  const cleanPhone = String(to).replace(/\D/g, '');
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: text },
      }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    log.error('WHATSAPP_OUTBOUND_FAILED', { error: error.message, to });
    return { success: false, error: error.message };
  }
}

/**
 * Matches client and active docket based on sender phone and optional caption text.
 */
async function resolveClientAndDocket({ senderPhone, caption = '', firmId = null }) {
  const { full, local } = normalizePhoneNumber(senderPhone);
  if (!full) return { client: null, targetCase: null, allOpenCases: [] };

  const Client = require('../models/Client.model');
  const Case = require('../models/Case.model');

  const query = {
    $or: [
      { primaryContactNumber: { $in: [full, local] } },
      { secondaryContactNumber: { $in: [full, local] } },
      { phone: { $in: [full, local] } },
      { 'contacts.phone': { $in: [full, local] } },
    ],
    status: { $ne: 'deleted' },
  };

  if (firmId) {
    query.firmId = firmId;
  }

  let client = null;
  if (firmId) {
    client = await Client.findOne(query).select('clientId firmId name businessEmail primaryContactNumber');
  } else {
    // Defend against ambiguous cross-tenant resolution if the phone number exists in multiple firms
    const candidateClients = await Client.find(query).select('clientId firmId name businessEmail primaryContactNumber').limit(2);
    if (candidateClients.length > 1) {
      log.warn('WHATSAPP_INGESTION_AMBIGUOUS_MULTI_TENANT_PHONE', {
        matchCount: candidateClients.length,
        senderPhone,
      });
      return { client: null, targetCase: null, allOpenCases: [] };
    }
    client = candidateClients[0] || null;
  }

  if (!client) {
    return { client: null, targetCase: null, allOpenCases: [] };
  }

  // Look for docket ID or number inside caption (e.g. #DOK-104 or 104)
  const caseQuery = {
    firmId: client.firmId,
    clientId: client.clientId,
    status: { $in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'DRAFT'] },
  };

  const openCases = await Case.find(caseQuery).sort({ updatedAt: -1 }).limit(5);

  let targetCase = null;
  if (caption) {
    const docketMatch = caption.match(/(?:#?DOK-?|case\s*#?|docket\s*#?)(\d+)/i);
    if (docketMatch) {
      const parsedNumber = docketMatch[1];
      targetCase = openCases.find((c) => String(c.caseNumber || c.caseId).includes(parsedNumber)) || null;
    }
  }

  if (!targetCase && openCases.length === 1) {
    targetCase = openCases[0];
  } else if (!targetCase && openCases.length > 0) {
    // Default to most recently active docket
    targetCase = openCases[0];
  }

  return { client, targetCase, allOpenCases: openCases };
}

/**
 * Complete processor for an incoming WhatsApp media item:
 * Resolves client -> attaches file metadata -> writes comment -> optionally sends confirmation.
 */
async function processIncomingMediaItem(item, options = {}) {
  const { senderPhone, mediaData, caption, contactName } = item;
  if (!mediaData) {
    return { success: false, reason: 'NO_MEDIA_ATTACHMENT' };
  }

  const { client, targetCase } = await resolveClientAndDocket({
    senderPhone,
    caption,
    firmId: options.firmId || null,
  });

  if (!client || !targetCase) {
    log.info('WHATSAPP_INGESTION_UNMATCHED', { senderPhone, contactName, mediaName: mediaData.filename });
    return {
      success: true,
      status: 'UNMATCHED_CLIENT_OR_DOCKET',
      senderPhone,
      fileName: mediaData.filename,
    };
  }

  const CaseFile = require('../models/CaseFile.model');
  const Comment = require('../models/Comment.model');

  // Create CaseFile record
  const caseFile = await CaseFile.create({
    caseId: targetCase.caseId || targetCase.caseNumber,
    firmId: client.firmId,
    fileName: mediaData.filename,
    fileType: mediaData.mimeType,
    fileSize: 0, // Pending download/streaming
    source: 'WHATSAPP_INGESTION',
    uploadedBy: 'CLIENT_WHATSAPP',
    uploaderContact: senderPhone,
    status: 'ready',
    metadata: {
      whatsAppMediaId: mediaData.id,
      whatsAppSenderName: contactName || client.name,
      whatsAppCaption: caption || null,
      sha256: mediaData.sha256,
    },
  });

  // Log on Docket audit activity trail
  await Comment.create({
    caseId: targetCase.caseId || targetCase.caseNumber,
    firmId: client.firmId,
    text: `[WhatsApp Auto-Ingestion] Received file "${mediaData.filename}" from ${contactName || client.name} (${senderPhone}). Saved to docket.`,
    createdBy: 'system@docketra.in',
    createdByName: 'Docketra WhatsApp Bridge',
  });

  // Send polite WhatsApp receipt confirmation
  const confirmationText = buildConfirmationMessage({
    clientName: contactName || client.name,
    docketTitle: targetCase.title || `Docket #${targetCase.caseNumber || targetCase.caseId}`,
    fileName: mediaData.filename,
    firmName: options.firmName || 'Your Compliance Firm',
  });

  await sendWhatsAppMessage({
    to: senderPhone,
    text: confirmationText,
    phoneNumberId: item.businessPhoneNumberId,
  });

  return {
    success: true,
    status: 'AUTO_FILED',
    fileId: caseFile._id,
    caseId: targetCase.caseId || targetCase.caseNumber,
    clientId: client.clientId,
  };
}

module.exports = {
  normalizePhoneNumber,
  verifyWebhookHandshake,
  verifySignature,
  extractIncomingMedia,
  buildConfirmationMessage,
  sendWhatsAppMessage,
  resolveClientAndDocket,
  processIncomingMediaItem,
};
