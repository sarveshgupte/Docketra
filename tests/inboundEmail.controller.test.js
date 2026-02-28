#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const { createHmac } = require('crypto');

let queuedPayload = null;
const mockEnqueueInboundEmailJob = async (payload) => {
  queuedPayload = payload;
  return { id: 'job-1' };
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
  if (request === '../queues/inboundEmail.queue') return { enqueueInboundEmailJob: mockEnqueueInboundEmailJob };
  if (request === '../models/Case.model') return {};
  if (request === '../models/Comment.model') return {};
  if (request === '../models/Attachment.model') return {};
  if (request === '../models/EmailThread.model') return {};
  if (request === '../models/TenantStorageConfig.model') return {};
  if (request === '../models/User.model') return {};
  if (request === '../storage/StorageProviderFactory') return {};
  if (request === '../services/email.service') return { sendEmail: async () => ({ success: true }) };
  return originalLoad.apply(this, arguments);
};

const {
  parsePublicEmailTokenFromRecipient,
  handleInboundEmail,
} = require('../src/controllers/inboundEmail.controller');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function testParsePublicToken() {
  const token = parsePublicEmailTokenFromRecipient('case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com');
  assert.strictEqual(token, '550e8400-e29b-41d4-a716-446655440000');
  assert.strictEqual(parsePublicEmailTokenFromRecipient('CASE-ABC123@inbound.docketra.com'), null);
  assert.strictEqual(parsePublicEmailTokenFromRecipient('case-@inbound.docketra.com'), null);
  console.log('  ✓ parses public email tokens from inbound recipient addresses');
}

async function testRejectsMissingFields() {
  const req = { body: { to: 'case-token@inbound.docketra.com' }, headers: {} };
  const res = makeRes();
  await handleInboundEmail(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /Missing required fields/i);
  console.log('  ✓ rejects inbound payloads missing required fields');
}

async function testQueuesInboundPayload() {
  queuedPayload = null;
  const payload = {
    to: 'case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com',
    from: 'sender@example.com',
    subject: 'hello',
  };
  const req = {
    body: Buffer.from(JSON.stringify(payload)),
    headers: {},
  };
  const res = makeRes();
  await handleInboundEmail(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(queuedPayload.from, 'sender@example.com');
  console.log('  ✓ queues inbound email processing and returns 200');
}

async function testRejectsInvalidSignature() {
  const payload = {
    to: 'case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com',
    from: 'sender@example.com',
  };
  const req = {
    body: Buffer.from(JSON.stringify(payload)),
    headers: { 'x-inbound-signature': 'deadbeef' },
  };
  const res = makeRes();
  process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'test-secret';
  await handleInboundEmail(req, res);
  assert.strictEqual(res.statusCode, 401);
  delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  console.log('  ✓ rejects inbound payloads with invalid signature');
}

async function testAcceptsValidSignature() {
  queuedPayload = null;
  const payload = {
    to: 'case-550e8400-e29b-41d4-a716-446655440000@inbound.docketra.com',
    from: 'sender@example.com',
  };
  const raw = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', 'test-secret').update(raw).digest('hex');
  const req = {
    body: raw,
    headers: { 'x-inbound-signature': signature },
  };
  const res = makeRes();
  process.env.INBOUND_EMAIL_WEBHOOK_SECRET = 'test-secret';
  await handleInboundEmail(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(queuedPayload.to, payload.to);
  delete process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  console.log('  ✓ accepts raw-body payloads with valid signature');
}

async function run() {
  console.log('Running inboundEmail.controller tests...');
  try {
    await testParsePublicToken();
    await testRejectsMissingFields();
    await testQueuesInboundPayload();
    await testRejectsInvalidSignature();
    await testAcceptsValidSignature();
    console.log('All inboundEmail.controller tests passed.');
  } catch (error) {
    console.error('inboundEmail.controller tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
