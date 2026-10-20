const log = require('../utils/log');
const {
  verifyWebhookHandshake,
  verifySignature,
  extractIncomingMedia,
  processIncomingMediaItem,
} = require('../services/whatsappIngestion.service');

/**
 * GET /api/webhooks/whatsapp
 * Meta verification handshake for WhatsApp Cloud API.
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const { valid, challenge: responseChallenge } = verifyWebhookHandshake({
    mode,
    token,
    challenge,
  });

  if (valid) {
    log.info('WHATSAPP_WEBHOOK_VERIFIED', { mode });
    return res.status(200).send(responseChallenge);
  }

  log.warn('WHATSAPP_WEBHOOK_VERIFY_FAILED', { mode, tokenReceived: Boolean(token) });
  return res.status(403).json({ success: false, message: 'Forbidden: Verification token mismatch' });
}

/**
 * POST /api/webhooks/whatsapp
 * Inbound event receiver for incoming WhatsApp messages and document attachments.
 */
async function handleWebhook(req, res) {
  const signature = req.headers['x-hub-signature-256'];
  const isSignatureValid = verifySignature({
    rawBody: req.rawBody || req.body,
    signatureHeader: signature,
  });

  if (!isSignatureValid) {
    log.warn('WHATSAPP_WEBHOOK_SIGNATURE_INVALID');
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid signature' });
  }

  // Meta requires a prompt 200 OK response within 5 seconds to avoid retries
  const payload = req.body;
  const items = extractIncomingMedia(payload);

  if (!items || items.length === 0) {
    return res.status(200).json({ success: true, processed: 0 });
  }

  // Process items in background without blocking Meta's response
  const results = [];
  for (const item of items) {
    try {
      const result = await processIncomingMediaItem(item);
      results.push(result);
    } catch (err) {
      log.error('WHATSAPP_INGESTION_ITEM_ERROR', { error: err.message, sender: item.senderPhone });
      results.push({ success: false, error: err.message });
    }
  }

  return res.status(200).json({ success: true, processed: items.length, results });
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};
