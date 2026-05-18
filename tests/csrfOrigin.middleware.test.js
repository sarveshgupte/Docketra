#!/usr/bin/env node
const assert = require('assert');
const { enforceSameOriginForMutatingRequests } = require('../src/middleware/csrfOrigin.middleware');

function invokeMiddleware(reqOverrides = {}) {
  const req = {
    method: 'POST',
    originalUrl: '/api/dockets',
    headers: {},
    cookies: {},
    ...reqOverrides,
  };

  const result = {
    nextCalled: false,
    statusCode: null,
    payload: null,
  };

  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.payload = body;
      return this;
    },
  };

  enforceSameOriginForMutatingRequests(req, res, () => {
    result.nextCalled = true;
  });

  return result;
}

function run() {
  const originalFrontendOrigins = process.env.FRONTEND_ORIGINS;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.FRONTEND_ORIGINS = 'https://app.docketra.example';
  process.env.NODE_ENV = 'test';

  // valid same-origin mutating request passes
  let result = invokeMiddleware({
    headers: {
      origin: 'https://api.docketra.example',
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  // invalid cross-origin mutating request fails
  result = invokeMiddleware({
    headers: {
      origin: 'https://evil.example',
      host: 'api.docketra.example',
      cookie: 'refreshToken=test',
    },
  });
  assert.strictEqual(result.statusCode, 403);
  assert.strictEqual(result.payload?.message, 'Invalid request origin');

  // GET request passes
  result = invokeMiddleware({
    method: 'GET',
    headers: {
      origin: 'https://evil.example',
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  // OPTIONS request passes
  result = invokeMiddleware({
    method: 'OPTIONS',
    headers: {
      origin: 'https://evil.example',
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  // configured frontend origin passes
  result = invokeMiddleware({
    headers: {
      origin: 'https://app.docketra.example',
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  // cookie-auth mutating request with no origin/referer should fail in production
  process.env.NODE_ENV = 'production';
  result = invokeMiddleware({
    headers: {
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.statusCode, 403);
  assert.strictEqual(result.payload?.message, 'Invalid request origin');

  // bearer-token request without cookies should pass even without origin/referer
  result = invokeMiddleware({
    headers: {
      host: 'api.docketra.example',
      authorization: 'Bearer internal-token',
    },
  });
  assert.strictEqual(result.nextCalled, true);
  process.env.NODE_ENV = 'test';

  // token-auth/internal route (no cookie) should not be blocked
  result = invokeMiddleware({
    originalUrl: '/api/internal/sync',
    headers: {
      origin: 'https://unknown.example',
      host: 'api.docketra.example',
      authorization: 'Bearer internal-token',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  // explicit skip paths should not be blocked
  result = invokeMiddleware({
    originalUrl: '/metrics',
    headers: {
      origin: 'https://evil.example',
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  result = invokeMiddleware({
    originalUrl: '/health',
    headers: {
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  result = invokeMiddleware({
    originalUrl: '/api/csp-violation',
    headers: {
      host: 'api.docketra.example',
      cookie: 'accessToken=test',
    },
  });
  assert.strictEqual(result.nextCalled, true);

  if (typeof originalFrontendOrigins === 'undefined') delete process.env.FRONTEND_ORIGINS;
  else process.env.FRONTEND_ORIGINS = originalFrontendOrigins;
  if (typeof originalNodeEnv === 'undefined') delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  console.log('csrfOrigin.middleware behavior tests passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
