#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const EventEmitter = require('events');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.sendFile = () => {};
  return res;
}

async function testAttachmentLookupIsFirmScoped() {
  let capturedQuery = null;
  let attachmentLookups = 0;

  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../models/Attachment.model') {
      return {
        findOne: async (query) => {
          capturedQuery = query;
          attachmentLookups += 1;
          return null;
        },
      };
    }
    if (requestName === '../repositories') {
      return {
        CaseRepository: {
          findByInternalId: async () => ({ caseId: 'DCK-1001', caseNumber: 'DCK-1001' }),
        },
        ClientRepository: {},
      };
    }
    if (requestName === '../utils/caseIdentifier') {
      return {
        resolveCaseIdentifier: async () => 'internal-1',
        resolveCaseDocument: async () => null,
      };
    }
    if (requestName === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      requestName.includes('/models/')
      || requestName.includes('/services/')
      || requestName.includes('/queues/')
      || requestName.includes('/domain/')
      || requestName.includes('/repositories/')
      || requestName.includes('/middleware/')
      || requestName.includes('/utils/')
      || requestName.includes('/config/')
    ) {
      if (requestName === '../utils/fileUtils') {
        return { getMimeType: () => 'application/pdf', sanitizeFilename: (v) => v };
      }
      if (requestName === '../config/config') {
        return { isProduction: () => false };
      }
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/case.controller');
  const { viewAttachment } = require('../src/controllers/case.controller');

  const req = {
    params: { caseId: 'DCK-1001', attachmentId: 'att-1' },
    user: { email: 'user@firm.com', xID: 'X0001', role: 'Admin', firmId: 'firm-A' },
  };
  const res = makeRes();
  await viewAttachment(req, res);

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(attachmentLookups, 1);
  assert.deepStrictEqual(capturedQuery, {
    _id: 'att-1',
    caseId: 'DCK-1001',
    firmId: 'firm-A',
  });
  console.log('  ✓ attachment view lookup is scoped by attachmentId, caseId, and firmId');
}

async function testAttachmentLookupSkippedWhenCaseNotFound() {
  let attachmentLookups = 0;
  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../models/Attachment.model') {
      return {
        findOne: async () => {
          attachmentLookups += 1;
          return null;
        },
      };
    }
    if (requestName === '../utils/caseIdentifier') {
      return {
        resolveCaseIdentifier: async () => {
          throw new Error('not found');
        },
        resolveCaseDocument: async () => null,
      };
    }
    if (requestName === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (requestName === '../repositories') {
      return { CaseRepository: { findByInternalId: async () => null }, ClientRepository: {} };
    }
    if (requestName === '../utils/fileUtils') {
      return { getMimeType: () => 'application/pdf', sanitizeFilename: (v) => v };
    }
    if (requestName === '../config/config') {
      return { isProduction: () => false };
    }
    if (
      requestName.includes('/models/')
      || requestName.includes('/services/')
      || requestName.includes('/queues/')
      || requestName.includes('/domain/')
      || requestName.includes('/repositories/')
      || requestName.includes('/middleware/')
      || requestName.includes('/utils/')
      || requestName.includes('/config/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/case.controller');
  const { downloadAttachment } = require('../src/controllers/case.controller');
  const req = {
    params: { caseId: 'OTHER-CASE', attachmentId: 'att-2' },
    user: { email: 'user@firm.com', xID: 'X0001', role: 'Admin', firmId: 'firm-A' },
  };
  const res = makeRes();
  await downloadAttachment(req, res);

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(attachmentLookups, 0);
  console.log('  ✓ attachment lookup is skipped when tenant-scoped case resolution fails');
}

async function testRefreshRateLimiting() {
  Module._load = originalLoad;
  process.env.SECURITY_RATE_LIMIT_REFRESH_IP_PER_MINUTE = '100';
  process.env.SECURITY_RATE_LIMIT_REFRESH_USER_PER_DAY = '2';
  clearModule('../src/middleware/rateLimiters');
  const { refreshIpLimiter, refreshUserLimiter } = require('../src/middleware/rateLimiters');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/auth/refresh', refreshIpLimiter, refreshUserLimiter, (req, res) => {
    res.status(200).json({ ok: true });
  });

  const accessToken = jwt.sign({ userId: 'u-1' }, 'dummy-secret');
  await request(app).post('/auth/refresh').set('X-Forwarded-For', '1.1.1.1').send({ accessToken }).expect(200);
  await request(app).post('/auth/refresh').set('X-Forwarded-For', '2.2.2.2').send({ accessToken }).expect(200);
  await request(app).post('/auth/refresh').set('X-Forwarded-For', '3.3.3.3').send({ accessToken }).expect(429);
  console.log('  ✓ refresh endpoint enforces per-user daily limits');
}

async function testUploadRejectsInfectedFiles() {
  Module._load = originalLoad;
  process.env.CLAMAV_HOST = 'localhost';
  process.env.NODE_ENV = 'test';
  clearModule('../src/middleware/uploadProtection.middleware');

  Module._load = function (requestName, parent, isMain) {
    if (requestName === 'net') {
      return {
        createConnection: () => {
          const socket = new EventEmitter();
          socket.setTimeout = () => {};
          socket.destroy = () => {};
          socket.end = () => {
            setImmediate(() => {
              socket.emit('data', Buffer.from('stream: Eicar-Test-Signature FOUND'));
              socket.emit('end');
            });
          };
          setImmediate(() => socket.emit('connect'));
          return socket;
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  const { createSecureUpload, enforceUploadSecurity, uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');
  Module._load = originalLoad;

  const app = express();
  const upload = createSecureUpload({ memory: true });
  app.post('/upload', upload.single('file'), enforceUploadSecurity, (req, res) => res.status(200).json({ ok: true }));
  app.use(uploadErrorHandler);

  await request(app)
    .post('/upload')
    .attach('file', Buffer.from('safe-content'), 'document.pdf')
    .expect(400);
  console.log('  ✓ upload security rejects files flagged as infected by scanner');
}

async function run() {
  console.log('Running Phase 1 critical security fix tests...');
  try {
    await testAttachmentLookupIsFirmScoped();
    await testAttachmentLookupSkippedWhenCaseNotFound();
    await testRefreshRateLimiting();
    await testUploadRejectsInfectedFiles();
    console.log('Phase 1 critical security fix tests passed.');
  } catch (error) {
    console.error('Phase 1 critical security fix tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
