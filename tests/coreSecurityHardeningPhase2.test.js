#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { maskSensitiveObject } = require('../src/utils/pii');
const errorHandler = require('../src/middleware/errorHandler');

function createMockResponse() {
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

function testSensitiveLogMasking() {
  const masked = maskSensitiveObject({
    Authorization: 'Bearer very-secret-token',
    password: 'SuperSecret123!',
    accessToken: 'header.payload.signature',
    refreshToken: 'refresh-token-value',
    mfaSecret: 'ABCDEF123456',
    totpSecret: 'OTPSECRET',
  });

  assert.strictEqual(masked.Authorization, 'Bearer *****');
  assert.strictEqual(masked.password, '***REDACTED***');
  assert.strictEqual(masked.mfaSecret, '***REDACTED***');
  assert.strictEqual(masked.totpSecret, '***REDACTED***');
  assert.notStrictEqual(masked.accessToken, 'header.payload.signature');
  assert.notStrictEqual(masked.refreshToken, 'refresh-token-value');
}

function testErrorHandlerHidesServerDetails() {
  const req = { requestId: 'req-1' };
  const res = createMockResponse();
  const err = new Error('database timeout with stack details');
  err.statusCode = 500;
  errorHandler(err, req, res, () => {});

  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(res.body.message, 'Internal server error');
  assert.ok(!JSON.stringify(res.body).includes('stack'));
  assert.ok(!JSON.stringify(res.body).includes('database timeout'));
}

function testServerHardeningWiring() {
  const serverPath = path.join(__dirname, '..', 'src', 'server.js');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.match(serverCode, /contentSecurityPolicy:\s*\{/);
  assert.match(serverCode, /referrerPolicy:\s*\{\s*policy:\s*'strict-origin-when-cross-origin'/);
  assert.match(serverCode, /hsts:\s*isProduction\s*\?\s*\{\s*maxAge:\s*31536000,\s*includeSubDomains:\s*true,\s*preload:\s*true\s*\}\s*:\s*false/);
  assert.match(serverCode, /app\.post\('\/api\/csp-violation'/);
  assert.match(serverCode, /if\s*\(!isProduction\)\s*\{\s*app\.use\('\/api\/debug'/s);
}

function testRateLimiterExports() {
  const rateLimiters = require('../src/middleware/rateLimiters');
  assert.strictEqual(typeof rateLimiters.loginLimiter, 'function');
  assert.strictEqual(typeof rateLimiters.forgotPasswordLimiter, 'function');
  assert.strictEqual(typeof rateLimiters.publicLimiter, 'function');
}

function run() {
  testSensitiveLogMasking();
  testErrorHandlerHidesServerDetails();
  testServerHardeningWiring();
  testRateLimiterExports();
  console.log('coreSecurityHardeningPhase2 tests passed');
}

run();
