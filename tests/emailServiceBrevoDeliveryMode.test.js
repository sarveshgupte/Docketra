#!/usr/bin/env node
const assert = require('assert');
const { EventEmitter } = require('events');
const https = require('https');

async function run() {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    SMTP_FROM: process.env.SMTP_FROM,
    EMAIL_FROM: process.env.EMAIL_FROM,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };
  const originalRequest = https.request;
  const emailServicePath = require.resolve('../src/services/email.service');
  const originalEmailServiceCache = require.cache[emailServicePath];
  let capturedRequest = null;

  try {
    process.env.NODE_ENV = 'development';
    process.env.BREVO_API_KEY = 'test-brevo-key';
    delete process.env.MAIL_FROM;
    delete process.env.SMTP_FROM;
    process.env.EMAIL_FROM = 'Docketra <sender@example.com>';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    delete require.cache[emailServicePath];

    https.request = (options, callback) => {
      capturedRequest = { options, body: '' };
      const response = new EventEmitter();
      response.statusCode = 201;
      const request = new EventEmitter();
      request.write = (chunk) => {
        capturedRequest.body += chunk;
      };
      request.end = () => {
        callback(response);
        response.emit('data', JSON.stringify({ messageId: 'brevo-localhost-123' }));
        response.emit('end');
      };
      return request;
    };

    const emailService = require('../src/services/email.service');
    assert.strictEqual(typeof emailService.sendTransactionalEmail, 'function');

    const result = await emailService.sendEmailNow({
      to: 'client@example.com',
      subject: 'Document request',
      html: '<p>Please send documents.</p>',
      text: 'Please send documents.',
      replyTo: {
        email: 'docket-case-abc123@docketra.in',
        name: 'Admin User (via Docketra)',
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.messageId, 'brevo-localhost-123');
    assert.strictEqual(capturedRequest.options.hostname, 'api.brevo.com');
    assert.strictEqual(capturedRequest.options.headers['api-key'], 'test-brevo-key');
    let payload = JSON.parse(capturedRequest.body);
    assert.deepStrictEqual(payload.sender, { name: 'Docketra', email: 'sender@example.com' });
    assert.deepStrictEqual(payload.to, [{ email: 'client@example.com' }]);
    assert.deepStrictEqual(payload.replyTo, {
      email: 'docket-case-abc123@docketra.in',
      name: 'Admin User (via Docketra)',
    });

    capturedRequest = null;
    const setupResult = await emailService.sendPasswordSetupEmail({
      email: 'guptesarvesh@gmail.com',
      name: 'Sarvesh User',
      token: 'setup-token',
      xID: 'X000001',
      firmSlug: 'gupte-opc',
      role: 'USER',
      firmName: 'Gupte OPC',
    });

    assert.strictEqual(setupResult.success, true);
    assert.strictEqual(setupResult.messageId, 'brevo-localhost-123');
    assert.strictEqual(capturedRequest.options.hostname, 'api.brevo.com');
    assert.strictEqual(capturedRequest.options.headers['api-key'], 'test-brevo-key');
    payload = JSON.parse(capturedRequest.body);
    assert.deepStrictEqual(payload.sender, { name: 'Docketra', email: 'sender@example.com' });
    assert.deepStrictEqual(payload.to, [{ email: 'guptesarvesh@gmail.com' }]);
    assert.match(payload.htmlContent, /http:\/\/localhost:5173\/setup-password\?token=setup-token/);
    assert.match(payload.htmlContent, /<strong>Role:<\/strong> Employee/);

    console.log('emailServiceBrevoDeliveryMode.test.js passed');
  } catch (error) {
    console.error('emailServiceBrevoDeliveryMode.test.js failed', error);
    process.exit(1);
  } finally {
    https.request = originalRequest;
    if (originalEmailServiceCache) require.cache[emailServicePath] = originalEmailServiceCache;
    else delete require.cache[emailServicePath];
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

run();
