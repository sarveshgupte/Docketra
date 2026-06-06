#!/usr/bin/env node
'use strict';

const assert = require('assert');
const express = require('express');
const Module = require('module');
const request = require('supertest');

const originalLoad = Module._load;

// Setup required environment variables for config loading
process.env.JWT_SECRET = 'test-jwt-secret-placeholder-value-32ch';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/docketra';
process.env.DISABLE_GOOGLE_AUTH = 'true';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.SUPERADMIN_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
process.env.SUPERADMIN_XID = 'X000001';
process.env.SUPERADMIN_EMAIL = 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
};

// Stub out route dependencies so we can isolate the route/controller/upload-security logic
const mockMiddles = {
  '../middleware/requireStorageConnected': {
    requireStorageConnected: (req, res, next) => next(),
  },
  '../middleware/permission.middleware': {
    authorizeFirmPermission: () => (req, res, next) => next(),
  },
  '../middleware/authorization.middleware': {
    requireCaseAccess: () => (req, res, next) => next(),
  },
  '../controllers/docketFileStorage.controller': {
    uploadDocketFile: (req, res) => res.status(201).json({ success: true }),
    listDocketAttachments: (req, res) => res.json({ success: true }),
    getDocketFile: (req, res) => res.json({ success: true }),
  },
};

Module._load = function (request, parent, isMain) {
  if (mockMiddles[request]) return mockMiddles[request];
  return originalLoad.apply(this, arguments);
};

async function runTests() {
  console.log('Running docketFileStorage upload security tests...');

  // --- TEST CASE 1: Valid Upload (Passes validation and skips scan because CLAMAV_HOST is not configured) ---
  {
    process.env.UPLOAD_SCAN_STRICT = 'false';
    process.env.NODE_ENV = 'development';
    clearModule('../src/middleware/uploadProtection.middleware');
    clearModule('../src/routes/docketFileStorage.routes');

    const router = require('../src/routes/docketFileStorage.routes');
    const { uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use(uploadErrorHandler);

    // %PDF signature at start
    const validPdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100)]);
    const response = await request(app)
      .post('/dockets/case-123/attachments')
      .attach('file', validPdfBuffer, 'test.pdf');

    assert.strictEqual(response.status, 201, 'Valid PDF should be accepted');
    assert.strictEqual(response.body.success, true);
    console.log('  ✓ accepts valid PDF uploads');
  }

  // --- TEST CASE 2: Rejection of non-allowed files (e.g. .exe) ---
  {
    clearModule('../src/middleware/uploadProtection.middleware');
    clearModule('../src/routes/docketFileStorage.routes');

    const router = require('../src/routes/docketFileStorage.routes');
    const { uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use(uploadErrorHandler);

    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    const response = await request(app)
      .post('/dockets/case-123/attachments')
      .attach('file', exeBuffer, 'malicious.exe');

    assert.strictEqual(response.status, 400, 'Executable upload should be blocked by fileFilter');
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.error, 'FILE_UPLOAD_REJECTED');
    console.log('  ✓ rejects forbidden extensions (.exe)');
  }

  // --- TEST CASE 3: Rejection of MIME spoofing (extension matches, signature does not) ---
  {
    clearModule('../src/middleware/uploadProtection.middleware');
    clearModule('../src/routes/docketFileStorage.routes');

    const router = require('../src/routes/docketFileStorage.routes');
    const { uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use(uploadErrorHandler);

    // Extension is .pdf, but signature is text/html or plain (no %PDF prefix)
    const spoofedBuffer = Buffer.from('<html>Hello World</html>');
    const response = await request(app)
      .post('/dockets/case-123/attachments')
      .attach('file', spoofedBuffer, 'spoofed.pdf');

    assert.strictEqual(response.status, 400, 'Spoofed file should be rejected by signature sniffer');
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.error, 'FILE_UPLOAD_REJECTED');
    assert.strictEqual(response.body.message, 'Invalid file signature or extension mismatch');
    console.log('  ✓ rejects MIME-spoofed uploads');
  }

  // --- TEST CASE 4: Rejection of oversized file ---
  {
    clearModule('../src/middleware/uploadProtection.middleware');
    clearModule('../src/routes/docketFileStorage.routes');

    const router = require('../src/routes/docketFileStorage.routes');
    const { uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use(uploadErrorHandler);

    const config = require('../src/config/config');
    const sizeLimitBytes = config.security.upload.maxSizeMB * 1024 * 1024;
    // Buffer slightly larger than allowed
    const oversizedBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(sizeLimitBytes + 100)]);

    const response = await request(app)
      .post('/dockets/case-123/attachments')
      .attach('file', oversizedBuffer, 'too_large.pdf');

    assert.strictEqual(response.status, 400, 'Oversized file should be rejected by size limits');
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.error, 'FILE_UPLOAD_REJECTED');
    assert.ok(response.body.message.includes('too large') || response.body.message.includes('File too large'));
    console.log('  ✓ rejects oversized uploads');
  }

  // --- TEST CASE 5: Scanner-unavailable strict mode (fails closed when ClamAV is missing and strict mode is active) ---
  {
    process.env.UPLOAD_SCAN_STRICT = 'true';
    process.env.NODE_ENV = 'production';
    clearModule('../src/middleware/uploadProtection.middleware');
    clearModule('../src/routes/docketFileStorage.routes');

    const router = require('../src/routes/docketFileStorage.routes');
    const { uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');

    const app = express();
    app.use(express.json());
    app.use('/', router);
    app.use(uploadErrorHandler);

    const validPdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100)]);
    const response = await request(app)
      .post('/dockets/case-123/attachments')
      .attach('file', validPdfBuffer, 'test.pdf');

    assert.strictEqual(response.status, 503, 'Should fail closed (503) when scanner is not configured under strict mode');
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.error, 'FILE_SCAN_UNAVAILABLE');
    console.log('  ✓ fails closed in strict mode when malware scanner is unconfigured');
  }

  console.log('All docketFileStorage upload security tests passed.');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
