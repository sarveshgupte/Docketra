#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { cloudflareAccessGuard, normalizeEmail } = require('../src/middleware/cloudflareAccess.middleware');
const requestId = require('../src/middleware/requestId.middleware');

const run = async () => {
  // Test 1: normalizeEmail helper
  assert.strictEqual(normalizeEmail(' Admin@Docketshq.com '), 'admin@docketshq.com');
  assert.strictEqual(normalizeEmail(null), '');
  assert.strictEqual(normalizeEmail(undefined), '');

  // Test 2: cloudflareAccessGuard passes through when disabled
  {
    delete process.env.CLOUDFLARE_ACCESS_ENABLED;
    delete process.env.CLOUDFLARE_ACCESS_REQUIRED;
    let nextCalled = false;
    const req = { headers: {} };
    const res = {};
    cloudflareAccessGuard(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'should call next when disabled');
    assert.strictEqual(req.cfAccess, undefined, 'should not attach cfAccess when disabled');
  }

  // Test 3: cloudflareAccessGuard rejects with 403 when enabled + required and header is missing
  {
    process.env.CLOUDFLARE_ACCESS_ENABLED = 'true';
    process.env.CLOUDFLARE_ACCESS_REQUIRED = 'true';
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;
    const req = { headers: {}, requestId: 'req-1', url: '/api/superadmin/stats' };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            jsonBody = body;
          },
        };
      },
    };

    cloudflareAccessGuard(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false, 'should not call next when header is missing and required');
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody?.code, 'CLOUDFLARE_ACCESS_REQUIRED');
  }

  // Test 4: cloudflareAccessGuard rejects with 403 when email is not in allowed list
  {
    process.env.CLOUDFLARE_ACCESS_ENABLED = 'true';
    process.env.CLOUDFLARE_ACCESS_REQUIRED = 'true';
    process.env.CLOUDFLARE_ACCESS_ALLOWED_EMAILS = 'admin@docketshq.com, ops@docketshq.com';
    let statusCode = null;
    let jsonBody = null;
    let nextCalled = false;
    const req = {
      headers: {
        'cf-access-authenticated-user-email': 'attacker@example.com',
        'cf-access-jwt-assertion': 'jwt.token.here',
        'cf-ipcountry': 'IN',
      },
      requestId: 'req-2',
      url: '/api/superadmin/stats',
    };
    const res = {
      status(code) {
        statusCode = code;
        return {
          json(body) {
            jsonBody = body;
          },
        };
      },
    };

    cloudflareAccessGuard(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonBody?.code, 'CLOUDFLARE_ACCESS_FORBIDDEN');
  }

  // Test 5: cloudflareAccessGuard attaches req.cfAccess and calls next when email is authorized
  {
    process.env.CLOUDFLARE_ACCESS_ENABLED = 'true';
    process.env.CLOUDFLARE_ACCESS_REQUIRED = 'true';
    process.env.CLOUDFLARE_ACCESS_ALLOWED_EMAILS = 'admin@docketshq.com, ops@docketshq.com';
    let nextCalled = false;
    const req = {
      headers: {
        'cf-access-authenticated-user-email': ' Admin@Docketshq.com ',
        'cf-access-jwt-assertion': 'valid.jwt.assertion',
        'cf-ipcountry': 'IN',
      },
      requestId: 'req-3',
      url: '/api/superadmin/stats',
    };
    const res = {};

    cloudflareAccessGuard(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'should call next when identity is authorized');
    assert.deepStrictEqual(req.cfAccess, {
      email: 'admin@docketshq.com',
      assertion: 'valid.jwt.assertion',
      country: 'IN',
    });
  }

  // Test 6: CF-Ray header extraction in requestId middleware
  {
    const req = {
      headers: {
        'cf-ray': '8f123456789abcde-BOM',
        'x-request-id': 'custom-req-id',
      },
    };
    const responseHeaders = {};
    const res = {
      setHeader(key, value) {
        responseHeaders[key] = value;
      },
    };
    let nextCalled = false;
    requestId(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.cfRay, '8f123456789abcde-BOM');
    assert.strictEqual(responseHeaders['CF-Ray'], '8f123456789abcde-BOM');
    assert.strictEqual(responseHeaders['X-Request-ID'], 'custom-req-id');
  }

  // Clean up env
  delete process.env.CLOUDFLARE_ACCESS_ENABLED;
  delete process.env.CLOUDFLARE_ACCESS_REQUIRED;
  delete process.env.CLOUDFLARE_ACCESS_ALLOWED_EMAILS;

  console.log('✓ cloudflareAccess.middleware.test.js passed all assertions');
};

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
