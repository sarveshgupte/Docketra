const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const {
  normalizePhoneNumber,
  verifyWebhookHandshake,
  verifySignature,
  extractIncomingMedia,
  buildConfirmationMessage,
} = require('../src/services/whatsappIngestion.service');

test('WhatsApp Ingestion - Phone Number Normalization', () => {
  // Standard 10-digit Indian mobile
  const r1 = normalizePhoneNumber('9820012345');
  assert.strictEqual(r1.full, '919820012345');
  assert.strictEqual(r1.local, '9820012345');

  // With spaces and hyphens
  const r2 = normalizePhoneNumber('+91 98200-12345');
  assert.strictEqual(r2.full, '919820012345');
  assert.strictEqual(r2.local, '9820012345');

  // 11-digit with leading 0
  const r3 = normalizePhoneNumber('09820012345');
  assert.strictEqual(r3.full, '919820012345');
  assert.strictEqual(r3.local, '9820012345');

  // Already 12-digit with 91
  const r4 = normalizePhoneNumber('919820012345');
  assert.strictEqual(r4.full, '919820012345');
  assert.strictEqual(r4.local, '9820012345');

  // Empty or invalid input
  const r5 = normalizePhoneNumber('');
  assert.strictEqual(r5.full, '');
  assert.strictEqual(r5.local, '');
});

test('WhatsApp Ingestion - Verification Handshake (GET)', () => {
  const expectedToken = 'test_webhook_secret_123';

  // Valid subscribe handshake
  const validResult = verifyWebhookHandshake({
    mode: 'subscribe',
    token: 'test_webhook_secret_123',
    challenge: 'challenge_code_999',
    expectedToken,
  });
  assert.strictEqual(validResult.valid, true);
  assert.strictEqual(validResult.challenge, 'challenge_code_999');

  // Invalid token
  const invalidTokenResult = verifyWebhookHandshake({
    mode: 'subscribe',
    token: 'wrong_secret',
    challenge: 'challenge_code_999',
    expectedToken,
  });
  assert.strictEqual(invalidTokenResult.valid, false);
  assert.strictEqual(invalidTokenResult.challenge, null);

  // Wrong mode
  const wrongModeResult = verifyWebhookHandshake({
    mode: 'unsubscribe',
    token: 'test_webhook_secret_123',
    challenge: 'challenge_code_999',
    expectedToken,
  });
  assert.strictEqual(wrongModeResult.valid, false);
});

test('WhatsApp Ingestion - HMAC-SHA256 Signature Verification (POST)', () => {
  const appSecret = 'meta_app_secret_test_key_456';
  const rawBody = JSON.stringify({ object: 'whatsapp_business_account', test: true });

  // Generate valid signature
  const validHmac = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const validHeader = `sha256=${validHmac}`;

  assert.strictEqual(
    verifySignature({ rawBody, signatureHeader: validHeader, appSecret }),
    true
  );

  // Tampered payload
  const tamperedBody = JSON.stringify({ object: 'whatsapp_business_account', test: false });
  assert.strictEqual(
    verifySignature({ rawBody: tamperedBody, signatureHeader: validHeader, appSecret }),
    false
  );

  // Missing or malformed header
  assert.strictEqual(
    verifySignature({ rawBody, signatureHeader: 'invalid_format', appSecret }),
    false
  );
  assert.strictEqual(
    verifySignature({ rawBody, signatureHeader: '', appSecret }),
    false
  );
});

test('WhatsApp Ingestion - Extract Incoming Media Items from Meta Webhook Payload', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_12345',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550234567',
                phone_number_id: 'PNID_888',
              },
              contacts: [
                {
                  profile: { name: 'Ramesh Sharma' },
                  wa_id: '919820012345',
                },
              ],
              messages: [
                {
                  from: '919820012345',
                  id: 'wamid.HBgLMOTE5ODIwMDEyMzQ1',
                  timestamp: '1715421000',
                  type: 'document',
                  document: {
                    filename: 'HDFC_Bank_Statement.pdf',
                    mime_type: 'application/pdf',
                    sha256: 'hash123',
                    id: 'MEDIA_ID_DOC_1',
                  },
                },
                {
                  from: '919820012345',
                  id: 'wamid.HBgLMOTE5ODIwMDEyMzQ2',
                  timestamp: '1715421050',
                  type: 'image',
                  image: {
                    caption: 'Challan for GST May',
                    mime_type: 'image/jpeg',
                    sha256: 'hash456',
                    id: 'MEDIA_ID_IMG_2',
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const items = extractIncomingMedia(payload);
  assert.strictEqual(items.length, 2);

  // Item 1: Document
  assert.strictEqual(items[0].type, 'document');
  assert.strictEqual(items[0].senderPhone, '919820012345');
  assert.strictEqual(items[0].contactName, 'Ramesh Sharma');
  assert.strictEqual(items[0].mediaData.filename, 'HDFC_Bank_Statement.pdf');
  assert.strictEqual(items[0].mediaData.mimeType, 'application/pdf');
  assert.strictEqual(items[0].mediaData.id, 'MEDIA_ID_DOC_1');
  assert.strictEqual(items[0].businessPhoneNumberId, 'PNID_888');

  // Item 2: Image
  assert.strictEqual(items[1].type, 'image');
  assert.strictEqual(items[1].caption, 'Challan for GST May');
  assert.strictEqual(items[1].mediaData.mimeType, 'image/jpeg');
  assert.strictEqual(items[1].mediaData.id, 'MEDIA_ID_IMG_2');
});

test('WhatsApp Ingestion - Confirmation Message Builder', () => {
  const msg = buildConfirmationMessage({
    clientName: 'Ramesh Sharma',
    docketTitle: 'GST Audit FY 2024-25',
    fileName: 'HDFC_Bank_Statement.pdf',
    firmName: 'Sharma & Associates',
  });

  assert.ok(msg.includes('Namaste Ramesh Sharma,'));
  assert.ok(msg.includes('*HDFC_Bank_Statement.pdf*'));
  assert.ok(msg.includes('*GST Audit FY 2024-25*'));
  assert.ok(msg.includes("firm's Google Drive archive"));
  assert.ok(msg.includes('*Sharma & Associates*'));
});
